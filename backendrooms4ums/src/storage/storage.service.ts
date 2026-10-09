import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private supabase: SupabaseClient;
  private bucketName: string;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY') || '';
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET_NAME') || 'avatars';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async uploadFile(file: Buffer, path: string, contentType: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Error subiendo archivo a Supabase: ${error.message}`);
    }

    return data;
  }

  getFileUrl(path: string) {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return data.publicUrl;
  }
}
