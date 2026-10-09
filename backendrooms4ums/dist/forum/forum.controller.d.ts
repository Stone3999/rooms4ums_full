import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { StorageService } from '../storage/storage.service';
export declare class ForumController {
    private readonly postsService;
    private readonly commentsService;
    private readonly storageService;
    private readonly logger;
    constructor(postsService: PostsService, commentsService: CommentsService, storageService: StorageService);
    getPopular(limit: number): Promise<import("./post.schema").PostDocument[]>;
    getRecent(limit: number): Promise<import("./post.schema").PostDocument[]>;
    getRoomPosts(roomId: string, page: number, limit: number): Promise<{
        data: import("./post.schema").PostDocument[];
        total: number;
    }>;
    getPost(id: string): Promise<import("./post.schema").PostDocument>;
    createPost(req: any, body: any, files: Express.Multer.File[]): Promise<import("./post.schema").PostDocument>;
    getComments(id: string, page: number, limit: number): Promise<{
        data: import("./comment.schema").CommentDocument[];
        total: number;
    }>;
    createComment(req: any, id: string, content: string): Promise<import("./comment.schema").CommentDocument>;
}
