/// <reference types="multer" />
import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Headers, Inject,
  UseGuards, UseInterceptors, UploadedFiles, Request, InternalServerErrorException,
  BadRequestException, ForbiddenException, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { PostsService } from './posts.service';
import { CommentsService } from './comments.service';
import { StorageService } from '../storage/storage.service';
import { CreateCommentDto, CreatePostDto, UpdatePostDto } from './dto/forum.dto';

@Controller('forum')
export class ForumController {
  private readonly logger = new Logger(ForumController.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
    private readonly storageService: StorageService,
    @Inject('DATABASE_CONNECTION') private readonly sql: any,
  ) {}

  private async getUserRole(userId: string): Promise<string> {
    try {
      const rows = await this.sql`
        SELECT r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ${userId}
      `;
      return (rows?.[0]?.role_name ?? 'USER').toString().toUpperCase();
    } catch {
      return 'USER';
    }
  }

  @Get('popular')
  getPopular(@Query('limit') limit: number) {
    return this.postsService.findPopular(limit || 5);
  }

  @Get('recent')
  getRecent(@Query('limit') limit: number) {
    return this.postsService.findRecent(limit || 10);
  }

  /// Diagnóstico del almacenamiento: bucket, tipo de clave y si es público.
  /// Abrir en el navegador: /api/forum/storage/health
  @Get('storage/health')
  storageHealth() {
    return this.storageService.health();
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
    @Body() body: CreatePostDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    const { title, content, roomId, tags, status, priority } = body;
    const attachments: { url: string; path?: string; type: string; name: string }[] = [];
    let uploadError: string | null = null;

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
        } catch (storageError: any) {
          if (!uploadError) uploadError = storageError.message;
          this.logger.error(`Error subiendo archivo ${file.originalname}: ${storageError.message}`);
        }
      }

      // Si el usuario adjuntó archivos y NINGUNO se pudo subir, guardar el
      // post sin imágenes solo confunde. Se devuelve el motivo real.
      if (attachments.length === 0) {
        throw new BadRequestException(
          `No se pudo subir ningún archivo. ${uploadError ?? 'Revisa la configuración de Storage.'}`,
        );
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
    } catch (dbError: any) {
      this.logger.error(`Error en BD al crear post: ${dbError.message}`);
      throw new InternalServerErrorException('Error al guardar el post en la base de datos');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('posts/:id')
  async updatePost(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdatePostDto,
  ) {
    const role = await this.getUserRole(req.user.userId);
    const isPrivileged = role === 'ADMIN' || role === 'AGENTE';
    return this.postsService.updateWithAuth(id, body, req.user.userId, isPrivileged);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('posts/:id/assign')
  async assignAgent(
    @Request() req: any,
    @Param('id') id: string,
    @Body('assignedAgentId') assignedAgentId: string,
  ) {
    const role = await this.getUserRole(req.user.userId);
    if (role !== 'ADMIN') {
      throw new ForbiddenException('Solo el administrador puede reasignar casos');
    }
    return this.postsService.update(id, {
      assignedAgentId,
      status: 'EN_PROCESO',
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(@Request() req: any, @Param('id') id: string) {
    const role = await this.getUserRole(req.user.userId);
    await this.postsService.deleteWithAuth(id, req.user.userId, role === 'ADMIN');
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
    @Body() body: CreateCommentDto,
  ) {
    return this.commentsService.create({
      postId: id,
      content: body.content,
      authorId: req.user.userId,
      authorName: req.user.username,
    });
  }
}
