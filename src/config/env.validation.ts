import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(4000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_MIGRATIONS_RUN: Joi.boolean().truthy('true').falsy('false').default(false),

  JWT_SECRET_KEY: Joi.string().min(16).required(),
  RESET_JWT_SECRET_KEY: Joi.string().min(16).optional(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),

  GEMINI_API_KEY: Joi.string().required(),
  GEMINI_MODEL: Joi.string().default('gemini-2.5-flash'),
  GEMINI_FALLBACK_MODELS: Joi.string().allow('').optional(),
  GEMINI_RESPONSE_CACHE_TTL_SECONDS: Joi.number().default(86400),

  ML_API_BASE_URL: Joi.string().uri().required(),
  ML_CONFIDENCE_THRESHOLD: Joi.number().min(0).max(1).default(0.6),
  ML_TIMEOUT_MS: Joi.number().default(10000),
  ML_WARMUP_ON_START: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  ASYNC_CLOUDINARY_UPLOAD: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  SKIP_CLOUDINARY_UPLOAD_ON_LOW_CONFIDENCE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),

  CLOUDINARY_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  CLOUDINARY_UPLOAD_FOLDER: Joi.string().default('nutrition'),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(true),
  SMTP_USERNAME: Joi.string().required(),
  SMTP_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().required(),

  FRONTEND_RESET_PASSWORD_URL: Joi.string().uri().required(),
  INTERNAL_API_KEY: Joi.string().min(16).required(),

  IMAGE_ANALYSIS_CACHE_TTL_SECONDS: Joi.number().default(86400),
  TEXT_ANALYSIS_CACHE_TTL_SECONDS: Joi.number().default(86400),
  CALORIES_AI_CACHE_TTL_SECONDS: Joi.number().default(86400),
  PREDICTION_CACHE_TTL_SECONDS: Joi.number().default(86400),
  LOG_RETENTION_DAYS: Joi.number().default(30),
});
