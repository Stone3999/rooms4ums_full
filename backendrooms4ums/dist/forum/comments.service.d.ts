import { Model } from 'mongoose';
import { CommentDocument } from './comment.schema';
import { PostsService } from './posts.service';
export declare class CommentsService {
    private commentModel;
    private postsService;
    constructor(commentModel: Model<CommentDocument>, postsService: PostsService);
    create(createCommentDto: any): Promise<CommentDocument>;
    findAllByPost(postId: string, page?: number, limit?: number): Promise<{
        data: CommentDocument[];
        total: number;
    }>;
    delete(id: string): Promise<any>;
}
