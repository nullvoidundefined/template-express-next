import crypto from "node:crypto";

/** Returns a new UUID v4 for use in tests. */
export function uuid(): string {
  return crypto.randomUUID();
}
