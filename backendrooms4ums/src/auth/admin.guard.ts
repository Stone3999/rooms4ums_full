import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Set by JwtAuthGuard

    if (!user || !user.userId) {
      throw new UnauthorizedException('Debe iniciar sesión');
    }

    const users = await this.sql`
      SELECT r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${user.userId}
    `;

    if (users.length === 0 || !users[0].role_name || users[0].role_name.toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Requiere privilegios de administrador');
    }

    return true;
  }
}
