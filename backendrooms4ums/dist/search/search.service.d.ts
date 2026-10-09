import Redis from 'ioredis';
import { PostsService } from '../forum/posts.service';
export declare class SearchService {
    private sql;
    private redis;
    private postsService;
    constructor(sql: any, redis: Redis, postsService: PostsService);
    globalSearch(query: string, type?: string): Promise<any>;
}
