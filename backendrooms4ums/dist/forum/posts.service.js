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
exports.PostsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const post_schema_1 = require("./post.schema");
let PostsService = class PostsService {
    postModel;
    constructor(postModel) {
        this.postModel = postModel;
    }
    async create(createPostDto) {
        const createdPost = new this.postModel(createPostDto);
        return createdPost.save();
    }
    async findAllByRoom(roomId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.postModel.find({ roomId }).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
            this.postModel.countDocuments({ roomId }).exec(),
        ]);
        return { data, total };
    }
    async findById(id) {
        const post = await this.postModel.findById(id).exec();
        if (!post)
            throw new common_1.NotFoundException('Post not found');
        this.postModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } }).exec();
        return post;
    }
    async findPopular(limit = 5) {
        return this.postModel.find().sort({ viewCount: -1, createdAt: -1 }).limit(limit).exec();
    }
    async findRecent(limit = 10) {
        return this.postModel.find().sort({ createdAt: -1 }).limit(limit).exec();
    }
    async search(query, limit = 20) {
        return this.postModel.find({ $text: { $search: query } }, { score: { $meta: 'textScore' } })
            .sort({ score: { $meta: 'textScore' } })
            .limit(limit)
            .exec();
    }
    async incrementCommentCount(postId) {
        await this.postModel.updateOne({ _id: postId }, { $inc: { commentCount: 1 } }).exec();
    }
    async update(id, updatePostDto) {
        const updatedPost = await this.postModel
            .findByIdAndUpdate(id, updatePostDto, { new: true })
            .exec();
        if (!updatedPost)
            throw new common_1.NotFoundException('Post not found');
        return updatedPost;
    }
    async delete(id) {
        const result = await this.postModel.findByIdAndDelete(id).exec();
        if (!result)
            throw new common_1.NotFoundException('Post not found');
        return { message: 'Post deleted successfully' };
    }
};
exports.PostsService = PostsService;
exports.PostsService = PostsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(post_schema_1.Post.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], PostsService);
//# sourceMappingURL=posts.service.js.map