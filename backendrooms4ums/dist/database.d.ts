import postgres from 'postgres';
import { ConfigService } from '@nestjs/config';
export declare const createDatabaseConnection: (configService: ConfigService) => postgres.Sql<{}>;
