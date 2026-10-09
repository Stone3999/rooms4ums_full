import { Connection } from 'mongoose';
import Redis from 'ioredis';
import { StorageService } from '../storage/storage.service';
export declare class DiagnosticController {
    private sql;
    private readonly mongoConnection;
    private redis;
    private storage;
    constructor(sql: any, mongoConnection: Connection, redis: Redis, storage: StorageService);
    runDiagnostic(): Promise<{
        postgres: string;
        mongo: string;
        redis: string;
        storage: string;
    }>;
}
