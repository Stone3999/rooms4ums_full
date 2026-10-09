import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class AuthController {
    private sql;
    private redis;
    private jwtService;
    private configService;
    private readonly logger;
    private readonly rpID;
    private readonly origin;
    constructor(sql: any, redis: Redis, jwtService: JwtService, configService: ConfigService);
    register(body: any): Promise<{
        message: string;
        user: any;
    }>;
    checkUser(identifier: string): Promise<{
        exists: boolean;
        hasBiometrics: any;
        username: any;
    }>;
    loginPassword(body: any): Promise<{
        token: string;
        user: {
            id: any;
            username: any;
            email: any;
        };
    }>;
    logout(req: any): Promise<{
        message: string;
    }>;
    getProfile(req: any): Promise<any>;
    generateRegOptions(req: any): Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
    verifyReg(req: any, body: any): Promise<{
        verified: boolean;
    }>;
    generateAuthOptions(identifier: string, req: any): Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
    verifyAuth(body: any, req: any): Promise<{
        verified: boolean;
        token: string;
        user: {
            id: any;
            username: any;
            email: any;
        };
    } | {
        verified: boolean;
        token?: undefined;
        user?: undefined;
    }>;
}
