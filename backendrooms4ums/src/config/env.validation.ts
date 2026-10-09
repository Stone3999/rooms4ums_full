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
});
