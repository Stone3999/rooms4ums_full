import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PostsService } from './posts.service';

describe('PostsService (Prácticas 9, 10, 12 y 13)', () => {
  const validId = new Types.ObjectId().toHexString();
  let mockModel: any;
  let mockPushService: any;
  let mockStorageService: any;
  let service: PostsService;

  beforeEach(() => {
    mockPushService = {
      notifyNewPost: jest.fn().mockResolvedValue(undefined),
    };
    mockStorageService = {
      getAttachmentUrl: jest.fn(async (path: string) => `https://signed.test/${path}?token=abc`),
    };
    mockModel = jest.fn().mockImplementation((dto) => ({
      ...dto,
      save: jest.fn().mockResolvedValue({ _id: validId, ...dto }),
    }));
    mockModel.findOne = jest.fn();
    mockModel.findById = jest.fn();
    mockModel.findByIdAndDelete = jest.fn();

    service = new PostsService(mockModel, mockPushService, mockStorageService);
  });

  it('evita duplicar registros cuando se repite X-Idempotency-Key (Práctica 12)', async () => {
    const existingPost = { _id: validId, title: 'Existente', idempotencyKey: 'idem-1' };
    mockModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(existingPost) });

    const result = await service.create({
      title: 'Existente',
      content: 'Body',
      roomId: 'general',
      authorId: 'u1',
      idempotencyKey: 'idem-1',
    });

    expect(result).toBe(existingPost);
    expect(mockModel).not.toHaveBeenCalled();
  });

  it('rechaza actualización ajena con ForbiddenException 403 (Práctica 10 SEG-06)', async () => {
    mockModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: validId,
        authorId: 'user-B',
        __v: 0,
        save: jest.fn(),
      }),
    });

    await expect(
      service.updateWithAuth(validId, { status: 'EN_PROCESO' }, 'user-A', false),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza conflicto de concurrencia con ConflictException 409 (Práctica 9 DB-07)', async () => {
    mockModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: validId,
        authorId: 'user-A',
        __v: 2,
        save: jest.fn(),
      }),
    });

    await expect(
      service.updateWithAuth(validId, { status: 'RESUELTO', expectedVersion: 1 }, 'user-A', false),
    ).rejects.toThrow(ConflictException);
  });

  it('impide cambiar authorId en actualización propia (Práctica 10 SEG-09)', async () => {
    const postDoc: any = {
      _id: validId,
      authorId: 'user-A',
      authorName: 'UserA',
      status: 'PENDIENTE',
      __v: 0,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };
    mockModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(postDoc) });

    const updated = await service.updateWithAuth(
      validId,
      { status: 'EN_PROCESO', authorId: 'user-B', authorName: 'Impostor' },
      'user-A',
      false,
    );

    expect(updated.authorId).toBe('user-A');
    expect(updated.authorName).toBe('UserA');
    expect(updated.status).toBe('EN_PROCESO');
  });

  it('rechaza eliminación de post ajeno con ForbiddenException 403 (Práctica 10 SEG-07)', async () => {
    mockModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: validId, authorId: 'user-B' }),
    });

    await expect(service.deleteWithAuth(validId, 'user-A', false)).rejects.toThrow(ForbiddenException);
  });

  it('permite eliminar el post propio (Práctica 10 SEG-08)', async () => {
    mockModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ _id: validId, authorId: 'user-A' }),
    });
    mockModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: validId }) });

    await expect(service.deleteWithAuth(validId, 'user-A', false)).resolves.toEqual({
      message: 'Post deleted successfully',
    });
  });

  it('regenera URLs firmadas de los adjuntos al leer un post (Práctica 3/10)', async () => {
    const leanPost = {
      _id: validId,
      authorId: 'user-A',
      attachments: [
        { url: 'https://public.test/viejo.png', path: 'forum/1-foto.png', type: 'image/png', name: 'foto.png' },
      ],
    };
    mockModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([leanPost]) }),
        }),
      }),
    });

    const [post] = await service.findRecent(1);

    expect(mockStorageService.getAttachmentUrl).toHaveBeenCalledWith('forum/1-foto.png');
    expect(post.attachments[0].url).toBe('https://signed.test/forum/1-foto.png?token=abc');
    // La ruta interna se conserva: es la fuente de verdad, no la URL.
    expect(post.attachments[0].path).toBe('forum/1-foto.png');
  });
});
