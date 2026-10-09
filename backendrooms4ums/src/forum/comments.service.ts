import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './comment.schema';
import { PostsService } from './posts.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    private postsService: PostsService,
  ) {}

  async create(createCommentDto: any): Promise<CommentDocument> {
    const createdComment = new this.commentModel(createCommentDto);
    const savedComment = await createdComment.save();
    
    // Incrementar el contador de comentarios en el Post
    await this.postsService.incrementCommentCount(createCommentDto.postId);
    
    return savedComment;
  }

  async findAllByPost(postId: string, page = 1, limit = 50): Promise<{ data: CommentDocument[], total: number }> {
    const skip = (page - 1) * limit;
    let query: any = { postId };

    // Intentar convertir a ObjectId si es un formato válido, si no, usar el string tal cual
    try {
      if (Types.ObjectId.isValid(postId)) {
        query = { postId: new Types.ObjectId(postId) };
      }
    } catch (e) {
      // Si falla la conversión, mantenemos la query original como string
    }

    const [data, total] = await Promise.all([
      this.commentModel.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).exec(),
      this.commentModel.countDocuments(query).exec(),
    ]);
    return { data, total };
  }

  async delete(id: string): Promise<any> {
    const result = await this.commentModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Comment not found');
    return { message: 'Comment deleted successfully' };
  }
}
