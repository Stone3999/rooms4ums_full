import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class AdminGuard implements CanActivate {
    private sql;
    constructor(sql: any);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
