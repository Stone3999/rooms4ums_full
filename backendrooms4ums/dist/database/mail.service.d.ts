import { ConfigService } from '@nestjs/config';
export declare class MailService {
    private configService;
    constructor(configService: ConfigService);
    sendRecoveryEmail(to: string, code: string): Promise<boolean>;
    sendVerificationCode(to: string, code: string): Promise<boolean>;
}
