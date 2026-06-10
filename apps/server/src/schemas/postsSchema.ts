import { z } from 'zod';

export const createPostSchema = z.object({
  body: z
    .string()
    .min(1, 'Body is required')
    .max(10_000, 'Body must be at most 10,000 characters'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be at most 255 characters'),
});

// Update accepts the same fields and constraints as create.
export const updatePostSchema = createPostSchema;

export const postSchema = z.object({
  body: z.string(),
  created_at: z.coerce.date(),
  id: z.string().uuid(),
  title: z.string(),
  updated_at: z.coerce.date().nullable(),
  user_id: z.string().uuid(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type Post = z.infer<typeof postSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
