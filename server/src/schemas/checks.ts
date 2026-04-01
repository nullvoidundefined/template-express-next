import { z } from "zod";

export const checkStatusSchema = z.enum(["up", "degraded", "down"]);
export type CheckStatus = z.infer<typeof checkStatusSchema>;

export const checkSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  status: checkStatusSchema,
  status_code: z.number().int().nullable(),
  response_time_ms: z.number().int().nullable(),
  dns_time_ms: z.number().int().nullable(),
  tls_valid: z.boolean().nullable(),
  tls_expires_at: z.coerce.date().nullable(),
  error_message: z.string().nullable(),
  screenshot_path: z.string().nullable(),
  raw_response_body: z.string().nullable(),
  checked_at: z.coerce.date(),
});

export type Check = z.infer<typeof checkSchema>;

export const insertCheckSchema = z.object({
  service_id: z.string().uuid(),
  status: checkStatusSchema,
  status_code: z.number().int().nullable().optional(),
  response_time_ms: z.number().int().nullable().optional(),
  dns_time_ms: z.number().int().nullable().optional(),
  tls_valid: z.boolean().nullable().optional(),
  tls_expires_at: z.coerce.date().nullable().optional(),
  error_message: z.string().nullable().optional(),
  screenshot_path: z.string().nullable().optional(),
  raw_response_body: z.string().nullable().optional(),
});

export type InsertCheckInput = z.infer<typeof insertCheckSchema>;

export interface CheckResult {
  status: CheckStatus;
  status_code: number | null;
  response_time_ms: number | null;
  dns_time_ms: number | null;
  tls_valid: boolean | null;
  tls_expires_at: Date | null;
  error_message: string | null;
}
