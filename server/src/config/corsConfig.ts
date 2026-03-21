import cors from "cors";

export const corsConfig = cors({
  credentials: true,
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
});
