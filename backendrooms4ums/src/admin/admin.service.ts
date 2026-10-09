import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
  ) {}

  // --- USER ADMINISTRATION ---
  async getAllUsers() {
    return this.sql`
      SELECT u.id, u.username, u.email, u.is_active, u.created_at, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `;
  }

  async createUser(data: any, adminId: string, ip: string) {
    const { username, email, password, role_id } = data;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await this.sql`
      INSERT INTO users (username, email, password, role_id, is_active)
      VALUES (${username}, ${email}, ${hashedPassword}, ${role_id}, true)
      RETURNING id, username, email
    `;

    await this.logAudit(adminId, 'CREATE_USER', ip, { createdUser: newUser[0].id });
    return newUser[0];
  }

  async updateUser(id: string, data: any, adminId: string, ip: string) {
    const { username, email, role_id } = data;
    const updated = await this.sql`
      UPDATE users SET username = ${username}, email = ${email}, role_id = ${role_id}
      WHERE id = ${id}
      RETURNING id, username, email
    `;
    
    if (updated.length === 0) throw new NotFoundException('User not found');
    await this.logAudit(adminId, 'UPDATE_USER', ip, { targetUser: id });
    return updated[0];
  }

  async toggleUserActive(id: string, isActive: boolean, adminId: string, ip: string) {
    const updated = await this.sql`
      UPDATE users SET is_active = ${isActive} WHERE id = ${id}
      RETURNING id, is_active
    `;
    
    if (updated.length === 0) throw new NotFoundException('User not found');
    await this.logAudit(adminId, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', ip, { targetUser: id });
    return updated[0];
  }

  // --- ROLES & PERMISSIONS ---
  async getAllRoles() {
    return this.sql`SELECT * FROM roles ORDER BY id ASC`;
  }

  async getAuditLogs() {
    return this.sql`
      SELECT a.*, u.username as admin_username 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `;
  }

  private async logAudit(userId: string, action: string, ip: string, details: any = {}) {
    try {
      await this.sql`
        INSERT INTO audit_logs (user_id, action, ip_address, details)
        VALUES (${userId}, ${action}, ${ip}, ${details})
      `;
    } catch (e) {
      console.error('Failed to write audit log', e);
    }
  }
}
