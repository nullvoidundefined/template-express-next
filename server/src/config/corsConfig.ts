import cors from "cors";

export const corsConfig = cors({
  credentials: true,
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  maxAge: 7200,
});
