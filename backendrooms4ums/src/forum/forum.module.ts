import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './post.schema';
import { Comment, CommentSchema } from './comment.schema';
import { ForumController } from './forum.controller';
import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { StorageModule } from '../storage/storage.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
    ]),
    StorageModule,
    // Necesario para que PostsService pueda emitir el push al crear un post.
    PushModule,
  ],
  controllers: [ForumController],
  providers: [PostsService, CommentsService],
  exports: [PostsService, CommentsService],
})
export class ForumModule {}
