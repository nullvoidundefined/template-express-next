import { z } from 'zod';

const envSchema = z.object({
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_URL: z.string().default(''),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  SESSION_SECRET: z.string().default(''),
});

export const env = envSchema.parse(process.env);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
