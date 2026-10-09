import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Ip } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers() {
    return this.adminService.getAllUsers();
  }

  @Post('users')
  async createUser(@Body() body: any, @Request() req: any, @Ip() ip: string) {
    return this.adminService.createUser(body, req.user.userId, ip);
  }

  @Put('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any, @Request() req: any, @Ip() ip: string) {
    return this.adminService.updateUser(id, body, req.user.userId, ip);
  }

  @Put('users/:id/status')
  async toggleUserStatus(@Param('id') id: string, @Body('is_active') isActive: boolean, @Request() req: any, @Ip() ip: string) {
    return this.adminService.toggleUserActive(id, isActive, req.user.userId, ip);
  }

  @Get('roles')
  async getRoles() {
    return this.adminService.getAllRoles();
  }

  @Get('audit')
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }
}
