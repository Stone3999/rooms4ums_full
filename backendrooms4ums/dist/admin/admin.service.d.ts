export declare class AdminService {
    private sql;
    constructor(sql: any);
    getAllUsers(): Promise<any>;
    createUser(data: any, adminId: string, ip: string): Promise<any>;
    updateUser(id: string, data: any, adminId: string, ip: string): Promise<any>;
    toggleUserActive(id: string, isActive: boolean, adminId: string, ip: string): Promise<any>;
    getAllRoles(): Promise<any>;
    getAuditLogs(): Promise<any>;
    private logAudit;
}
