import { Controller, Get, Inject } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import Redis from 'ioredis';
import { StorageService } from '../storage/storage.service';

@Controller('diagnostic')
export class DiagnosticController {
  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject('REDIS_CLIENT') private redis: Redis,
    private storage: StorageService,
  ) {}

  @Get()
  async runDiagnostic() {
    const results = {
      postgres: 'Pending',
      mongo: 'Pending',
      redis: 'Pending',
      storage: 'Pending',
    };

    // 1. PostgreSQL (Via postgres.js)
    try {
      const result = await this.sql`SELECT 1 as connected`;
      results.postgres = result[0].connected === 1 ? '✅ Connected (Supabase)' : '❌ Data mismatch';
    } catch (e) {
      results.postgres = `❌ Error: ${e.message}`;
    }

    // 2. MongoDB
    try {
      const state = this.mongoConnection.readyState;
      results.mongo = state === 1 ? '✅ Connected (Atlas)' : `❌ State: ${state}`;
    } catch (e) {
      results.mongo = `❌ Error: ${e.message}`;
    }

    // 3. Redis
    try {
      await this.redis.set('diagnostic-test', 'OK', 'EX', 10);
      const val = await this.redis.get('diagnostic-test');
      results.redis = val === 'OK' ? '✅ Connected (Upstash)' : '❌ Data mismatch';
    } catch (e) {
      results.redis = `❌ Error: ${e.message}`;
    }

    // 4. Storage
    try {
      const buffer = Buffer.from('Test file content');
      const fileName = `test-${Date.now()}.txt`;
      await this.storage.uploadFile(buffer, fileName, 'text/plain');
      const url = this.storage.getFileUrl(fileName);
      results.storage = `✅ Connected (Supabase Storage) - URL: ${url}`;
    } catch (e) {
      results.storage = `❌ Error: ${e.message}`;
    }

    return results;
  }
}
