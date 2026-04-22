import { z } from 'zod';

const envSchema = z.object({
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_URL: z.string().default(''),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  POSTHOG_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  SENTRY_DSN: z.string().optional(),
  SESSION_SECRET: z.string().default(''),
});

export const env = envSchema.parse(process.env);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
