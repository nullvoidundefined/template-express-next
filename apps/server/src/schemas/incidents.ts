import { z } from 'zod';

export const incidentStatusSchema = z.enum([
  'investigating',
  'identified',
  'monitoring',
  'resolved',
]);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const incidentSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  status: incidentStatusSchema,
  title: z.string(),
  cause: z.string().nullable(),
  started_at: z.coerce.date(),
  resolved_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type Incident = z.infer<typeof incidentSchema>;

export const CreateIncidentSchema = z.object({
  title: z.string().min(1).max(255),
  cause: z.string().optional(),
  status: incidentStatusSchema.default('investigating'),
  started_at: z.coerce.date().optional(),
});

export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;

export const UpdateIncidentSchema = CreateIncidentSchema.partial().extend({
  resolved_at: z.coerce.date().nullable().optional(),
});

export type UpdateIncidentInput = z.infer<typeof UpdateIncidentSchema>;
