import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private supabase: SupabaseClient;
  private bucketName: string;
  private keyMode: 'service_role' | 'anon' = 'anon';

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    const serviceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    const publicKey = this.configService.get<string>('SUPABASE_KEY') || '';
    const supabaseKey = serviceKey || publicKey;

    this.keyMode = serviceKey ? 'service_role' : 'anon';
    this.bucketName = this.configService.get<string>('SUPABASE_BUCKET_NAME') || 'avatars';

    this.supabase = createClient(supabaseUrl, supabaseKey);

    this.logger.log(
      `Storage listo: bucket="${this.bucketName}" clave=${this.keyMode}. ` +
        (this.keyMode === 'anon'
          ? 'OJO: con la clave anon los uploads fallan si el bucket no tiene policy de INSERT.'
          : ''),
    );

    void this.checkBucket();
  }

  private async checkBucket() {
    try {
      const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
      if (error) {
        this.logger.error(
          `No se pudo leer el bucket "${this.bucketName}": ${error.message}. ` +
            'Créalo en Supabase > Storage (debe ser público para ver las imágenes).',
        );
        return;
      }
      this.logger.log(`Bucket "${this.bucketName}" encontrado. public=${data.public}`);
      if (!data.public) {
        this.logger.warn(
          `El bucket "${this.bucketName}" es privado: las URLs públicas devolverán 403 y las imágenes no se verán.`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`No se pudo verificar el bucket: ${e?.message ?? e}`);
    }
  }

  async uploadFile(file: Buffer, path: string, contentType: string) {
    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(path, file, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(this.explain(error.message));
    }

    return data;
  }

  private explain(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('bucket not found')) {
      return `El bucket "${this.bucketName}" no existe en Supabase Storage. Créalo como público o define SUPABASE_BUCKET_NAME.`;
    }
    if (lower.includes('row-level security') || lower.includes('violates row-level') || lower.includes('unauthorized')) {
      return `La clave de Supabase no tiene permiso de escritura (${this.keyMode}). Define SUPABASE_SERVICE_ROLE_KEY en Render.`;
    }
    if (lower.includes('exceeded') || lower.includes('too large')) {
      return `El archivo supera el límite del bucket: ${message}`;
    }
    return `Error subiendo archivo a Supabase: ${message}`;
  }

  getFileUrl(path: string) {
    const { data } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Genera una URL pre-firmada con caducidad (Práctica 3 / 10 / 11).
   *
   * Por omisión se firma: un adjunto nunca debe quedar accesible de forma
   * permanente. Solo se degrada a URL pública si `SUPABASE_SIGNED_URLS=false`
   * (por ejemplo, un bucket público heredado) o si la firma falla, y en ese
   * caso queda registrado en el log para no ocultar la configuración.
   */
  async getAttachmentUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const useSigned = this.configService.get<string>('SUPABASE_SIGNED_URLS') !== 'false';
    if (!useSigned) return this.getFileUrl(path);

    const { data, error } = await this.supabase.storage
      .from(this.bucketName)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      this.logger.warn(`No se pudo firmar URL para ${path}: ${error?.message ?? 'sin dato'}`);
      return this.getFileUrl(path);
    }

    return data.signedUrl;
  }

  async health() {
    const base = { bucket: this.bucketName, keyMode: this.keyMode };
    try {
      const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
      if (error) {
        return { ...base, exists: false, public: null, error: this.explain(error.message) };
      }
      return { ...base, exists: true, public: data.public, error: null };
    } catch (e: any) {
      return { ...base, exists: false, public: null, error: e?.message ?? String(e) };
    }
  }
}
