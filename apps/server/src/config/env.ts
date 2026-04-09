import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().default(''),
  DATABASE_CA_CERT: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  ALERT_PHONE_NUMBER: z.string().optional(),
  ALERT_EMAIL: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SCREENSHOTS_DIR: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
