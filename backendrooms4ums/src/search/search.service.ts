import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { PostsService } from '../forum/posts.service';

@Injectable()
export class SearchService {
  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
    @Inject('REDIS_CLIENT') private redis: Redis,
    private postsService: PostsService,
  ) {}

  async globalSearch(query: string, type?: string) {
    const results: any = {
      rooms: [],
      posts: [],
      voiceChannels: [],
      activities: [], // Placeholder
    };

    const searchTasks: Promise<void>[] = [];

    // Buscar en Rooms (Postgres)
    if (!type || type === 'rooms') {
      searchTasks.push(
        (async () => {
          results.rooms = await this.sql`
            SELECT id, name, slug, description, icon 
            FROM forums 
            WHERE (name ILIKE ${'%' + query + '%'} OR description ILIKE ${'%' + query + '%'})
            AND status != 'ARCHIVED'
            LIMIT 10
          `;
        })()
      );
    }

    // Buscar en Posts (Mongo)
    if (!type || type === 'posts') {
      searchTasks.push(
        (async () => {
          results.posts = await this.postsService.search(query, 10);
        })()
      );
    }

    // Buscar en Voice Chats (Redis)
    if (!type || type === 'voice_chats') {
      searchTasks.push(
        (async () => {
          const keys = await this.redis.keys('voice_channel:*');
          const channels: any[] = [];
          for (const key of keys) {
            const channel = await this.redis.hgetall(key);
            if (
              channel && 
              (channel.topic.toLowerCase().includes(query.toLowerCase()) || 
               channel.category.toLowerCase().includes(query.toLowerCase()))
            ) {
              channels.push(channel);
            }
          }
          results.voiceChannels = channels.slice(0, 10);
        })()
      );
    }

    await Promise.all(searchTasks);
    return results;
  }
}
