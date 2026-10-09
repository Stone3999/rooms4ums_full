export declare class RoomsService {
    private sql;
    constructor(sql: any);
    findAllActive(): Promise<any>;
    findBySlug(slug: string): Promise<any>;
    findAll(): Promise<any>;
    create(data: any): Promise<any>;
    update(id: string, data: any): Promise<any>;
    delete(id: string): Promise<{
        message: string;
    }>;
}
