import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { StorageService } from '../storage/storage.service';
import { CreateCommentDto, CreatePostDto, UpdatePostDto } from './dto/forum.dto';
export declare class ForumController {
    private readonly postsService;
    private readonly commentsService;
    private readonly storageService;
    private readonly sql;
    private readonly logger;
    constructor(postsService: PostsService, commentsService: CommentsService, storageService: StorageService, sql: any);
    private getUserRole;
    getPopular(limit: number): Promise<any[]>;
    getRecent(limit: number): Promise<any[]>;
    storageHealth(): Promise<{
        exists: boolean;
        public: boolean;
        error: null;
        bucket: string;
        keyMode: "service_role" | "anon";
    } | {
        exists: boolean;
        public: null;
        error: any;
        bucket: string;
        keyMode: "service_role" | "anon";
    }>;
    getRoomPosts(roomId: string, page: number, limit: number): Promise<{
        data: any[];
        total: number;
    }>;
    getPost(id: string): Promise<import("./post.schema").PostDocument>;
    createPost(req: any, body: CreatePostDto, files: Express.Multer.File[], idempotencyKey?: string): Promise<import("./post.schema").PostDocument>;
    updatePost(req: any, id: string, body: UpdatePostDto): Promise<import("./post.schema").PostDocument>;
    assignAgent(req: any, id: string, assignedAgentId: string): Promise<import("./post.schema").PostDocument>;
    deletePost(req: any, id: string): Promise<void>;
    getComments(id: string, page: number, limit: number): Promise<{
        data: import("./comment.schema").CommentDocument[];
        total: number;
    }>;
    createComment(req: any, id: string, body: CreateCommentDto): Promise<import("./comment.schema").CommentDocument>;
}
