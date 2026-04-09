import { z } from 'zod';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RequestOptions = {
  body?: Record<string, unknown>;
  method?: string;
};

// Zod schema for the standard error envelope the server sends on non-2xx responses.
const errorEnvelopeSchema = z.object({
  error: z.object({ message: z.string() }).optional(),
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
    throw new Error(
      parsed.success
        ? (parsed.data.error?.message ?? 'Request failed')
        : 'Request failed',
    );
  }

  if (schema) return schema.parse(data);
}

export { api };
