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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const comment_schema_1 = require("./comment.schema");
const posts_service_1 = require("./posts.service");
let CommentsService = class CommentsService {
    commentModel;
    postsService;
    constructor(commentModel, postsService) {
        this.commentModel = commentModel;
        this.postsService = postsService;
    }
    async create(createCommentDto) {
        const createdComment = new this.commentModel(createCommentDto);
        const savedComment = await createdComment.save();
        await this.postsService.incrementCommentCount(createCommentDto.postId);
        return savedComment;
    }
    async findAllByPost(postId, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        let query = { postId };
        try {
            if (mongoose_2.Types.ObjectId.isValid(postId)) {
                query = { postId: new mongoose_2.Types.ObjectId(postId) };
            }
        }
        catch (e) {
        }
        const [data, total] = await Promise.all([
            this.commentModel.find(query).sort({ createdAt: 1 }).skip(skip).limit(limit).exec(),
            this.commentModel.countDocuments(query).exec(),
        ]);
        return { data, total };
    }
    async delete(id) {
        const result = await this.commentModel.findByIdAndDelete(id).exec();
        if (!result)
            throw new common_1.NotFoundException('Comment not found');
        return { message: 'Comment deleted successfully' };
    }
};
exports.CommentsService = CommentsService;
exports.CommentsService = CommentsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(comment_schema_1.Comment.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        posts_service_1.PostsService])
], CommentsService);
//# sourceMappingURL=comments.service.js.map