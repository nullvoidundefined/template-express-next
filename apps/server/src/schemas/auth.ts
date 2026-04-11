import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  nameAlias: z.string().optional(),
  nameFirst: z.string().optional(),
  nameLast: z.string().optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
});

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  token: z.string().min(1, 'Token is required'),
});

const uuidSchema = z.string().uuid('Invalid ID format');

export const userSchema = z.object({
  created_at: z.coerce.date(),
  email: z.string().email(),
  id: uuidSchema,
  name_alias: z.string().nullable(),
  name_first: z.string().nullable(),
  name_last: z.string().nullable(),
  updated_at: z.coerce.date().nullable(),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type User = z.infer<typeof userSchema>;
