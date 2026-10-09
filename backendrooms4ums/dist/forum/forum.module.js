"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForumModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const post_schema_1 = require("./post.schema");
const comment_schema_1 = require("./comment.schema");
const forum_controller_1 = require("./forum.controller");
const posts_service_1 = require("./posts.service");
const comments_service_1 = require("./comments.service");
const storage_module_1 = require("../storage/storage.module");
let ForumModule = class ForumModule {
};
exports.ForumModule = ForumModule;
exports.ForumModule = ForumModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: post_schema_1.Post.name, schema: post_schema_1.PostSchema },
                { name: comment_schema_1.Comment.name, schema: comment_schema_1.CommentSchema },
            ]),
            storage_module_1.StorageModule,
        ],
        controllers: [forum_controller_1.ForumController],
        providers: [posts_service_1.PostsService, comments_service_1.CommentsService],
        exports: [posts_service_1.PostsService, comments_service_1.CommentsService],
    })
], ForumModule);
//# sourceMappingURL=forum.module.js.map