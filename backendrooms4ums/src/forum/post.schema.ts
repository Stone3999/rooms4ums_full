import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  authorId: string; // Referencia al ID de Postgres del usuario

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  roomId: string; // Referencia al ID de Postgres del forum (room)

  /**
   * `path` es la ruta interna del archivo en Supabase Storage.
   * Se guarda para poder regenerar una URL firmada en cada lectura
   * (Práctica 3/10): la URL pública o firmada nunca es la fuente de verdad.
   */
  @Prop({ type: [{ url: String, path: String, type: String, name: String }] })
  attachments: { url: string; path?: string; type: string; name: string }[];

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 'PENDIENTE', enum: ['PENDIENTE', 'EN_PROCESO', 'RESUELTO'] })
  status: string;

  @Prop({ default: 'MEDIA', enum: ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] })
  priority: string;

  @Prop({ required: false })
  assignedAgentId?: string;

  @Prop({ required: false })
  idempotencyKey?: string;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Índice para búsqueda rápida por Room y por Título/Contenido
PostSchema.index({ roomId: 1, createdAt: -1 });
PostSchema.index({ title: 'text', content: 'text' });
PostSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
