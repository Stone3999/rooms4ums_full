import { ConfigService } from '@nestjs/config';
export declare class SmsService {
    private configService;
    constructor(configService: ConfigService);
    sendSms(to: string, message: string): Promise<boolean>;
    sendVerificationSms(to: string, code: string): Promise<boolean>;
}
