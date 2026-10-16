import { Body, Controller, Delete, Get, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PushService } from './push.service';

/**
 * Registro de tokens FCM.
 *
 * El cliente (app Flutter) llama a este endpoint tras iniciar sesión para
 * asociar su token de dispositivo con el usuario. Con eso, cualquier post
 * creado desde cualquier cliente genera un push a todos los dispositivos.
 */
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Get('status')
  status() {
    return {
      enabled: this.pushService.enabled,
      reason: this.pushService.enabled ? 'ok' : 'Firebase no configurado en el backend',
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('register')
  async register(@Request() req: any, @Body('token') token: string, @Body('platform') platform?: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Sesion invalida');
    if (!token) throw new UnauthorizedException('Falta el token del dispositivo');

    await this.pushService.registerToken(userId, token, platform ?? 'android');
    return { message: 'Token registrado' };
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('register')
  async unregister(@Request() req: any, @Body('token') token: string) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Sesion invalida');

    await this.pushService.unregisterToken(token ?? '');
    return { message: 'Token eliminado' };
  }
}