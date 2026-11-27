import { RoomsController } from './rooms.controller';

describe('RoomsController', () => {
  it('delega el listado público en RoomsService (RF-02)', async () => {
    const rooms = [{ slug: 'general' }];
    const roomsService = { findAllActive: jest.fn().mockResolvedValue(rooms) };
    const controller = new RoomsController(roomsService as any);

    await expect(controller.getActiveRooms()).resolves.toBe(rooms);
    expect(roomsService.findAllActive).toHaveBeenCalledTimes(1);
  });

  it('delega la consulta por slug', async () => {
    const room = { slug: 'general' };
    const roomsService = { findBySlug: jest.fn().mockResolvedValue(room) };
    const controller = new RoomsController(roomsService as any);

    await expect(controller.getRoomBySlug('general')).resolves.toBe(room);
    expect(roomsService.findBySlug).toHaveBeenCalledWith('general');
  });
});
