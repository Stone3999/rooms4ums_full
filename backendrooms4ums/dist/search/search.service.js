"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = __importDefault(require("ioredis"));
const posts_service_1 = require("../forum/posts.service");
let SearchService = class SearchService {
    sql;
    redis;
    postsService;
    constructor(sql, redis, postsService) {
        this.sql = sql;
        this.redis = redis;
        this.postsService = postsService;
    }
    async globalSearch(query, type) {
        const results = {
            rooms: [],
            posts: [],
            voiceChannels: [],
            activities: [],
        };
        const searchTasks = [];
        if (!type || type === 'rooms') {
            searchTasks.push((async () => {
                results.rooms = await this.sql `
            SELECT id, name, slug, description, icon 
            FROM forums 
            WHERE (name ILIKE ${'%' + query + '%'} OR description ILIKE ${'%' + query + '%'})
            AND status != 'ARCHIVED'
            LIMIT 10
          `;
            })());
        }
        if (!type || type === 'posts') {
            searchTasks.push((async () => {
                results.posts = await this.postsService.search(query, 10);
            })());
        }
        if (!type || type === 'voice_chats') {
            searchTasks.push((async () => {
                const keys = await this.redis.keys('voice_channel:*');
                const channels = [];
                for (const key of keys) {
                    const channel = await this.redis.hgetall(key);
                    if (channel &&
                        (channel.topic.toLowerCase().includes(query.toLowerCase()) ||
                            channel.category.toLowerCase().includes(query.toLowerCase()))) {
                        channels.push(channel);
                    }
                }
                results.voiceChannels = channels.slice(0, 10);
            })());
        }
        await Promise.all(searchTasks);
        return results;
    }
};
exports.SearchService = SearchService;
exports.SearchService = SearchService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __param(1, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [Object, ioredis_1.default,
        posts_service_1.PostsService])
], SearchService);
//# sourceMappingURL=search.service.js.map