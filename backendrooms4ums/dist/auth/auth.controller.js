"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const server_1 = require("@simplewebauthn/server");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let AuthController = AuthController_1 = class AuthController {
    sql;
    redis;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthController_1.name);
    rpID;
    origin;
    constructor(sql, redis, jwtService, configService) {
        this.sql = sql;
        this.redis = redis;
        this.jwtService = jwtService;
        this.configService = configService;
        this.rpID = this.configService.get('RP_ID') || 'localhost';
        this.origin = this.configService.get('ORIGIN') || `http://localhost:4200`;
        this.logger.log(`WebAuthn configured with RP_ID: ${this.rpID} and Origin: ${this.origin}`);
    }
    async register(body) {
        const { username, email, password, birth_date, country } = body;
        if (!username || !email || !password || !birth_date || !country) {
            throw new common_1.BadRequestException('Faltan campos obligatorios');
        }
        try {
            const existingUsers = await this.sql `
        SELECT id FROM users WHERE email = ${email} OR username = ${username}
      `;
            if (existingUsers.length > 0) {
                throw new common_1.ConflictException('El nombre de usuario o correo ya están registrados');
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = await this.sql `
        INSERT INTO users (username, email, password, birth_date, country, status)
        VALUES (${username}, ${email}, ${hashedPassword}, ${birth_date}, ${country}, 'OFFLINE')
        RETURNING id, username, email
      `;
            return { message: 'Usuario creado exitosamente', user: newUser[0] };
        }
        catch (e) {
            if (e instanceof common_1.ConflictException)
                throw e;
            throw new common_1.BadRequestException(e.message || 'Error al crear el usuario');
        }
    }
    async checkUser(identifier) {
        const users = await this.sql `
      SELECT users.id, email, username, 
             COALESCE(creds.has_biometrics, false) as has_biometrics
      FROM users 
      LEFT JOIN (
        SELECT user_id, COUNT(*) > 0 as has_biometrics 
        FROM user_credentials 
        GROUP BY user_id
      ) creds ON users.id = creds.user_id
      WHERE email = ${identifier} OR username = ${identifier}
      LIMIT 1
    `;
        if (users.length === 0)
            throw new common_1.BadRequestException('User not found');
        return { exists: true, hasBiometrics: users[0].has_biometrics, username: users[0].username };
    }
    async loginPassword(body) {
        const { identifier, password } = body;
        const users = await this.sql `
      SELECT id, email, username, password FROM users 
      WHERE email = ${identifier} OR username = ${identifier}
      LIMIT 1
    `;
        if (users.length === 0)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const user = users[0];
        const isPasswordMatching = await bcrypt.compare(password, user.password);
        if (!isPasswordMatching)
            throw new common_1.UnauthorizedException('Credenciales inválidas');
        const payload = { sub: user.id, username: user.username, email: user.email };
        const token = this.jwtService.sign(payload);
        try {
            const redisPromise = this.redis.set(`session:${user.id}`, token, 'EX', 86400);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 3000));
            await Promise.race([redisPromise, timeoutPromise]);
        }
        catch (err) {
            this.logger.warn(`No se pudo guardar la sesión en Redis: ${err.message}`);
        }
        return {
            token,
            user: { id: user.id, username: user.username, email: user.email }
        };
    }
    async logout(req) {
        const userId = req.user.userId;
        await this.redis.del(`session:${userId}`);
        return { message: 'Sesión cerrada exitosamente' };
    }
    async getProfile(req) {
        const userId = req.user.userId;
        const users = await this.sql `
      SELECT id, email, username, bio, role, status, created_at,
             COALESCE(creds.has_biometrics, false) as has_biometrics
      FROM users 
      LEFT JOIN (
        SELECT user_id, COUNT(*) > 0 as has_biometrics 
        FROM user_credentials 
        GROUP BY user_id
      ) creds ON users.id = creds.user_id
      WHERE users.id = ${userId}
    `;
        if (users.length === 0)
            throw new common_1.BadRequestException('User not found');
        return users[0];
    }
    async generateRegOptions(req) {
        const userId = req.user.userId;
        const users = await this.sql `SELECT id, email, username FROM users WHERE id = ${userId}`;
        const user = users[0];
        const userCredentials = await this.sql `SELECT credential_id FROM user_credentials WHERE user_id = ${userId}`;
        const origin = this.configService.get('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
        const originUrl = new URL(origin);
        let rpID = this.configService.get('RP_ID') || originUrl.hostname;
        if (rpID.startsWith('http')) {
            rpID = new URL(rpID).hostname;
        }
        return await (0, server_1.generateRegistrationOptions)({
            rpName: 'ROOMS4UMS SYS',
            rpID: rpID,
            userID: Buffer.from(user.id),
            userName: user.email,
            userDisplayName: user.username,
            attestationType: 'none',
            excludeCredentials: userCredentials.map((c) => ({ id: c.credential_id, type: 'public-key' })),
            authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred', authenticatorAttachment: 'platform' },
        });
    }
    async verifyReg(req, body) {
        const userId = req.user.userId;
        const { registrationResponse, expectedChallenge } = body;
        const origin = this.configService.get('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
        const originUrl = new URL(origin);
        let rpID = this.configService.get('RP_ID') || originUrl.hostname;
        if (rpID.startsWith('http')) {
            rpID = new URL(rpID).hostname;
        }
        const verification = await (0, server_1.verifyRegistrationResponse)({
            response: registrationResponse,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
        });
        if (verification.verified && verification.registrationInfo) {
            const { id, publicKey, counter } = verification.registrationInfo.credential;
            await this.sql `
        INSERT INTO user_credentials (user_id, public_key, credential_id, counter, device_type)
        VALUES (${userId}, ${Buffer.from(publicKey).toString('base64')}, ${id}, ${counter}, 'platform')
      `;
            return { verified: true };
        }
        return { verified: false };
    }
    async generateAuthOptions(identifier, req) {
        const users = await this.sql `SELECT id FROM users WHERE email = ${identifier} OR username = ${identifier}`;
        if (users.length === 0)
            throw new common_1.BadRequestException('User not found');
        const userCredentials = await this.sql `SELECT credential_id FROM user_credentials WHERE user_id = ${users[0].id}`;
        const origin = this.configService.get('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
        const originUrl = new URL(origin);
        let rpID = this.configService.get('RP_ID') || originUrl.hostname;
        if (rpID.startsWith('http')) {
            rpID = new URL(rpID).hostname;
        }
        return await (0, server_1.generateAuthenticationOptions)({
            rpID: rpID,
            allowCredentials: userCredentials.map((c) => ({ id: c.credential_id, type: 'public-key' })),
            userVerification: 'preferred',
        });
    }
    async verifyAuth(body, req) {
        const { identifier, authenticationResponse, expectedChallenge } = body;
        const users = await this.sql `SELECT id, email, username FROM users WHERE email = ${identifier} OR username = ${identifier}`;
        if (users.length === 0)
            throw new common_1.BadRequestException('User not found');
        const user = users[0];
        const credentials = await this.sql `SELECT * FROM user_credentials WHERE credential_id = ${authenticationResponse.id}`;
        if (credentials.length === 0)
            throw new common_1.BadRequestException('Credential not found');
        const dbCredential = credentials[0];
        const origin = this.configService.get('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
        const originUrl = new URL(origin);
        let rpID = this.configService.get('RP_ID') || originUrl.hostname;
        if (rpID.startsWith('http')) {
            rpID = new URL(rpID).hostname;
        }
        const verification = await (0, server_1.verifyAuthenticationResponse)({
            response: authenticationResponse,
            expectedChallenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: { id: dbCredential.credential_id, publicKey: Buffer.from(dbCredential.public_key, 'base64'), counter: dbCredential.counter },
        });
        if (verification.verified) {
            await this.sql `UPDATE user_credentials SET counter = ${verification.authenticationInfo.newCounter} WHERE id = ${dbCredential.id}`;
            const token = this.jwtService.sign({ sub: user.id, username: user.username, email: user.email });
            try {
                const redisPromise = this.redis.set(`session:${user.id}`, token, 'EX', 86400);
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 3000));
                await Promise.race([redisPromise, timeoutPromise]);
            }
            catch (err) {
                this.logger.warn(`No se pudo guardar la sesión en Redis (WebAuthn): ${err.message}`);
            }
            return { verified: true, token, user: { id: user.id, username: user.username, email: user.email } };
        }
        return { verified: false };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('check-user'),
    __param(0, (0, common_1.Body)('identifier')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "checkUser", null);
__decorate([
    (0, common_1.Post)('login-password'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginPassword", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)('generate-registration-options'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "generateRegOptions", null);
__decorate([
    (0, common_1.Post)('verify-registration'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyReg", null);
__decorate([
    (0, common_1.Post)('generate-authentication-options'),
    __param(0, (0, common_1.Body)('identifier')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "generateAuthOptions", null);
__decorate([
    (0, common_1.Post)('verify-authentication'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyAuth", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, common_1.Controller)('auth'),
    __param(0, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __param(1, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [Object, ioredis_1.default,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map