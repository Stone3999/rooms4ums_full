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
let ForumController = ForumController_1 = class ForumController {
    postsService;
    commentsService;
    storageService;
    logger = new common_1.Logger(ForumController_1.name);
    constructor(postsService, commentsService, storageService) {
        this.postsService = postsService;
        this.commentsService = commentsService;
        this.storageService = storageService;
    }
    getPopular(limit) {
        return this.postsService.findPopular(limit || 5);
    }
    getRecent(limit) {
        return this.postsService.findRecent(limit || 10);
    }
    getRoomPosts(roomId, page, limit) {
        return this.postsService.findAllByRoom(roomId, page, limit);
    }
    getPost(id) {
        return this.postsService.findById(id);
    }
    async createPost(req, body, files) {
        const { title, content, roomId, tags } = body;
        const attachments = [];
        if (files && files.length > 0) {
            for (const file of files) {
                try {
                    const path = `forum/${Date.now()}-${file.originalname}`;
                    await this.storageService.uploadFile(file.buffer, path, file.mimetype);
                    const url = this.storageService.getFileUrl(path);
                    attachments.push({
                        url,
                        type: file.mimetype,
                        name: file.originalname,
                    });
                }
                catch (storageError) {
                    this.logger.error(`Error subiendo archivo ${file.originalname}: ${storageError.message}`);
                }
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
            });
        }
        catch (dbError) {
            this.logger.error(`Error en BD al crear post: ${dbError.message}`);
            throw new common_1.InternalServerErrorException('Error al guardar el post en la base de datos');
        }
    }
    getComments(id, page, limit) {
        return this.commentsService.findAllByPost(id, page, limit);
    }
    async createComment(req, id, content) {
        return this.commentsService.create({
            postId: id,
            content,
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Array]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "createPost", null);
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
    __param(2, (0, common_1.Body)('content')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], ForumController.prototype, "createComment", null);
exports.ForumController = ForumController = ForumController_1 = __decorate([
    (0, common_1.Controller)('forum'),
    __metadata("design:paramtypes", [posts_service_1.PostsService,
        comments_service_1.CommentsService,
        storage_service_1.StorageService])
], ForumController);
//# sourceMappingURL=forum.controller.js.map