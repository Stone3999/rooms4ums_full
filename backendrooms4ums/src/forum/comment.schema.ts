import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
  postId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true })
  authorId: string; // Referencia al ID de Postgres del usuario

  @Prop({ required: true })
  authorName: string;

  @Prop({ type: [{ url: String, type: String, name: String }], default: [] })
  attachments: { url: string; type: string; name: string }[];
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

// Índice para cargar comentarios de un post rápidamente
CommentSchema.index({ postId: 1, createdAt: 1 });
