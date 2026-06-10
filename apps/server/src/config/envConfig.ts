import { z } from 'zod';

const envSchema = z.object({
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_MIGRATION_URL: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z
    .enum(['development', 'production', 'staging', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3001),
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default('https://us.i.posthog.com'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  REDIS_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  SENTRY_DSN: z.string().optional(),
  SESSION_SECRET: z.string().min(1, 'SESSION_SECRET is required'),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WORKER_PORT: z.coerce.number().default(3002),
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && !parsed.REDIS_URL) {
  console.warn(
    '[env] REDIS_URL is not set in production. Rate limiters will use in-memory storage.',
  );
}

export const env = Object.freeze(parsed);

export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';
export const isTest = env.NODE_ENV === 'test';

export function isProduction(): boolean {
  return env.NODE_ENV === 'production';
}

export function isDeployed(): boolean {
  return env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
}
