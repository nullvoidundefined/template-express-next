import { SESSION_TTL_MS } from 'app/constants/session.js';
import { query, withTransaction } from 'app/db/pool/pool.js';
import type { PoolClient } from 'app/db/pool/pool.js';
import type { User } from 'app/schemas/auth.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

const SALT_ROUNDS = 12;

/** Hash session token for storage. Cookie holds raw token; DB holds hash so a dump doesn't expose sessions. */
function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function createUser(
  email: string,
  password: string,
  client?: PoolClient,
): Promise<User> {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await query<User & { password_hash: string }>(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, updated_at',
    [email.toLowerCase().trim(), password_hash],
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
    'SELECT id, email, password_hash, created_at, updated_at FROM users WHERE email = $1',
    [email.toLowerCase().trim()],
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT id, email, created_at, updated_at FROM users WHERE id = $1',
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
  const idHash = hashSessionToken(token);
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
): Promise<{ user: User; sessionId: string }> {
  return withTransaction(async (client) => {
    const user = await createUser(email, password, client);
    const sessionId = await createSession(user.id, client);
    return { user, sessionId };
  });
}

/** Stores a password-reset token hash. The raw token is sent to the user; only the hash is persisted. */
export async function createPasswordReset(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Atomically validates a password-reset token, updates the user's password,
 * marks the token used, and deletes all sessions for the user.
 * Returns null when the token is invalid, expired, or already used.
 */
export async function consumePasswordReset(
  tokenHash: string,
  newPasswordHash: string,
): Promise<User | null> {
  return withTransaction(async (client) => {
    const resetResult = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_resets
       WHERE token_hash = $1`,
      [tokenHash],
      client,
    );
    const reset = resetResult.rows[0];
    if (!reset) return null;
    if (reset.used_at) return null;
    if (new Date() > reset.expires_at) return null;

    const userResult = await query<User>(
      `UPDATE users SET password_hash = $1
       WHERE id = $2
       RETURNING id, email, created_at, updated_at`,
      [newPasswordHash, reset.user_id],
      client,
    );
    const user = userResult.rows[0];
    if (!user) return null;

    await query(
      'UPDATE password_resets SET used_at = NOW() WHERE id = $1',
      [reset.id],
      client,
    );
    await query(
      'DELETE FROM sessions WHERE user_id = $1',
      [reset.user_id],
      client,
    );

    return user;
  });
}

/** Updates user's password hash. Callers hash the password before calling. */
export async function updateUser(
  userId: string,
  fields: { passwordHash?: string },
): Promise<User> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fields.passwordHash !== undefined) {
    setClauses.push(`password_hash = $${idx++}`);
    values.push(fields.passwordHash);
  }

  if (setClauses.length === 0) {
    throw new Error('updateUser: at least one field must be provided');
  }

  values.push(userId);
  const result = await query<User>(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, email, created_at, updated_at`,
    values,
  );
  const row = result.rows[0];
  if (!row) throw new Error('updateUser: no row returned');
  return row;
}
