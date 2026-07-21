import 'dotenv/config';
import { z } from 'zod';

/** Validated environment configuration. The process refuses to boot with an
 * invalid configuration instead of failing later at request time. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
  STORAGE_DRIVER: z.enum(['memory', 'postgres']).default('memory'),
  DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16).default('appforge-dev-secret-do-not-use-in-production'),
  JWT_EXPIRES_IN: z.string().default('1h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  AI_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  EMAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('no-reply@appforge.local'),
  FILE_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  FILE_STORAGE_LOCAL_DIR: z.string().default('./storage/uploads'),
  FILE_MAX_UPLOAD_MB: z.coerce.number().default(10),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';

if (isProduction && env.JWT_SECRET.includes('dev-secret')) {
  // eslint-disable-next-line no-console
  console.error('Refusing to start in production with the default JWT secret.');
  process.exit(1);
}
if (env.STORAGE_DRIVER === 'postgres' && !env.DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error('DATABASE_URL is required when STORAGE_DRIVER=postgres.');
  process.exit(1);
}
