import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const uuidSchema = z.string().uuid("Invalid ID format");

export const userSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;
