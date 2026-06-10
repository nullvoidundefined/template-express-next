import { z } from 'zod';

// All application routes are versioned under /v1 on the server. Callers pass
// unversioned paths (e.g. '/auth/me'); the version is applied here in one place.
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/v1`;

/**
 * Error thrown for any non-2xx response. Carries the HTTP status and the
 * machine-readable error code so callers can branch (e.g., treat 401 as
 * logged-out, or switch on a specific code) instead of parsing the message.
 */
class ApiError extends Error {
  readonly code?: string;
  readonly status: number;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type RequestOptions = {
  body?: Record<string, unknown>;
  method?: string;
};

// Zod schema for the standard error envelope the server sends on non-2xx
// responses: a machine-readable `code` plus a human-readable `error` message.
const errorEnvelopeSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

// Overload 1: caller provides a schema, response is validated and typed.
async function api<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  opts?: RequestOptions,
): Promise<z.infer<S>>;

// Overload 2: no schema (void responses such as 204 DELETE/logout).
async function api(path: string, opts?: RequestOptions): Promise<void>;

async function api<S extends z.ZodTypeAny>(
  path: string,
  schemaOrOpts?: S | RequestOptions,
  opts?: RequestOptions,
): Promise<z.infer<S> | void> {
  const hasSchema = schemaOrOpts instanceof z.ZodType;
  const schema = hasSchema ? schemaOrOpts : undefined;
  const resolvedOpts = hasSchema
    ? opts
    : (schemaOrOpts as RequestOptions | undefined);

  const res = await fetch(`${API_BASE}${path}`, {
    body: resolvedOpts?.body ? JSON.stringify(resolvedOpts.body) : undefined,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    method: resolvedOpts?.method ?? 'GET',
  });

  if (res.status === 204) return;

  const data: unknown = await res.json();

  if (!res.ok) {
    const parsed = errorEnvelopeSchema.safeParse(data);
    throw new ApiError(
      res.status,
      parsed.success
        ? (parsed.data.error ?? 'Request failed')
        : 'Request failed',
      parsed.success ? parsed.data.code : undefined,
    );
  }

  if (schema) return schema.parse(data);
}

export { api, ApiError };
