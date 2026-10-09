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
exports.DiagnosticController = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ioredis_1 = __importDefault(require("ioredis"));
const storage_service_1 = require("../storage/storage.service");
let DiagnosticController = class DiagnosticController {
    sql;
    mongoConnection;
    redis;
    storage;
    constructor(sql, mongoConnection, redis, storage) {
        this.sql = sql;
        this.mongoConnection = mongoConnection;
        this.redis = redis;
        this.storage = storage;
    }
    async runDiagnostic() {
        const results = {
            postgres: 'Pending',
            mongo: 'Pending',
            redis: 'Pending',
            storage: 'Pending',
        };
        try {
            const result = await this.sql `SELECT 1 as connected`;
            results.postgres = result[0].connected === 1 ? '✅ Connected (Supabase)' : '❌ Data mismatch';
        }
        catch (e) {
            results.postgres = `❌ Error: ${e.message}`;
        }
        try {
            const state = this.mongoConnection.readyState;
            results.mongo = state === 1 ? '✅ Connected (Atlas)' : `❌ State: ${state}`;
        }
        catch (e) {
            results.mongo = `❌ Error: ${e.message}`;
        }
        try {
            await this.redis.set('diagnostic-test', 'OK', 'EX', 10);
            const val = await this.redis.get('diagnostic-test');
            results.redis = val === 'OK' ? '✅ Connected (Upstash)' : '❌ Data mismatch';
        }
        catch (e) {
            results.redis = `❌ Error: ${e.message}`;
        }
        try {
            const buffer = Buffer.from('Test file content');
            const fileName = `test-${Date.now()}.txt`;
            await this.storage.uploadFile(buffer, fileName, 'text/plain');
            const url = this.storage.getFileUrl(fileName);
            results.storage = `✅ Connected (Supabase Storage) - URL: ${url}`;
        }
        catch (e) {
            results.storage = `❌ Error: ${e.message}`;
        }
        return results;
    }
};
exports.DiagnosticController = DiagnosticController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DiagnosticController.prototype, "runDiagnostic", null);
exports.DiagnosticController = DiagnosticController = __decorate([
    (0, common_1.Controller)('diagnostic'),
    __param(0, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __param(1, (0, mongoose_1.InjectConnection)()),
    __param(2, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [Object, mongoose_2.Connection,
        ioredis_1.default,
        storage_service_1.StorageService])
], DiagnosticController);
//# sourceMappingURL=diagnostic.controller.js.map