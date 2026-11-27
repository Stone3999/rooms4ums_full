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
var ForumController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const passport_1 = require("@nestjs/passport");
const posts_service_1 = require("./posts.service");
const comments_service_1 = require("./comments.service");
const storage_service_1 = require("../storage/storage.service");
const forum_dto_1 = require("./dto/forum.dto");
let ForumController = ForumController_1 = class ForumController {
    postsService;
    commentsService;
    storageService;
    sql;
    logger = new common_1.Logger(ForumController_1.name);
    constructor(postsService, commentsService, storageService, sql) {
        this.postsService = postsService;
        this.commentsService = commentsService;
        this.storageService = storageService;
        this.sql = sql;
    }
    async getUserRole(userId) {
        try {
            const rows = await this.sql `
        SELECT r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ${userId}
      `;
            return (rows?.[0]?.role_name ?? 'USER').toString().toUpperCase();
        }
        catch {
            return 'USER';
        }
    }
    getPopular(limit) {
        return this.postsService.findPopular(limit || 5);
    }
    getRecent(limit) {
        return this.postsService.findRecent(limit || 10);
    }
    storageHealth() {
        return this.storageService.health();
    }
    getRoomPosts(roomId, page, limit) {
        return this.postsService.findAllByRoom(roomId, page, limit);
    }
    getPost(id) {
        return this.postsService.findById(id);
    }
    async createPost(req, body, files, idempotencyKey) {
        const { title, content, roomId, tags, status, priority } = body;
        const attachments = [];
        let uploadError = null;
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const safeName = file.originalname.replace(/[^\w.\-]+/g, '_');
                    const path = `forum/${Date.now()}-${safeName}`;
                    await this.storageService.uploadFile(file.buffer, path, file.mimetype);
                    const url = await this.storageService.getAttachmentUrl(path);
                    attachments.push({
                        url,
                        path,
                        type: file.mimetype,
                        name: file.originalname,
                    });
                }
                catch (storageError) {
                    if (!uploadError)
                        uploadError = storageError.message;
                    this.logger.error(`Error subiendo archivo ${file.originalname}: ${storageError.message}`);
                }
            }
            if (attachments.length === 0) {
                throw new common_1.BadRequestException(`No se pudo subir ningún archivo. ${uploadError ?? 'Revisa la configuración de Storage.'}`);
            }
        }
        try {
            return await this.postsService.create({
                title,
                content,
                roomId,
                authorId: req.user.userId,
                authorName: req.user.username,
                attachments,
                tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
                status: status || 'PENDIENTE',
                priority: priority || 'MEDIA',
                idempotencyKey: idempotencyKey?.trim() || undefined,
            });
        }
        catch (dbError) {
            this.logger.error(`Error en BD al crear post: ${dbError.message}`);
            throw new common_1.InternalServerErrorException('Error al guardar el post en la base de datos');
        }
    }
    async updatePost(req, id, body) {
        const role = await this.getUserRole(req.user.userId);
        const isPrivileged = role === 'ADMIN' || role === 'AGENTE';
        return this.postsService.updateWithAuth(id, body, req.user.userId, isPrivileged);
    }
    async assignAgent(req, id, assignedAgentId) {
        const role = await this.getUserRole(req.user.userId);
        if (role !== 'ADMIN') {
            throw new common_1.ForbiddenException('Solo el administrador puede reasignar casos');
        }
        return this.postsService.update(id, {
            assignedAgentId,
            status: 'EN_PROCESO',
        });
    }
    async deletePost(req, id) {
        const role = await this.getUserRole(req.user.userId);
        await this.postsService.deleteWithAuth(id, req.user.userId, role === 'ADMIN');
    }
    getComments(id, page, limit) {
        return this.commentsService.findAllByPost(id, page, limit);
    }
    async createComment(req, id, body) {
        return this.commentsService.create({
            postId: id,
            content: body.content,
            authorId: req.user.userId,
            authorName: req.user.username,
        });
    }
};
exports.ForumController = ForumController;
__decorate([
    (0, common_1.Get)('popular'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getPopular", null);
__decorate([
    (0, common_1.Get)('recent'),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getRecent", null);
__decorate([
    (0, common_1.Get)('storage/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "storageHealth", null);
__decorate([
    (0, common_1.Get)('rooms/:roomId/posts'),
    __param(0, (0, common_1.Param)('roomId')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getRoomPosts", null);
__decorate([
    (0, common_1.Get)('posts/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getPost", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)('posts'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 5)),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFiles)()),
    __param(3, (0, common_1.Headers)('x-idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, forum_dto_1.CreatePostDto, Array, String]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "createPost", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Patch)('posts/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, forum_dto_1.UpdatePostDto]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "updatePost", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)('posts/:id/assign'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('assignedAgentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "assignAgent", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Delete)('posts/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "deletePost", null);
__decorate([
    (0, common_1.Get)('posts/:id/comments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Number]),
    __metadata("design:returntype", void 0)
], ForumController.prototype, "getComments", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)('posts/:id/comments'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, forum_dto_1.CreateCommentDto]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "createComment", null);
exports.ForumController = ForumController = ForumController_1 = __decorate([
    (0, common_1.Controller)('forum'),
    __param(3, (0, common_1.Inject)('DATABASE_CONNECTION')),
    __metadata("design:paramtypes", [posts_service_1.PostsService,
        comments_service_1.CommentsService,
        storage_service_1.StorageService, Object])
], ForumController);
//# sourceMappingURL=forum.controller.js.map