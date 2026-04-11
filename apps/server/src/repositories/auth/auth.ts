import { SESSION_TTL_MS } from 'app/constants/session.js';
import { query, withTransaction } from 'app/db/pool/pool.js';
import type { PoolClient } from 'app/db/pool/pool.js';
import type { User } from 'app/schemas/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;

interface NameFields {
  nameAlias?: string;
  nameFirst?: string;
  nameLast?: string;
}

export interface PasswordResetRow {
  expires_at: Date;
  id: string;
  used_at: Date | null;
  user_id: string;
}

/** Hash a token for storage. Cookie/URL holds raw token; DB holds hash so a dump does not expose secrets. */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function createUser(
  email: string,
  password: string,
  nameFields?: NameFields,
  client?: PoolClient,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query<User & { password_hash: string }>(
    `INSERT INTO users (email, name_alias, name_first, name_last, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING created_at, email, id, name_alias, name_first, name_last, updated_at`,
    [
      email.toLowerCase().trim(),
      nameFields?.nameAlias ?? null,
      nameFields?.nameFirst ?? null,
      nameFields?.nameLast ?? null,
      password_hash,
    ],
    client,
  );
  const row = result.rows[0];
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function findUserByEmail(
  email: string,
): Promise<(User & { password_hash: string }) | null> {
  const result = await query<User & { password_hash: string }>(
    `SELECT created_at, email, id, name_alias, name_first, name_last, password_hash, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT created_at, email, id, name_alias, name_first, name_last, updated_at
     FROM users WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(
  userId: string,
  client?: PoolClient,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const idHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [idHash, userId, expiresAt],
    client,
  );
  return token;
}

/** Returns the user for a valid session in one query (sessions JOIN users). */
export async function getSessionWithUser(
  sessionId: string,
): Promise<User | null> {
  const idHash = hashToken(sessionId);
  const result = await query<User>(
    `SELECT u.created_at, u.email, u.id, u.name_alias, u.name_first, u.name_last, u.updated_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [idHash],
  );
  return result.rows[0] ?? null;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const idHash = hashToken(sessionId);
  const result = await query(
    'DELETE FROM sessions WHERE id = $1 RETURNING id',
    [idHash],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteSessionsForUser(userId: string): Promise<void> {
  await query('DELETE FROM sessions WHERE user_id = $1', [userId]);
}

/** Removes expired sessions. Call on an interval to prevent table bloat. */
export async function deleteExpiredSessions(): Promise<number> {
  const result = await query(
    'DELETE FROM sessions WHERE expires_at <= NOW() RETURNING id',
  );
  return result.rowCount ?? 0;
}

/** Creates a new session, pruning only expired sessions for this user. Allows concurrent sessions. */
export async function loginUser(userId: string): Promise<string> {
  return withTransaction(async (client) => {
    await query(
      'DELETE FROM sessions WHERE user_id = $1 AND expires_at <= NOW()',
      [userId],
      client,
    );
    return createSession(userId, client);
  });
}

/**
 * Verifies credentials and returns the user without exposing password_hash.
 * Returns null when email does not exist or password is wrong; callers cannot
 * distinguish which case failed (intentional: prevents user enumeration).
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const row = await findUserByEmail(email);
  if (!row) return null;
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return null;
  return {
    created_at: row.created_at,
    email: row.email,
    id: row.id,
    name_alias: row.name_alias,
    name_first: row.name_first,
    name_last: row.name_last,
    updated_at: row.updated_at,
  };
}

/**
 * Creates a user and their first session in a single transaction.
 * Avoids the race where createUser succeeds but createSession fails, leaving an orphan user.
 * Throws with code "23505" when email is already registered.
 */
export async function createUserAndSession(
  email: string,
  password: string,
  nameFields?: NameFields,
): Promise<{ user: User; sessionId: string }> {
  return withTransaction(async (client) => {
    const user = await createUser(email, password, nameFields, client);
    const sessionId = await createSession(user.id, client);
    return { sessionId, user };
  });
}

/** Generates a random token, stores its hash with a 1-hour expiry, and returns the raw token. */
export async function createPasswordResetToken(
  userId: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 3600_000);
  await query(
    `INSERT INTO password_resets (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [tokenHash, userId, expiresAt],
  );
  return token;
}

/** Hashes the provided token and looks up a matching password reset row. */
export async function findPasswordResetByToken(
  token: string,
): Promise<PasswordResetRow | null> {
  const tokenHash = hashToken(token);
  const result = await query<PasswordResetRow>(
    `SELECT expires_at, id, used_at, user_id
     FROM password_resets
     WHERE token_hash = $1`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

/** Marks a password reset record as used. */
export async function markPasswordResetUsed(id: string): Promise<void> {
  await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [id]);
}

/** Updates a user's password hash. */
export async function updateUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [password_hash, userId],
  );
}
