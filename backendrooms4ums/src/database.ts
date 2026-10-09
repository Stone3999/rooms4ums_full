import postgres from 'postgres';
import { ConfigService } from '@nestjs/config';

// Este es el nuevo motor de conexión oficial de Supabase para Node.js
export const createDatabaseConnection = (configService: ConfigService) => {
  const connectionString = configService.get<string>('DATABASE_URL') || '';
  
  // Usamos postgres.js, que es mucho más estable con el pooler de Supabase
  const sql = postgres(connectionString, {
    ssl: { rejectUnauthorized: false }, // Para que no se queje del certificado
    idle_timeout: 20,
    connect_timeout: 30,
  });

  return sql;
};
