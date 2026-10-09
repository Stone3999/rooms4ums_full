/// <reference types="multer" />
import { 
  Controller, Get, Post, Body, Param, Query, UseGuards, 
  UseInterceptors, UploadedFiles, Request, NotFoundException, InternalServerErrorException, Logger
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { StorageService } from '../storage/storage.service';

@Controller('forum')
export class ForumController {
  private readonly logger = new Logger(ForumController.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly storageService: StorageService,
  ) {}

  @Get('popular')
  getPopular(@Query('limit') limit: number) {
    return this.postsService.findPopular(limit || 5);
  }

  @Get('recent')
  getRecent(@Query('limit') limit: number) {
    return this.postsService.findRecent(limit || 10);
  }

  @Get('rooms/:roomId/posts')
  getRoomPosts(
    @Param('roomId') roomId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.postsService.findAllByRoom(roomId, page, limit);
  }

  @Get('posts/:id')
  getPost(@Param('id') id: string) {
    return this.postsService.findById(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('posts')
  @UseInterceptors(FilesInterceptor('files', 5))
  async createPost(
    @Request() req: any,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    const { title, content, roomId, tags } = body;
    const attachments: { url: string; type: string; name: string }[] = [];

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
        } catch (storageError: any) {
          this.logger.error(`Error subiendo archivo ${file.originalname}: ${storageError.message}`);
          // Continuamos para intentar guardar el post aunque falle la imagen
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
    } catch (dbError: any) {
      this.logger.error(`Error en BD al crear post: ${dbError.message}`);
      throw new InternalServerErrorException('Error al guardar el post en la base de datos');
    }
  }

  @Get('posts/:id/comments')
  getComments(
    @Param('id') id: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.commentsService.findAllByPost(id, page, limit);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('posts/:id/comments')
  async createComment(
    @Request() req: any,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.commentsService.create({
      postId: id,
      content,
      authorId: req.user.userId,
      authorName: req.user.username,
    });
  }
}
