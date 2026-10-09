import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class StorageService implements OnModuleInit {
    private configService;
    private supabase;
    private bucketName;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    uploadFile(file: Buffer, path: string, contentType: string): Promise<{
        id: string;
        path: string;
        fullPath: string;
    }>;
    getFileUrl(path: string): string;
}
