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

  @Prop({ type: [{ url: String, type: String, name: String }] })
  attachments: { url: string; type: string; name: string }[];

  @Prop({ default: 0 })
  viewCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Índice para búsqueda rápida por Room y por Título/Contenido
PostSchema.index({ roomId: 1, createdAt: -1 });
PostSchema.index({ title: 'text', content: 'text' });
