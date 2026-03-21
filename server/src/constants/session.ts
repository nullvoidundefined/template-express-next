/** Cookie name for the session id. */
export const SESSION_COOKIE_NAME = "sid";

/** Single source of truth for session lifetime (cookie maxAge and DB expires_at). */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
