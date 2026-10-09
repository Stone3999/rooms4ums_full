import { SearchService } from './search.service';
export declare class SearchController {
    private readonly searchService;
    constructor(searchService: SearchService);
    search(query: string, type: string): Promise<any> | {
        rooms: never[];
        posts: never[];
        voiceChannels: never[];
        activities: never[];
    };
}
