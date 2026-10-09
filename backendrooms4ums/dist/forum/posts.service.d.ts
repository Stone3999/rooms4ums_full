import { Model, Types } from 'mongoose';
import { PostDocument } from './post.schema';
export declare class PostsService {
    private postModel;
    constructor(postModel: Model<PostDocument>);
    create(createPostDto: any): Promise<PostDocument>;
    findAllByRoom(roomId: string, page?: number, limit?: number): Promise<{
        data: PostDocument[];
        total: number;
    }>;
    findById(id: string): Promise<PostDocument>;
    findPopular(limit?: number): Promise<PostDocument[]>;
    findRecent(limit?: number): Promise<PostDocument[]>;
    search(query: string, limit?: number): Promise<PostDocument[]>;
    incrementCommentCount(postId: string | Types.ObjectId): Promise<void>;
    update(id: string, updatePostDto: any): Promise<PostDocument>;
    delete(id: string): Promise<any>;
}
