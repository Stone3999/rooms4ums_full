"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
let VoiceGateway = class VoiceGateway {
    redis;
    server;
    logger = new common_1.Logger('VoiceGateway');
    constructor(redis) {
        this.redis = redis;
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
    }
    lastMessageTimes = new Map();
    async handleDisconnect(client) {
        const { roomId, username } = client.data;
        this.logger.log(`Client disconnected: ${client.id} (${username})`);
        this.lastMessageTimes.delete(client.id);
        if (roomId) {
            await this.updateChannelUserCount(roomId, -1);
            this.server.to(roomId).emit('user-left', client.id);
        }
    }
    async handleGetChannels() {
        const keys = await this.redis.keys('voice_channel:*');
        const channels = [];
        const now = Date.now();
        const MAX_DURATION = 2 * 60 * 60 * 1000;
        for (const key of keys) {
            const channel = await this.redis.hgetall(key);
            if (channel && channel.id) {
                const createdAt = parseInt(channel.createdAt || '0', 10);
                if (now - createdAt > MAX_DURATION) {
                    await this.redis.del(key);
                    this.server.emit('voice-channel-deleted', channel.id);
                    continue;
                }
                channels.push({
                    ...channel,
                    userCount: parseInt(channel.userCount || '0', 10)
                });
            }
        }
        return channels;
    }
    handleVoiceMessage(client, data) {
        const { roomId, content } = data;
        const now = Date.now();
        const lastTime = this.lastMessageTimes.get(client.id) || 0;
        if (now - lastTime < 1000) {
            return { status: 'ERROR', message: 'SPAM_PROTECTION' };
        }
        this.lastMessageTimes.set(client.id, now);
        const username = client.data.username || 'Anonymous';
        this.server.to(roomId).emit('new-voice-message', {
            id: `msg_${now}`,
            sender: username,
            content,
            timestamp: now,
        });
        return { status: 'OK' };
    }
    async handleCreateChannel(client, data) {
        let { category, topic, username } = data;
        topic = (topic || '').replace(/[\r\n]+/gm, ' ').trim().substring(0, 30);
        const channelId = `vc_${Date.now()}`;
        const key = `voice_channel:${channelId}`;
        const newChannel = {
            id: channelId,
            category: category,
            topic: topic,
            userCount: '0',
            createdAt: Date.now().toString(),
            host: username || 'Anonymous'
        };
        await this.redis.hmset(key, newChannel);
        await this.redis.expire(key, 86400);
        this.server.emit('voice-channel-created', {
            ...newChannel,
            userCount: 0,
            createdAt: parseInt(newChannel.createdAt, 10)
        });
        return { channelId };
    }
    async handleLeaveRoom(client) {
        const { roomId } = client.data;
        if (roomId) {
            this.logger.log(`User leaving room: ${roomId}`);
            await this.updateChannelUserCount(roomId, -1);
            client.leave(roomId);
            this.server.to(roomId).emit('user-left', client.id);
            client.data.roomId = null;
        }
    }
    async handleJoinRoom(client, data) {
        const { roomId, username } = data;
        if (roomId.startsWith('vc_')) {
            const key = `voice_channel:${roomId}`;
            const channel = await this.redis.hgetall(key);
            if (!channel || !channel.id)
                return { error: 'CHANNEL_NOT_FOUND' };
            const createdAt = parseInt(channel.createdAt, 10);
            const MAX_DURATION = 2 * 60 * 60 * 1000;
            if (Date.now() - createdAt > MAX_DURATION) {
                await this.redis.del(key);
                this.server.emit('voice-channel-deleted', roomId);
                return { error: 'CHANNEL_EXPIRED' };
            }
        }
        client.data.username = username;
        client.data.roomId = roomId;
        client.join(roomId);
        this.logger.log(`User ${username} joined voice channel: ${roomId}`);
        if (roomId.startsWith('vc_')) {
            await this.updateChannelUserCount(roomId, 1);
        }
        client.to(roomId).emit('user-joined', {
            id: client.id,
            username: username,
        });
        const clients = this.server.sockets.adapter.rooms.get(roomId);
        const usersInRoom = [];
        if (clients) {
            clients.forEach((clientId) => {
                if (clientId !== client.id) {
                    const socket = this.server.sockets.sockets.get(clientId);
                    if (socket) {
                        usersInRoom.push({
                            id: clientId,
                            username: socket.data.username || 'Anonymous',
                        });
                    }
                }
            });
        }
        return { users: usersInRoom };
    }
    async updateChannelUserCount(channelId, delta) {
        if (!channelId || !channelId.startsWith('vc_'))
            return;
        const key = `voice_channel:${channelId}`;
        const exists = await this.redis.exists(key);
        if (exists) {
            const newCount = await this.redis.hincrby(key, 'userCount', delta);
            if (newCount <= 0) {
                await this.redis.del(key);
                this.server.emit('voice-channel-deleted', channelId);
            }
            else {
                this.server.emit('voice-channel-updated', {
                    id: channelId,
                    userCount: newCount
                });
            }
        }
    }
    handleSignal(client, data) {
        this.server.to(data.to).emit('signal', {
            from: client.id,
            signal: data.signal,
        });
    }
    handleToggleMute(client, data) {
        client.to(data.roomId).emit('user-mute-toggled', {
            id: client.id,
            isMuted: data.isMuted,
        });
    }
    handleToggleVideo(client, data) {
        client.to(data.roomId).emit('user-video-toggled', {
            id: client.id,
            isSharing: data.isSharing,
        });
    }
};
exports.VoiceGateway = VoiceGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], VoiceGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('get-voice-channels'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleGetChannels", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('send-voice-message'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VoiceGateway.prototype, "handleVoiceMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('create-voice-channel'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleCreateChannel", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('join-room'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], VoiceGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('signal'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VoiceGateway.prototype, "handleSignal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggle-mute'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VoiceGateway.prototype, "handleToggleMute", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('toggle-video'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], VoiceGateway.prototype, "handleToggleVideo", null);
exports.VoiceGateway = VoiceGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __param(0, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [ioredis_1.default])
], VoiceGateway);
//# sourceMappingURL=voice.gateway.js.map