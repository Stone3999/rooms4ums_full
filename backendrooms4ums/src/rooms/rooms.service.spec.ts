import { NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

/**
 * Práctica 11/13: pruebas de la capa de datos de salas con el driver SQL
 * simulado. No se necesita PostgreSQL real para comprobar el contrato.
 */
describe('RoomsService', () => {
  let service: RoomsService;
  let sql: jest.Mock;

  beforeEach(() => {
    sql = jest.fn();
    service = new RoomsService(sql as any);
  });

  it('devuelve las salas activas ordenadas por creación (DB-01)', async () => {
    const rooms = [{ id: '1', slug: 'general', name: 'General', status: 'ACTIVE' }];
    sql.mockResolvedValue(rooms);

    await expect(service.findAllActive()).resolves.toBe(rooms);
    expect(sql).toHaveBeenCalledTimes(1);
  });

  it('encuentra una sala por slug', async () => {
    sql.mockResolvedValue([{ id: '1', slug: 'general' }]);

    await expect(service.findBySlug('general')).resolves.toEqual({ id: '1', slug: 'general' });
  });

  it('responde 404 cuando el slug no existe (TC06)', async () => {
    sql.mockResolvedValue([]);

    await expect(service.findBySlug('no-existe')).rejects.toThrow(NotFoundException);
  });
});
