import { AdminController } from './admin.controller';

describe('AdminController', () => {
  it('delega el listado de usuarios en AdminService', async () => {
    const users = [{ id: 'u1' }];
    const adminService = { getAllUsers: jest.fn().mockResolvedValue(users) };
    const controller = new AdminController(adminService as any);

    await expect(controller.getUsers()).resolves.toBe(users);
    expect(adminService.getAllUsers).toHaveBeenCalledTimes(1);
  });

  it('toma el administrador del token y no del cuerpo (SEG-09)', async () => {
    const adminService = { createUser: jest.fn().mockResolvedValue({ id: 'nuevo' }) };
    const controller = new AdminController(adminService as any);
    const body = { username: 'nuevo', email: 'n@test.mx', password: 'Secreta123!' };

    await controller.createUser(body, { user: { userId: 'admin-1' } }, '127.0.0.1');

    expect(adminService.createUser).toHaveBeenCalledWith(body, 'admin-1', '127.0.0.1');
  });
});
