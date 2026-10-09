import { RoomsService } from './rooms.service';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    getActiveRooms(): Promise<any>;
    getRoomBySlug(slug: string): Promise<any>;
    getAllRooms(): Promise<any>;
    createRoom(data: any): Promise<any>;
    updateRoom(id: string, data: any): Promise<any>;
    deleteRoom(id: string): Promise<{
        message: string;
    }>;
}
