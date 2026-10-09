import { AdminService } from './admin.service';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getUsers(): Promise<any>;
    createUser(body: any, req: any, ip: string): Promise<any>;
    updateUser(id: string, body: any, req: any, ip: string): Promise<any>;
    toggleUserStatus(id: string, isActive: boolean, req: any, ip: string): Promise<any>;
    getRoles(): Promise<any>;
    getAuditLogs(): Promise<any>;
}
