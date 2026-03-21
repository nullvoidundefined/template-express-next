import crypto from "node:crypto";

import bcrypt from "bcrypt";

import { SESSION_TTL_MS } from "app/constants/session.js";
import { query, withTransaction } from "app/db/pool/pool.js";
import type { PoolClient } from "app/db/pool/pool.js";
import type { User } from "app/schemas/auth.js";

const SALT_ROUNDS = 10;

/** Hash session token for storage. Cookie holds raw token; DB holds hash so a dump doesn't expose sessions. */
function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export async function createUser(
  email: string,
  password: string,
  client?: PoolClient,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query<User & { password_hash: string }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, updated_at",
    [email.toLowerCase().trim(), password_hash],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error("Insert returned no row");
  return row;
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const result = await query<User & { password_hash: string }>(
    "SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1",
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    "SELECT id, email, created_at, updated_at FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] ?? null;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string, client?: PoolClient): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const idHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [idHash, userId, expiresAt],
    client,
  );
  return token;
}

/** Returns the user for a valid session in one query (sessions JOIN users). */
export async function getSessionWithUser(sessionId: string): Promise<User | null> {
  const idHash = hashSessionToken(sessionId);
  const result = await query<User>(
    `SELECT u.id, u.email, u.created_at, u.updated_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [idHash],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const idHash = hashSessionToken(sessionId);
  const result = await query("DELETE FROM sessions WHERE id = $1 RETURNING id", [idHash]);
  return (result.rowCount ?? 0) > 0;
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

/**
 * Creates a user and their first session in a single transaction.
 * Avoids the 23505 race where createUser succeeds but createSession fails, leaving an orphan user.
 * Throws with code "23505" when email is already registered.
 */
export async function createUserAndSession(
  email: string,
  password: string,
): Promise<{ user: User; sessionId: string }> {
  return withTransaction(async (client) => {
    const user = await createUser(email, password, client);
    const sessionId = await createSession(user.id, client);
    return { user, sessionId };
  });
}
