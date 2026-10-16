import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  
  // Supabase (PostgreSQL)
  SUPABASE_URL: Joi.string().required(),
  SUPABASE_KEY: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  // MongoDB Atlas
  MONGO_URI: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  // Object Storage
  SUPABASE_BUCKET_NAME: Joi.string().default('avatars'),

  // Firebase Cloud Messaging (push remoto).
  // Ambos son opcionales: si faltan, el backend arranca igual y el push
  // remoto simplemente queda deshabilitado (el push local sigue funcionando).
  // En Render conviene usar FIREBASE_SERVICE_ACCOUNT_JSON porque no hay
  // sistema de archivos persistente.
  FIREBASE_SERVICE_ACCOUNT_PATH: Joi.string().allow('').optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().allow('').optional(),
});
