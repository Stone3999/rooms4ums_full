import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  let sql: jest.Mock;

  beforeEach(() => {
    sql = jest.fn();
    service = new AdminService(sql as any);
  });

  it('lista usuarios con su rol (SEG-06: solo administración)', async () => {
    const users = [{ id: 'u1', username: 'david', role_name: 'ADMIN' }];
    sql.mockResolvedValue(users);

    await expect(service.getAllUsers()).resolves.toBe(users);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('lista los roles disponibles', async () => {
    sql.mockResolvedValue([{ id: 1, name: 'USER' }]);

    await expect(service.getAllRoles()).resolves.toEqual([{ id: 1, name: 'USER' }]);
  });
});
