import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class StorageService implements OnModuleInit {
    private configService;
    private readonly logger;
    private supabase;
    private bucketName;
    private keyMode;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    private checkBucket;
    uploadFile(file: Buffer, path: string, contentType: string): Promise<{
        id: string;
        path: string;
        fullPath: string;
    }>;
    private explain;
    getFileUrl(path: string): string;
    getAttachmentUrl(path: string, expiresInSeconds?: number): Promise<string>;
    health(): Promise<{
        exists: boolean;
        public: boolean;
        error: null;
        bucket: string;
        keyMode: "service_role" | "anon";
    } | {
        exists: boolean;
        public: null;
        error: any;
        bucket: string;
        keyMode: "service_role" | "anon";
    }>;
}
