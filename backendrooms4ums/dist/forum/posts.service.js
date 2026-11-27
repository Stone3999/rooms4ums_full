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
var PostsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const post_schema_1 = require("./post.schema");
const push_service_1 = require("../push/push.service");
const storage_service_1 = require("../storage/storage.service");
let PostsService = PostsService_1 = class PostsService {
    postModel;
    pushService;
    storageService;
    logger = new common_1.Logger(PostsService_1.name);
    constructor(postModel, pushService, storageService) {
        this.postModel = postModel;
        this.pushService = pushService;
        this.storageService = storageService;
    }
    async signAttachments(post) {
        const attachments = post?.attachments;
        if (!Array.isArray(attachments) || attachments.length === 0)
            return post;
        const signed = await Promise.all(attachments.map(async (attachment) => {
            if (!attachment?.path)
                return attachment;
            try {
                const url = await this.storageService.getAttachmentUrl(attachment.path);
                return { ...attachment, url };
            }
            catch {
                return attachment;
            }
        }));
        return { ...post, attachments: signed };
    }
    async signAll(posts) {
        return Promise.all(posts.map((post) => this.signAttachments(post)));
    }
    async create(createPostDto) {
        if (createPostDto.idempotencyKey) {
            const existing = await this.postModel
                .findOne({ idempotencyKey: createPostDto.idempotencyKey })
                .exec();
            if (existing)
                return existing;
        }
        const createdPost = await new this.postModel(createPostDto).save();
        this.pushService
            .notifyNewPost(createdPost, createdPost.authorId)
            .catch((err) => this.logger.error(`Fallo el push del post: ${err?.message ?? err}`));
        return createdPost;
    }
    async findAllByRoom(roomId, page = 1, limit = 20) {
        const safePage = Math.max(1, Number(page) || 1);
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
        const skip = (safePage - 1) * safeLimit;
        const [data, total] = await Promise.all([
            this.postModel
                .find({ roomId })
                .select('title content authorId authorName roomId attachments viewCount commentCount tags status priority assignedAgentId createdAt updatedAt __v')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            this.postModel.countDocuments({ roomId }).exec(),
        ]);
        return { data: await this.signAll(data), total };
    }
    async findById(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Post not found');
        }
        const post = await this.postModel.findById(id).exec();
        if (!post)
            throw new common_1.NotFoundException('Post not found');
        this.postModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
        return (await this.signAttachments(post.toObject()));
    }
    async findPopular(limit = 5) {
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 5));
        const data = await this.postModel.find().sort({ viewCount: -1, createdAt: -1 }).limit(safeLimit).lean().exec();
        return this.signAll(data);
    }
    async findRecent(limit = 10) {
        const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
        const data = await this.postModel.find().sort({ createdAt: -1 }).limit(safeLimit).lean().exec();
        return this.signAll(data);
    }
    async search(query, limit = 20) {
        const data = await this.postModel.find({ $text: { $search: query } }, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .exec();
        return (await this.signAll(data));
    }
    async incrementCommentCount(postId) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }).exec();
    }
    async update(id, updatePostDto) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Post not found');
        const updatedPost = await this.postModel
            .findByIdAndUpdate(id, updatePostDto, { new: true })
            .exec();
        if (!updatedPost)
            throw new common_1.NotFoundException('Post not found');
        return updatedPost;
    }
    async updateWithAuth(id, updateDto, requesterId, isAdminOrAgent) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Post not found');
        const post = await this.postModel.findById(id).exec();
        if (!post)
            throw new common_1.NotFoundException('Post not found');
        if (String(post.authorId) !== String(requesterId) && !isAdminOrAgent) {
            throw new common_1.ForbiddenException('No tienes permiso para modificar este registro');
        }
        if (updateDto.expectedVersion !== undefined && post.__v !== updateDto.expectedVersion) {
            throw new common_1.ConflictException('Conflicto de concurrencia: el registro fue actualizado previamente');
        }
        const { expectedVersion: _v, authorId: _a, authorName: _an, ...safeFields } = updateDto;
        Object.assign(post, safeFields);
        return post.save();
    }
    async delete(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Post not found');
        const result = await this.postModel.findByIdAndDelete(id).exec();
        if (!result)
            throw new common_1.NotFoundException('Post not found');
        return { message: 'Post deleted successfully' };
    }
    async deleteWithAuth(id, requesterId, isAdmin) {
        if (!mongoose_2.Types.ObjectId.isValid(id))
            throw new common_1.NotFoundException('Post not found');
        const post = await this.postModel.findById(id).exec();
        if (!post)
            throw new common_1.NotFoundException('Post not found');
        if (String(post.authorId) !== String(requesterId) && !isAdmin) {
            throw new common_1.ForbiddenException('No tienes permiso para eliminar este registro');
        }
        await this.postModel.findByIdAndDelete(id).exec();
        return { message: 'Post deleted successfully' };
    }
};
exports.PostsService = PostsService;
exports.PostsService = PostsService = PostsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        push_service_1.PushService,
        storage_service_1.StorageService])
], PostsService);
//# sourceMappingURL=posts.service.js.map