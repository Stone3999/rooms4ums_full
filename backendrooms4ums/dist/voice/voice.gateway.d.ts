import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
export declare class VoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly redis;
    server: Server;
    private logger;
    constructor(redis: Redis);
    handleConnection(client: Socket): void;
    private lastMessageTimes;
    handleDisconnect(client: Socket): Promise<void>;
    handleGetChannels(): Promise<any[]>;
    handleVoiceMessage(client: Socket, data: {
        roomId: string;
        content: string;
    }): {
        status: string;
        message: string;
    } | {
        status: string;
        message?: undefined;
    };
    handleCreateChannel(client: Socket, data: {
        category: string;
        topic: string;
        username: string;
    }): Promise<{
        channelId: string;
    }>;
    handleLeaveRoom(client: Socket): Promise<void>;
    handleJoinRoom(client: Socket, data: {
        roomId: string;
        username: string;
    }): Promise<{
        error: string;
        users?: undefined;
    } | {
        users: {
            id: string;
            username: string;
        }[];
        error?: undefined;
    }>;
    private updateChannelUserCount;
    handleSignal(client: Socket, data: {
        to: string;
        signal: any;
    }): void;
    handleToggleMute(client: Socket, data: {
        roomId: string;
        isMuted: boolean;
    }): void;
    handleToggleVideo(client: Socket, data: {
        roomId: string;
        isSharing: boolean;
    }): void;
}
