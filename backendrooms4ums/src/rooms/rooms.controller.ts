import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  // PÚBLICO: Listar puertas en el Home
  @Get()
  async getActiveRooms() {
    return await this.roomsService.findAllActive();
  }

  // PÚBLICO: Obtener detalles por slug
  @Get('slug/:slug')
  async getRoomBySlug(@Param('slug') slug: string) {
    return await this.roomsService.findBySlug(slug);
  }

  // ADMIN: Listar todos (incluyendo archivados)
  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async getAllRooms() {
    // Aquí podrías añadir una validación de rol 'ADMIN' si lo deseas
    return await this.roomsService.findAll();
  }

  // ADMIN: Crear nueva puerta
  @Post()
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async createRoom(@Body() data: any) {
    return await this.roomsService.create(data);
  }

  // ADMIN: Actualizar puerta
  @Put(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateRoom(@Param('id') id: string, @Body() data: any) {
    return await this.roomsService.update(id, data);
  }

  // ADMIN: Borrar puerta
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async deleteRoom(@Param('id') id: string) {
    return await this.roomsService.delete(id);
  }
}
