import { z } from "zod";

export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  health_endpoint: z.string().url().optional(),
  github_owner: z.string().max(255).optional(),
  github_repo: z.string().max(255).optional(),
  github_branch: z.string().max(100).default("main"),
  check_interval_seconds: z.coerce.number().int().min(30).max(86400).default(60),
  timeout_ms: z.coerce.number().int().min(1000).max(30000).default(10000),
  expected_status_code: z.coerce.number().int().default(200),
  screenshot_enabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;
export const UpdateServiceSchema = CreateServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

export const serviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  health_endpoint: z.string().nullable(),
  github_owner: z.string().nullable(),
  github_repo: z.string().nullable(),
  github_branch: z.string(),
  check_interval_seconds: z.number().int(),
  timeout_ms: z.number().int(),
  expected_status_code: z.number().int(),
  screenshot_enabled: z.boolean(),
  tags: z.array(z.string()),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Service = z.infer<typeof serviceSchema>;
