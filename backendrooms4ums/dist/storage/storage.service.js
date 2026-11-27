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
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const supabase_js_1 = require("@supabase/supabase-js");
let StorageService = StorageService_1 = class StorageService {
    configService;
    logger = new common_1.Logger(StorageService_1.name);
    supabase;
    bucketName;
    keyMode = 'anon';
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const supabaseUrl = this.configService.get('SUPABASE_URL') || '';
        const serviceKey = this.configService.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const publicKey = this.configService.get('SUPABASE_KEY') || '';
        const supabaseKey = serviceKey || publicKey;
        this.keyMode = serviceKey ? 'service_role' : 'anon';
        this.bucketName = this.configService.get('SUPABASE_BUCKET_NAME') || 'avatars';
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        this.logger.log(`Storage listo: bucket="${this.bucketName}" clave=${this.keyMode}. ` +
            (this.keyMode === 'anon'
                ? 'OJO: con la clave anon los uploads fallan si el bucket no tiene policy de INSERT.'
                : ''));
        void this.checkBucket();
    }
    async checkBucket() {
        try {
            const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
            if (error) {
                this.logger.error(`No se pudo leer el bucket "${this.bucketName}": ${error.message}. ` +
                    'Créalo en Supabase > Storage (debe ser público para ver las imágenes).');
                return;
            }
            this.logger.log(`Bucket "${this.bucketName}" encontrado. public=${data.public}`);
            if (!data.public) {
                this.logger.warn(`El bucket "${this.bucketName}" es privado: las URLs públicas devolverán 403 y las imágenes no se verán.`);
            }
        }
        catch (e) {
            this.logger.warn(`No se pudo verificar el bucket: ${e?.message ?? e}`);
        }
    }
    async uploadFile(file, path, contentType) {
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(path, file, {
            contentType,
            upsert: true,
        });
        if (error) {
            throw new Error(this.explain(error.message));
        }
        return data;
    }
    explain(message) {
        const lower = message.toLowerCase();
        if (lower.includes('bucket not found')) {
            return `El bucket "${this.bucketName}" no existe en Supabase Storage. Créalo como público o define SUPABASE_BUCKET_NAME.`;
        }
        if (lower.includes('row-level security') || lower.includes('violates row-level') || lower.includes('unauthorized')) {
            return `La clave de Supabase no tiene permiso de escritura (${this.keyMode}). Define SUPABASE_SERVICE_ROLE_KEY en Render.`;
        }
        if (lower.includes('exceeded') || lower.includes('too large')) {
            return `El archivo supera el límite del bucket: ${message}`;
        }
        return `Error subiendo archivo a Supabase: ${message}`;
    }
    getFileUrl(path) {
        const { data } = this.supabase.storage
            .from(this.bucketName)
            .getPublicUrl(path);
        return data.publicUrl;
    }
    async getAttachmentUrl(path, expiresInSeconds = 3600) {
        const useSigned = this.configService.get('SUPABASE_SIGNED_URLS') !== 'false';
        if (!useSigned)
            return this.getFileUrl(path);
        const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(path, expiresInSeconds);
        if (error || !data?.signedUrl) {
            this.logger.warn(`No se pudo firmar URL para ${path}: ${error?.message ?? 'sin dato'}`);
            return this.getFileUrl(path);
        }
        return data.signedUrl;
    }
    async health() {
        const base = { bucket: this.bucketName, keyMode: this.keyMode };
        try {
            const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
            if (error) {
                return { ...base, exists: false, public: null, error: this.explain(error.message) };
            }
            return { ...base, exists: true, public: data.public, error: null };
        }
        catch (e) {
            return { ...base, exists: false, public: null, error: e?.message ?? String(e) };
        }
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map