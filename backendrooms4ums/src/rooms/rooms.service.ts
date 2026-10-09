import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class RoomsService {
  constructor(@Inject('DATABASE_CONNECTION') private sql: any) {}

  // MÉTODOS PÚBLICOS
  async findAllActive() {
    return await this.sql`
      SELECT * FROM forums 
      WHERE status != 'ARCHIVED' 
      ORDER BY created_at ASC
    `;
  }

  async findBySlug(slug: string) {
    const rooms = await this.sql`SELECT * FROM forums WHERE slug = ${slug} LIMIT 1`;
    if (rooms.length === 0) throw new NotFoundException('Room not found');
    return rooms[0];
  }

  // MÉTODOS DE ADMIN
  async findAll() {
    return await this.sql`SELECT * FROM forums ORDER BY created_at ASC`;
  }

  async create(data: any) {
    const { name, slug, description, icon, status, is_interactive } = data;
    try {
      const result = await this.sql`
        INSERT INTO forums (name, slug, description, icon, status, is_interactive)
        VALUES (${name}, ${slug}, ${description}, ${icon}, ${status || 'ACTIVE'}, ${is_interactive || false})
        RETURNING *
      `;
      return result[0];
    } catch (e) {
      throw new BadRequestException('Error creating room: ' + e.message);
    }
  }

  async update(id: string, data: any) {
    const { name, slug, description, icon, status, is_interactive } = data;
    const result = await this.sql`
      UPDATE forums SET 
        name = ${name}, 
        slug = ${slug}, 
        description = ${description}, 
        icon = ${icon}, 
        status = ${status}, 
        is_interactive = ${is_interactive || false},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (result.length === 0) throw new NotFoundException('Room not found');
    return result[0];
  }

  async delete(id: string) {
    const result = await this.sql`DELETE FROM forums WHERE id = ${id} RETURNING id`;
    if (result.length === 0) throw new NotFoundException('Room not found');
    return { message: 'Room deleted successfully' };
  }
}
