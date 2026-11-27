import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';
import { PushService } from '../push/push.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly pushService: PushService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Regenera la URL de cada adjunto a partir de su `path` guardado.
   *
   * Práctica 3/10: la base solo conserva la ruta interna; la URL firmada se
   * emite en la lectura y caduca. Así un enlace filtrado deja de servir y
   * rotar la firma no exige migrar documentos.
   */
  private async signAttachments<T extends Record<string, any>>(post: T): Promise<T> {
    const attachments = (post as any)?.attachments;
    if (!Array.isArray(attachments) || attachments.length === 0) return post;

    const signed = await Promise.all(
      attachments.map(async (attachment: any) => {
        if (!attachment?.path) return attachment;
        try {
          const url = await this.storageService.getAttachmentUrl(attachment.path);
          return { ...attachment, url };
        } catch {
          return attachment;
        }
      }),
    );

    return { ...post, attachments: signed };
  }

  private async signAll<T extends Record<string, any>>(posts: T[]): Promise<T[]> {
    return Promise.all(posts.map((post) => this.signAttachments(post)));
  }

  /**
   * ÚNICO punto de creación de posts del sistema.
   *
   * Soporta `idempotencyKey` para evitar duplicados ante reintentos de red
   * (Práctica 12) y dispara el push remoto de forma asíncrona.
   */
  async create(createPostDto: any): Promise<PostDocument> {
    if (createPostDto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(createPostDto.idempotencyKey);
      if (existing) return existing;
    }

    let createdPost: PostDocument;
    try {
      createdPost = await new this.postModel(createPostDto).save();
    } catch (error: any) {
      if (error?.code !== 11000 || !createPostDto.idempotencyKey) throw error;
      const existing = await this.findByIdempotencyKey(createPostDto.idempotencyKey);
      if (!existing) throw error;
      return existing;
    }

    this.pushService
      .notifyNewPost(createdPost, createdPost.authorId)
      .catch((err) => this.logger.error(`Fallo el push del post: ${err?.message ?? err}`));

    return createdPost;
  }

  async findByIdempotencyKey(key: string): Promise<PostDocument | null> {
    return this.postModel.findOne({ idempotencyKey: key }).exec();
  }

  async findAllByRoom(roomId: string, page = 1, limit = 20): Promise<{ data: any[]; total: number }> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.postModel
        .find({ roomId })
        .select('title content authorId authorName roomId attachments viewCount commentCount tags status priority assignedAgentId createdAt updatedAt __v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      this.postModel.countDocuments({ roomId }).exec(),
    ]);
    return { data: await this.signAll(data), total };
  }

  async findById(id: string): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Post not found');
    }
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');
    
    // Incrementar contador de visitas de forma asíncrona
    this.postModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
    
    return (await this.signAttachments(post.toObject())) as unknown as PostDocument;
  }

  async findPopular(limit = 5): Promise<any[]> {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
    const data = await this.postModel.find().sort({ viewCount: -1, createdAt: -1 }).limit(safeLimit).lean().exec();
    return this.signAll(data);
  }

  async findRecent(limit = 10): Promise<any[]> {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const data = await this.postModel.find().sort({ createdAt: -1 }).limit(safeLimit).lean().exec();
    return this.signAll(data);
  }

  async search(query: string, limit = 20): Promise<PostDocument[]> {
    const data = await this.postModel.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .exec();
    return (await this.signAll(data)) as unknown as PostDocument[];
  }

  async incrementCommentCount(postId: string | Types.ObjectId) {
    await this.postModel.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }).exec();
  }

  async update(id: string, updatePostDto: any): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updatePostDto, { new: true })
      .exec();
    if (!updatedPost) throw new NotFoundException('Post not found');
    return updatedPost;
  }

  /**
   * Actualización protegida por propiedad/rol y control optimista de versión.
   */
  async updateWithAuth(
    id: string,
    updateDto: Record<string, any>,
    requesterId: string,
    isAdminOrAgent: boolean,
  ): Promise<PostDocument> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (String(post.authorId) !== String(requesterId) && !isAdminOrAgent) {
      throw new ForbiddenException('No tienes permiso para modificar este registro');
    }

    if (updateDto.expectedVersion !== undefined && post.__v !== updateDto.expectedVersion) {
      throw new ConflictException('Conflicto de concurrencia: el registro fue actualizado previamente');
    }

    const { expectedVersion: _v, authorId: _a, authorName: _an, ...safeFields } = updateDto;
    Object.assign(post, safeFields);
    return post.save();
  }

  async delete(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const result = await this.postModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Post not found');
    return { message: 'Post deleted successfully' };
  }

  /**
   * Eliminación protegida por propiedad o rol administrador.
   */
  async deleteWithAuth(id: string, requesterId: string, isAdmin: boolean): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Post not found');
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');

    if (String(post.authorId) !== String(requesterId) && !isAdmin) {
      throw new ForbiddenException('No tienes permiso para eliminar este registro');
    }

    await this.postModel.findByIdAndDelete(id).exec();
    return { message: 'Post deleted successfully' };
  }
}
