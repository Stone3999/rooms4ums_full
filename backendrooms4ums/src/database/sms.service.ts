import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  constructor(private configService: ConfigService) {}

  async sendSms(to: string, message: string) {
    console.log(`[SMS] Enviando mensaje a ${to}: ${message}`);
    // Aquí iría la lógica de Twilio
    return true;
  }

  async sendVerificationSms(to: string, code: string) {
    const message = `Tu código de seguridad para Rooms4ums es: ${code}`;
    return this.sendSms(to, message);
  }
}
