import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './post.schema';
import { PushService } from '../push/push.service';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    private readonly pushService: PushService,
  ) {}

  /**
   * ÚNICO punto de creación de posts del sistema.
   *
   * Aquí se dispara el push porque TODOS los clientes (web Angular, app
   * Flutter o cualquier cliente futuro) pasan por aqui. De este modo el
   * requisito "sin importar de donde se publique un post" se cumple sin
   * tocar ninguna de las aplicaciones cliente.
   *
   * El envio es asincrono y su fallo jamas debe impedir crear el post.
   */
  async create(createPostDto: any): Promise<PostDocument> {
    const createdPost = await new this.postModel(createPostDto).save();

    this.pushService
      .notifyNewPost(createdPost, createdPost.authorId)
      .catch((err) => this.logger.error(`Fallo el push del post: ${err?.message ?? err}`));

    return createdPost;
  }

  async findAllByRoom(roomId: string, page = 1, limit = 20): Promise<{ data: PostDocument[], total: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.postModel.find({ roomId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.postModel.countDocuments({ roomId }).exec(),
    ]);
    return { data, total };
  }

  async findById(id: string): Promise<PostDocument> {
    const post = await this.postModel.findById(id).exec();
    if (!post) throw new NotFoundException('Post not found');
    
    // Incrementar contador de visitas de forma asíncrona
    this.postModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
    
    return post;
  }

  async findPopular(limit = 5): Promise<PostDocument[]> {
    return this.postModel.find().sort({ viewCount: -1, createdAt: -1 }).limit(limit).exec();
  }

  async findRecent(limit = 10): Promise<PostDocument[]> {
    return this.postModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async search(query: string, limit = 20): Promise<PostDocument[]> {
    return this.postModel.find(
      { $text: { $search: query } },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(limit)
    .exec();
  }

  async incrementCommentCount(postId: string | Types.ObjectId) {
    await this.postModel.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }).exec();
  }

  async update(id: string, updatePostDto: any): Promise<PostDocument> {
    const updatedPost = await this.postModel
      .findByIdAndUpdate(id, updatePostDto, { new: true })
      .exec();
    if (!updatedPost) throw new NotFoundException('Post not found');
    return updatedPost;
  }

  async delete(id: string): Promise<any> {
    const result = await this.postModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Post not found');
    return { message: 'Post deleted successfully' };
  }
}
