import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject } from '@nestjs/common';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('VoiceGateway');

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  private lastMessageTimes: Map<string, number> = new Map();

  async handleDisconnect(client: Socket) {
    const { roomId, username } = client.data;
    this.logger.log(`Client disconnected: ${client.id} (${username})`);
    this.lastMessageTimes.delete(client.id);
    
    if (roomId) {
      await this.updateChannelUserCount(roomId, -1);
      this.server.to(roomId).emit('user-left', client.id);
    }
  }

  @SubscribeMessage('get-voice-channels')
  async handleGetChannels() {
    const keys = await this.redis.keys('voice_channel:*');
    const channels: any[] = [];
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

  @SubscribeMessage('send-voice-message')
  handleVoiceMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
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

  @SubscribeMessage('create-voice-channel')
  async handleCreateChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { category: string; topic: string; username: string },
  ) {
    let { category, topic, username } = data;
    
    // Limpieza de topic: Max 30 chars y sin saltos de línea
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

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const { roomId } = client.data;
    if (roomId) {
      this.logger.log(`User leaving room: ${roomId}`);
      await this.updateChannelUserCount(roomId, -1);
      client.leave(roomId);
      this.server.to(roomId).emit('user-left', client.id);
      client.data.roomId = null;
    }
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; username: string },
  ) {
    const { roomId, username } = data;
    
    if (roomId.startsWith('vc_')) {
      const key = `voice_channel:${roomId}`;
      const channel = await this.redis.hgetall(key);
      
      if (!channel || !channel.id) return { error: 'CHANNEL_NOT_FOUND' };

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
    const usersInRoom: { id: string; username: string }[] = [];
    
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

  private async updateChannelUserCount(channelId: string, delta: number) {
    if (!channelId || !channelId.startsWith('vc_')) return;
    
    const key = `voice_channel:${channelId}`;
    const exists = await this.redis.exists(key);
    
    if (exists) {
      const newCount = await this.redis.hincrby(key, 'userCount', delta);
      
      if (newCount <= 0) {
        await this.redis.del(key);
        this.server.emit('voice-channel-deleted', channelId);
      } else {
        this.server.emit('voice-channel-updated', {
          id: channelId,
          userCount: newCount
        });
      }
    }
  }

  @SubscribeMessage('signal')
  handleSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { to: string; signal: any },
  ) {
    this.server.to(data.to).emit('signal', {
      from: client.id,
      signal: data.signal,
    });
  }

  @SubscribeMessage('toggle-mute')
  handleToggleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isMuted: boolean },
  ) {
    client.to(data.roomId).emit('user-mute-toggled', {
      id: client.id,
      isMuted: data.isMuted,
    });
  }

  @SubscribeMessage('toggle-video')
  handleToggleVideo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isSharing: boolean },
  ) {
    client.to(data.roomId).emit('user-video-toggled', {
      id: client.id,
      isSharing: data.isSharing,
    });
  }
}
