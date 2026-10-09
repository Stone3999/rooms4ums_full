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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
let StorageService = class StorageService {
    configService;
    supabase;
    bucketName;
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const supabaseUrl = this.configService.get('SUPABASE_URL') || '';
        const supabaseKey = this.configService.get('SUPABASE_KEY') || '';
        this.bucketName = this.configService.get('SUPABASE_BUCKET_NAME') || 'avatars';
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    async uploadFile(file, path, contentType) {
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(path, file, {
            contentType,
            upsert: true,
        });
        if (error) {
            throw new Error(`Error subiendo archivo a Supabase: ${error.message}`);
        }
        return data;
    }
    getFileUrl(path) {
        const { data } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);
        return data.publicUrl;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map