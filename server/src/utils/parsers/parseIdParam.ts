const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parses a route param as a UUID string.
 * Returns null if the value is not a valid UUID.
 */
export function parseIdParam(id: string | string[] | undefined): string | null {
  const raw = Array.isArray(id) ? id[0] : id;
  const s = typeof raw === "string" ? raw.trim() : "";
  return s && UUID_REGEX.test(s) ? s : null;
}
