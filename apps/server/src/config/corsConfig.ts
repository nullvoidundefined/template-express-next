import { env } from 'app/config/env.js';
import cors from 'cors';

export const corsConfig = cors({
  credentials: true,
  origin: env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 7200,
});
