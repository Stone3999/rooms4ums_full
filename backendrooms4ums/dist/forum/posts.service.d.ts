import { Model, Types } from 'mongoose';
import { PostDocument } from './post.schema';
import { PushService } from '../push/push.service';
import { StorageService } from '../storage/storage.service';
export declare class PostsService {
    private postModel;
    private readonly pushService;
    private readonly storageService;
    private readonly logger;
    constructor(postModel: Model<PostDocument>, pushService: PushService, storageService: StorageService);
    private signAttachments;
    private signAll;
    create(createPostDto: any): Promise<PostDocument>;
    findAllByRoom(roomId: string, page?: number, limit?: number): Promise<{
        data: any[];
        total: number;
    }>;
    findById(id: string): Promise<PostDocument>;
    findPopular(limit?: number): Promise<any[]>;
    findRecent(limit?: number): Promise<any[]>;
    search(query: string, limit?: number): Promise<PostDocument[]>;
    incrementCommentCount(postId: string | Types.ObjectId): Promise<void>;
    update(id: string, updatePostDto: any): Promise<PostDocument>;
    updateWithAuth(id: string, updateDto: Record<string, any>, requesterId: string, isAdminOrAgent: boolean): Promise<PostDocument>;
    delete(id: string): Promise<any>;
    deleteWithAuth(id: string, requesterId: string, isAdmin: boolean): Promise<any>;
}
