import { Controller, Post, Body, Inject, BadRequestException, ConflictException, Logger, UnauthorizedException, Get, UseGuards, Request } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    @Inject('DATABASE_CONNECTION') private sql: any,
    @Inject('REDIS_CLIENT') private redis: Redis,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    this.rpID = this.configService.get<string>('RP_ID') || 'localhost';
    this.origin = this.configService.get<string>('ORIGIN') || `http://localhost:4200`;
    
    this.logger.log(`WebAuthn configured with RP_ID: ${this.rpID} and Origin: ${this.origin}`);
  }

  @Post('register')
  async register(@Body() body: any) {
    const { username, email, password, birth_date, country } = body;
    if (!username || !email || !password || !birth_date || !country) {
      throw new BadRequestException('Faltan campos obligatorios');
    }

    try {
      const existingUsers = await this.sql`
        SELECT id FROM users WHERE email = ${email} OR username = ${username}
      `;
      if (existingUsers.length > 0) {
        throw new ConflictException('El nombre de usuario o correo ya están registrados');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await this.sql`
        INSERT INTO users (username, email, password, birth_date, country, status)
        VALUES (${username}, ${email}, ${hashedPassword}, ${birth_date}, ${country}, 'OFFLINE')
        RETURNING id, username, email
      `;

      return { message: 'Usuario creado exitosamente', user: newUser[0] };
    } catch (e: any) {
      if (e instanceof ConflictException) throw e;
      throw new BadRequestException(e.message || 'Error al crear el usuario');
    }
  }

  @Post('check-user')
  async checkUser(@Body('identifier') identifier: string) {
    const users = await this.sql`
      SELECT users.id, email, username, 
             COALESCE(creds.has_biometrics, false) as has_biometrics
      FROM users 
      LEFT JOIN (
        SELECT user_id, COUNT(*) > 0 as has_biometrics 
        FROM user_credentials 
        GROUP BY user_id
      ) creds ON users.id = creds.user_id
      WHERE email = ${identifier} OR username = ${identifier}
      LIMIT 1
    `;
    if (users.length === 0) throw new BadRequestException('User not found');
    return { exists: true, hasBiometrics: users[0].has_biometrics, username: users[0].username };
  }

  @Post('login-password')
  async loginPassword(@Body() body: any) {
    const { identifier, password } = body;
    const users = await this.sql`
      SELECT id, email, username, password FROM users 
      WHERE email = ${identifier} OR username = ${identifier}
      LIMIT 1
    `;

    if (users.length === 0) throw new UnauthorizedException('Credenciales inválidas');

    const user = users[0];
    const isPasswordMatching = await bcrypt.compare(password, user.password);

    if (!isPasswordMatching) throw new UnauthorizedException('Credenciales inválidas');

    const payload = { sub: user.id, username: user.username, email: user.email };
    const token = this.jwtService.sign(payload);

    // GUARDAR SESIÓN EN REDIS con Timeout (para evitar cuelgues en Vercel)
    try {
      const redisPromise = this.redis.set(`session:${user.id}`, token, 'EX', 86400);
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 3000));
      await Promise.race([redisPromise, timeoutPromise]);
    } catch (err: any) {
      this.logger.warn(`No se pudo guardar la sesión en Redis: ${err.message}`);
      // No lanzamos error para que el usuario pueda iniciar sesión aunque Redis falle
    }

    return {
      token,
      user: { id: user.id, username: user.username, email: user.email }
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Request() req: any) {
    const userId = req.user.userId;
    await this.redis.del(`session:${userId}`);
    return { message: 'Sesión cerrada exitosamente' };
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Request() req: any) {
    const userId = req.user.userId;
    const users = await this.sql`
      SELECT u.id, u.email, u.username, u.bio, u.role, u.status, u.created_at, r.name as role_name,
             COALESCE(creds.has_biometrics, false) as has_biometrics
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) > 0 as has_biometrics 
        FROM user_credentials 
        GROUP BY user_id
      ) creds ON u.id = creds.user_id
      WHERE u.id = ${userId}
    `;
    if (users.length === 0) throw new BadRequestException('User not found');
    return users[0];
  }

  // --- WEBAUTHN ENDPOINTS ---
  @UseGuards(AuthGuard('jwt'))
  @Post('generate-registration-options')
  async generateRegOptions(@Request() req: any) {
    const userId = req.user.userId;
    const users = await this.sql`SELECT id, email, username FROM users WHERE id = ${userId}`;
    const user = users[0];
    const userCredentials = await this.sql`SELECT credential_id FROM user_credentials WHERE user_id = ${userId}`;

    const origin = this.configService.get<string>('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
    const originUrl = new URL(origin);
    
    // Si el usuario puso una URL completa en RP_ID por error, le sacamos el hostname.
    let rpID = this.configService.get<string>('RP_ID') || originUrl.hostname;
    if (rpID.startsWith('http')) {
      rpID = new URL(rpID).hostname;
    }

    return await generateRegistrationOptions({
      rpName: 'ROOMS4UMS SYS',
      rpID: rpID,
      userID: Buffer.from(user.id), // Convertimos el string UUID a binario
      userName: user.email,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials: userCredentials.map((c: any) => ({ id: c.credential_id, type: 'public-key' })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred', authenticatorAttachment: 'platform' },
    });
  }

  @Post('verify-registration')
  @UseGuards(AuthGuard('jwt'))
  async verifyReg(@Request() req: any, @Body() body: any) {
    const userId = req.user.userId;
    const { registrationResponse, expectedChallenge } = body;
    
    const origin = this.configService.get<string>('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
    const originUrl = new URL(origin);
    
    let rpID = this.configService.get<string>('RP_ID') || originUrl.hostname;
    if (rpID.startsWith('http')) {
      rpID = new URL(rpID).hostname;
    }

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { id, publicKey, counter } = verification.registrationInfo.credential;
      await this.sql`
        INSERT INTO user_credentials (user_id, public_key, credential_id, counter, device_type)
        VALUES (${userId}, ${Buffer.from(publicKey).toString('base64')}, ${id}, ${counter}, 'platform')
      `;
      return { verified: true };
    }
    return { verified: false };
  }

  @Post('generate-authentication-options')
  async generateAuthOptions(@Body('identifier') identifier: string, @Request() req: any) {
    const users = await this.sql`SELECT id FROM users WHERE email = ${identifier} OR username = ${identifier}`;
    if (users.length === 0) throw new BadRequestException('User not found');
    const userCredentials = await this.sql`SELECT credential_id FROM user_credentials WHERE user_id = ${users[0].id}`;

    const origin = this.configService.get<string>('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
    const originUrl = new URL(origin);
    
    let rpID = this.configService.get<string>('RP_ID') || originUrl.hostname;
    if (rpID.startsWith('http')) {
      rpID = new URL(rpID).hostname;
    }

    return await generateAuthenticationOptions({
      rpID: rpID,
      allowCredentials: userCredentials.map((c: any) => ({ id: c.credential_id, type: 'public-key' })),
      userVerification: 'preferred',
    });
  }

  @Post('verify-authentication')
  async verifyAuth(@Body() body: any, @Request() req: any) {
    const { identifier, authenticationResponse, expectedChallenge } = body;
    const users = await this.sql`SELECT id, email, username FROM users WHERE email = ${identifier} OR username = ${identifier}`;
    if (users.length === 0) throw new BadRequestException('User not found');
    const user = users[0];

    const credentials = await this.sql`SELECT * FROM user_credentials WHERE credential_id = ${authenticationResponse.id}`;
    if (credentials.length === 0) throw new BadRequestException('Credential not found');
    const dbCredential = credentials[0];

    const origin = this.configService.get<string>('ORIGIN') || req.headers?.origin || `http://localhost:4200`;
    const originUrl = new URL(origin);
    
    let rpID = this.configService.get<string>('RP_ID') || originUrl.hostname;
    if (rpID.startsWith('http')) {
      rpID = new URL(rpID).hostname;
    }

    const verification = await verifyAuthenticationResponse({
      response: authenticationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: { id: dbCredential.credential_id, publicKey: Buffer.from(dbCredential.public_key, 'base64'), counter: dbCredential.counter },
    });

    if (verification.verified) {
      await this.sql`UPDATE user_credentials SET counter = ${verification.authenticationInfo.newCounter} WHERE id = ${dbCredential.id}`;
      const token = this.jwtService.sign({ sub: user.id, username: user.username, email: user.email });
      
      // GUARDAR SESIÓN EN REDIS con Timeout
      try {
        const redisPromise = this.redis.set(`session:${user.id}`, token, 'EX', 86400);
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 3000));
        await Promise.race([redisPromise, timeoutPromise]);
      } catch (err: any) {
        this.logger.warn(`No se pudo guardar la sesión en Redis (WebAuthn): ${err.message}`);
      }

      return { verified: true, token, user: { id: user.id, username: user.username, email: user.email } };
    }
    return { verified: false };
  }
}
