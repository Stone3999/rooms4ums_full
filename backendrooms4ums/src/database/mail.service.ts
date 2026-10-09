import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  constructor(private configService: ConfigService) {}

  async sendRecoveryEmail(to: string, code: string) {
    console.log(`[MAIL] Enviando código de recuperación ${code} a ${to}`);
    // Aquí iría la lógica de nodemailer
    return true;
  }

  async sendVerificationCode(to: string, code: string) {
    console.log(`[MAIL] Enviando código de verificación ${code} a ${to}`);
    return true;
  }
}
