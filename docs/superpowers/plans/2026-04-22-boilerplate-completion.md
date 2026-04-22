# Boilerplate Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all missing features in the template-express-next boilerplate: password reset flow (Resend), PATCH /auth/me, Sentry, PostHog, packages/constants, integration tests, and ESLint hardening.

**Architecture:** Two phases executed sequentially. Phase 1 owns the auth layer (backend endpoints, DB migration, email service, frontend pages). Phase 2 owns observability (Sentry, PostHog, analytics constants) and test infrastructure (integration tests, ESLint fix). Each task ends with a commit.

**Tech Stack:** Express 5, Next.js 15, Resend SDK, @sentry/node, @sentry/nextjs, posthog-node, posthog-js, Zod, Vitest, Supertest, node-pg-migrate.

**Conventions to follow throughout:**
- Server imports use `app/*` path alias mapping to `src/*`, always end with `.js` extension.
- Named exports only on server and packages. Next.js convention files (`page.tsx`, `layout.tsx`) use `export default`.
- `'use client'` directive on any web component with state or handlers.
- Tests live in `src/__tests__/` mirroring source tree.
- No em dashes anywhere.

---

## PHASE 1: Auth Completion

---

### Task 1: password_resets migration

**Files:**
- Create: `apps/server/migrations/1771879388544_create-password-resets-table.js`

- [ ] **Step 1: Write the migration**

```javascript
// apps/server/migrations/1771879388544_create-password-resets-table.js

// Requires: users table (from migration 1771879388542)

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
export const shorthands = undefined;

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const up = (pgm) => {
  pgm.createTable('password_resets', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
  });

  pgm.createIndex('password_resets', 'token_hash');
  pgm.createIndex('password_resets', 'expires_at');
  pgm.createIndex('password_resets', 'user_id');
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
export const down = (pgm) => {
  pgm.dropTable('password_resets');
};
```

- [ ] **Step 2: Verify migration syntax is valid ESM (no CommonJS)**

Run: `node --input-type=module --eval "import('./apps/server/migrations/1771879388544_create-password-resets-table.js').then(m => console.log('ok', Object.keys(m)))" 2>&1 | head -5`

Expected output includes `ok [ 'shorthands', 'up', 'down' ]`

- [ ] **Step 3: Commit**

```bash
git add apps/server/migrations/1771879388544_create-password-resets-table.js
git commit -m "feat(server): add password_resets migration"
```

---

### Task 2: New Zod schemas

**Files:**
- Modify: `apps/server/src/schemas/auth.ts`

- [ ] **Step 1: Add the three new schemas to the end of the file**

Open `apps/server/src/schemas/auth.ts`. Append after the existing exports:

```typescript
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters'),
  token: z.string().min(1, 'Token is required'),
});

export const updateMeSchema = z
  .object({
    currentPassword: z.string().optional(),
    name: z.string().min(1, 'Name must not be empty').optional(),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .optional(),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    {
      message: 'currentPassword is required when setting a new password',
      path: ['currentPassword'],
    },
  );

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
```

- [ ] **Step 2: Build to verify no TypeScript errors**

Run from `apps/server/`: `pnpm build 2>&1 | tail -10`

Expected: zero errors, exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/schemas/auth.ts
git commit -m "feat(server): add forgotPassword, resetPassword, updateMe schemas"
```

---

### Task 3: New repository functions

**Files:**
- Modify: `apps/server/src/repositories/auth/auth.ts`
- Modify: `apps/server/src/__tests__/repositories/auth/auth.test.ts`

- [ ] **Step 1: Write failing tests for the three new repo functions**

Open `apps/server/src/__tests__/repositories/auth/auth.test.ts`.

Read the existing file first to understand mock patterns, then append these describe blocks at the bottom (before the closing of any wrapping describe, or as top-level describes):

```typescript
describe('createPasswordReset', () => {
  it('inserts a password_reset row and returns void', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);
    await expect(
      authRepo.createPasswordReset('user-id', 'hashed-token', new Date()),
    ).resolves.toBeUndefined();
    expect(pool.query).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining('INSERT INTO password_resets') }),
    );
  });
});

describe('updateUser', () => {
  it('updates passwordHash and returns updated user', async () => {
    const updated: User = {
      id: uuid(),
      email: 'a@b.com',
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [updated], rowCount: 1 } as never);
    const result = await authRepo.updateUser(updated.id, { passwordHash: 'new-hash' });
    expect(result).toEqual(updated);
  });

  it('throws if no row returned', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
    await expect(authRepo.updateUser('id', { passwordHash: 'h' })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests, confirm new ones FAIL (not error)**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS|✓|✗|createPasswordReset|updateUser)" | head -20`

Expected: test runner reports failures for `createPasswordReset` and `updateUser` (function not found).

- [ ] **Step 3: Add the three functions to the repository**

Open `apps/server/src/repositories/auth/auth.ts`. Add these functions after the `createUserAndSession` export:

```typescript
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
    if (reset.expires_at < new Date()) return null;

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
    await query('DELETE FROM sessions WHERE user_id = $1', [reset.user_id], client);

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
    throw new Error('updateUser called with no fields to update');
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
```

- [ ] **Step 4: Run tests, confirm they pass**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS|✓|✗)" | head -20`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/repositories/auth/auth.ts apps/server/src/__tests__/repositories/auth/auth.test.ts
git commit -m "feat(server): add createPasswordReset, consumePasswordReset, updateUser to auth repo"
```

---

### Task 4: Email service and env update

**Files:**
- Create: `apps/server/src/services/email/email.ts`
- Modify: `apps/server/src/config/env.ts`
- Modify: `apps/server/src/app.ts` (validateEnv only)

- [ ] **Step 1: Install Resend SDK**

Run from `apps/server/`: `pnpm add resend`

- [ ] **Step 2: Add new env vars to the Zod schema in `apps/server/src/config/env.ts`**

Replace the entire `envSchema` object (add new fields, preserving existing ones):

```typescript
import { z } from 'zod';

const envSchema = z.object({
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  DATABASE_CA_CERT: z.string().optional(),
  DATABASE_URL: z.string().default(''),
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3001),
  POSTHOG_API_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('noreply@example.com'),
  SENTRY_DSN: z.string().optional(),
  SESSION_SECRET: z.string().default(''),
});

export const env = envSchema.parse(process.env);

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
```

- [ ] **Step 3: Update validateEnv in `apps/server/src/app.ts` to check new prod-required vars**

Find the `validateEnv` function and replace it with:

```typescript
function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error('Fatal: DATABASE_URL is required');
    process.exit(1);
  }
  if (!process.env.SESSION_SECRET) {
    console.error('Fatal: SESSION_SECRET is required');
    process.exit(1);
  }
  if (isProduction() && !process.env.CORS_ORIGIN) {
    console.error('Fatal: CORS_ORIGIN is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.CLIENT_URL) {
    console.error('Fatal: CLIENT_URL is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.RESEND_API_KEY) {
    console.error('Fatal: RESEND_API_KEY is required in production');
    process.exit(1);
  }
  if (isProduction() && !process.env.RESEND_FROM_EMAIL) {
    console.error('Fatal: RESEND_FROM_EMAIL is required in production');
    process.exit(1);
  }
}
```

- [ ] **Step 4: Create the email service**

Create `apps/server/src/services/email/email.ts`:

```typescript
import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.warn(
      { event: 'email_skipped', to },
      'RESEND_API_KEY not set; skipping password reset email',
    );
    return;
  }

  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
    subject: 'Reset your password',
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    to,
  });

  if (error) {
    logger.error({ err: error, event: 'email_send_failed', to }, 'Failed to send password reset email');
    throw new Error(`Email send failed: ${error.message}`);
  }

  logger.info({ event: 'email_sent', to }, 'Password reset email sent');
}
```

- [ ] **Step 5: Build to verify**

Run from `apps/server/`: `pnpm build 2>&1 | tail -10`

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/email/email.ts apps/server/src/config/env.ts apps/server/src/app.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add Resend email service and new env vars"
```

---

### Task 5: forgotPassword handler

**Files:**
- Modify: `apps/server/src/handlers/auth/auth.ts`
- Modify: `apps/server/src/__tests__/handlers/auth/auth.test.ts`

- [ ] **Step 1: Write failing test for forgotPassword handler**

Open `apps/server/src/__tests__/handlers/auth/auth.test.ts`.

Add to the top-level mock list:
```typescript
vi.mock('app/services/email/email.js');
```

Add import at the top:
```typescript
import * as emailService from 'app/services/email/email.js';
import { forgotPasswordSchema } from 'app/schemas/auth.js';
```

Wire the route in the express app setup:
```typescript
app.post('/forgot-password', authHandlers.forgotPassword);
```

Add test describe block:
```typescript
describe('forgotPassword', () => {
  it('returns 400 when body invalid', async () => {
    const res = await request(app).post('/forgot-password').send({});
    expect(res.status).toBe(400);
  });
  it('returns 200 and sends email when user found', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
    vi.mocked(authRepo.createPasswordReset).mockResolvedValueOnce(undefined);
    vi.mocked(emailService.sendPasswordResetEmail).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/forgot-password')
      .send({ email: 'user@example.com' });

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });
  it('returns 200 and does NOT send email when user not found', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, confirm new ones FAIL**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|forgotPassword)" | head -10`

Expected: forgotPassword tests fail (handler not found).

- [ ] **Step 3: Add forgotPassword handler to `apps/server/src/handlers/auth/auth.ts`**

Add these imports at the top of the file:
```typescript
import * as emailService from 'app/services/email/email.js';
import { forgotPasswordSchema } from 'app/schemas/auth.js';
import crypto from 'node:crypto';
```

Add the handler function (after the existing handlers):

```typescript
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { email } = parsed.data;

  // Always return 200 regardless of whether the email exists (prevents user enumeration).
  res.status(200).json({ message: 'If that email is registered, you will receive a reset link shortly.' });

  // Fire-and-forget after responding so latency is not exposed to the caller.
  void (async () => {
    try {
      const user = await authRepo.findUserByEmail(email);
      if (!user) return;

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await authRepo.createPasswordReset(user.id, tokenHash, expiresAt);

      const resetUrl = `${process.env.CLIENT_URL ?? 'http://localhost:3000'}/reset-password?token=${rawToken}`;
      await emailService.sendPasswordResetEmail(email, resetUrl);

      logger.info({ event: 'password_reset_email_sent', userId: user.id }, 'Password reset email dispatched');
    } catch (err) {
      logger.error({ err, event: 'password_reset_email_error' }, 'Error sending password reset email');
    }
  })();
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -5`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/handlers/auth/auth.ts apps/server/src/__tests__/handlers/auth/auth.test.ts
git commit -m "feat(server): add forgotPassword handler"
```

---

### Task 6: resetPassword handler

**Files:**
- Modify: `apps/server/src/handlers/auth/auth.ts`
- Modify: `apps/server/src/__tests__/handlers/auth/auth.test.ts`

- [ ] **Step 1: Write failing test for resetPassword handler**

Add to the test app setup:
```typescript
app.post('/reset-password', authHandlers.resetPassword);
```

Add describe block:
```typescript
describe('resetPassword', () => {
  it('returns 400 when body invalid', async () => {
    const res = await request(app).post('/reset-password').send({});
    expect(res.status).toBe(400);
  });
  it('returns 400 when token invalid or expired', async () => {
    vi.mocked(authRepo.consumePasswordReset).mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/reset-password')
      .send({ token: 'bad-token', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid or expired token');
  });
  it('returns 204 on success', async () => {
    vi.mocked(authRepo.consumePasswordReset).mockResolvedValueOnce(mockAuthUser);

    const res = await request(app)
      .post('/reset-password')
      .send({ token: 'valid-token', password: 'newpassword123' });

    expect(res.status).toBe(204);
  });
});
```

- [ ] **Step 2: Run tests, confirm new ones FAIL**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|resetPassword)" | head -10`

Expected: resetPassword tests fail.

- [ ] **Step 3: Add resetPassword handler to `apps/server/src/handlers/auth/auth.ts`**

Add the import (if not already present):
```typescript
import { resetPasswordSchema } from 'app/schemas/auth.js';
```

Add the handler:

```typescript
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { token, password } = parsed.data;
  const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await authRepo.consumePasswordReset(tokenHash, newPasswordHash);
  if (!user) {
    res.status(400).json({ error: { message: 'Invalid or expired token' } });
    return;
  }

  logger.info({ event: 'password_reset_success', userId: user.id }, 'Password reset successfully');
  res.status(204).send();
}
```

Note: `bcrypt` and `SALT_ROUNDS` are already used in the repository but not in the handler. Import them in the handler file:

```typescript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
```

- [ ] **Step 4: Run tests, confirm all pass**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -5`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/handlers/auth/auth.ts apps/server/src/__tests__/handlers/auth/auth.test.ts
git commit -m "feat(server): add resetPassword handler"
```

---

### Task 7: updateMe handler (PATCH /auth/me)

**Files:**
- Modify: `apps/server/src/handlers/auth/auth.ts`
- Modify: `apps/server/src/__tests__/handlers/auth/auth.test.ts`

- [ ] **Step 1: Write failing tests for updateMe**

Add to test app setup:
```typescript
app.patch(
  '/me',
  (req, res, next) => {
    if (req.headers['x-test-user'] === '1') {
      req.user = {
        id,
        email: 'user@example.com',
        created_at: new Date('2025-01-01'),
        updated_at: null,
      };
    }
    next();
  },
  requireAuth,
  authHandlers.updateMe,
);
```

Add describe block:
```typescript
describe('updateMe', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).patch('/me').send({ name: 'Alice' });
    expect(res.status).toBe(401);
  });
  it('returns 400 when body fails schema refine (newPassword without currentPassword)', async () => {
    const res = await request(app)
      .patch('/me')
      .set('x-test-user', '1')
      .send({ newPassword: 'newpass123' });
    expect(res.status).toBe(400);
  });
  it('returns 400 when currentPassword is wrong', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
    vi.mocked(authRepo.verifyPassword).mockResolvedValueOnce(false);

    const res = await request(app)
      .patch('/me')
      .set('x-test-user', '1')
      .send({ currentPassword: 'wrong', newPassword: 'newpass123' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Current password is incorrect');
  });
  it('returns 200 with updated user when password changed successfully', async () => {
    vi.mocked(authRepo.findUserByEmail).mockResolvedValueOnce(mockUser);
    vi.mocked(authRepo.verifyPassword).mockResolvedValueOnce(true);
    vi.mocked(authRepo.updateUser).mockResolvedValueOnce(mockAuthUser);

    const res = await request(app)
      .patch('/me')
      .set('x-test-user', '1')
      .send({ currentPassword: 'correct', newPassword: 'newpass123' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests, confirm new ones FAIL**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|updateMe)" | head -10`

Expected: updateMe tests fail.

- [ ] **Step 3: Add updateMe handler to `apps/server/src/handlers/auth/auth.ts`**

Add import:
```typescript
import { updateMeSchema } from 'app/schemas/auth.js';
```

Add handler:

```typescript
export async function updateMe(req: Request, res: Response): Promise<void> {
  const parsed = updateMeSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => e.message).join('; ');
    res.status(400).json({ error: { message } });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;
  const userId = req.user!.id;

  if (newPassword) {
    // currentPassword is guaranteed by schema refine, but guard defensively
    if (!currentPassword) {
      res.status(400).json({ error: { message: 'currentPassword is required when setting a new password' } });
      return;
    }

    const userWithHash = await authRepo.findUserByEmail(req.user!.email);
    if (!userWithHash) {
      res.status(400).json({ error: { message: 'User not found' } });
      return;
    }

    const valid = await authRepo.verifyPassword(currentPassword, userWithHash.password_hash);
    if (!valid) {
      res.status(400).json({ error: { message: 'Current password is incorrect' } });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await authRepo.updateUser(userId, { passwordHash: newPasswordHash });
    logger.info({ event: 'password_changed', userId }, 'User changed password');
    res.json({ user: toUserResponse(updated) });
    return;
  }

  // No changes requested
  res.json({ user: toUserResponse(req.user!) });
}
```

- [ ] **Step 4: Run tests, confirm all pass**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -5`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/handlers/auth/auth.ts apps/server/src/__tests__/handlers/auth/auth.test.ts
git commit -m "feat(server): add updateMe handler for PATCH /auth/me"
```

---

### Task 8: Wire new routes and add PasswordReset type

**Files:**
- Modify: `apps/server/src/routes/auth.ts`
- Create: `packages/types/src/password-reset.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add the three new routes to `apps/server/src/routes/auth.ts`**

Replace the file content with:

```typescript
import * as authHandlers from 'app/handlers/auth/auth.js';
import { authRateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requireAuth } from 'app/middleware/requireAuth/requireAuth.js';
import express from 'express';

const authRouter = express.Router();

authRouter.post('/forgot-password', authRateLimiter, authHandlers.forgotPassword);
authRouter.post('/login', authRateLimiter, authHandlers.login);
authRouter.post('/logout', authHandlers.logout);
authRouter.get('/me', requireAuth, authHandlers.me);
authRouter.patch('/me', requireAuth, authHandlers.updateMe);
authRouter.post('/register', authRateLimiter, authHandlers.register);
authRouter.post('/reset-password', authRateLimiter, authHandlers.resetPassword);

export { authRouter };
```

- [ ] **Step 2: Create `packages/types/src/password-reset.ts`**

```typescript
export type PasswordReset = {
  createdAt: string;
  expiresAt: string;
  id: string;
  usedAt: string | null;
  userId: string;
};
```

- [ ] **Step 3: Re-export from `packages/types/src/index.ts`**

Replace the file:
```typescript
// Shared domain types used by both server and client surfaces.
// Add one file per domain entity; re-export everything here.

export type { PasswordReset } from './password-reset.js';
export type { User } from './user.js';
```

- [ ] **Step 4: Build server to verify no errors**

Run from `apps/server/`: `pnpm build 2>&1 | tail -10`

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/auth.ts packages/types/src/password-reset.ts packages/types/src/index.ts
git commit -m "feat: wire forgotPassword, resetPassword, updateMe routes; add PasswordReset type"
```

---

### Task 9: Frontend pages (forgot-password, reset-password) and login update

**Files:**
- Create: `apps/client/web/src/app/(auth)/forgot-password/page.tsx`
- Create: `apps/client/web/src/app/(auth)/reset-password/page.tsx`
- Modify: `apps/client/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create `apps/client/web/src/app/(auth)/forgot-password/page.tsx`**

```tsx
'use client';

import { type FormEvent, useCallback, useState } from 'react';

import Link from 'next/link';

import { api } from '@/services/api';

import styles from '../auth.module.scss';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await api('/auth/forgot-password', { body: { email }, method: 'POST' });
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  if (submitted) {
    return (
      <main className={styles.page} data-test-id='forgot-password-page'>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.hint}>
            If that email is registered, you will receive a reset link shortly.
          </p>
          <p className={styles.footer} style={{ marginTop: 24 }}>
            <Link className={styles.link} href='/login'>
              Back to log in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page} data-test-id='forgot-password-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        <form
          className={styles.form}
          data-test-id='forgot-password-form'
          noValidate
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor='email'>
              Email
            </label>
            <input
              className={styles.input}
              id='email'
              onChange={(e) => setEmail(e.target.value)}
              required
              type='email'
              value={email}
            />
          </div>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={loading} type='submit'>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p className={styles.footer}>
          <Link className={styles.link} href='/login'>
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}

ForgotPasswordPage.displayName = 'ForgotPasswordPage';

export default ForgotPasswordPage;
```

- [ ] **Step 2: Create `apps/client/web/src/app/(auth)/reset-password/page.tsx`**

```tsx
'use client';

import { type FormEvent, useCallback, useState } from 'react';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { api } from '@/services/api';

import styles from '../auth.module.scss';

function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!token) {
        setError('Missing reset token. Please use the link from your email.');
        return;
      }

      setLoading(true);
      try {
        await api('/auth/reset-password', {
          body: { password, token },
          method: 'POST',
        });
        router.push('/login?reset=true');
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'This link is invalid or has expired',
        );
      } finally {
        setLoading(false);
      }
    },
    [confirmPassword, password, router, token],
  );

  return (
    <main className={styles.page} data-test-id='reset-password-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset password</h1>
        <form
          className={styles.form}
          data-test-id='reset-password-form'
          noValidate
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor='password'>
              New password
            </label>
            <input
              className={styles.input}
              id='password'
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
              type='password'
              value={password}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='confirm-password'>
              Confirm password
            </label>
            <input
              className={styles.input}
              id='confirm-password'
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              type='password'
              value={confirmPassword}
            />
          </div>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={loading || !token} type='submit'>
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>
        <p className={styles.footer}>
          <Link className={styles.link} href='/login'>
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}

ResetPasswordPage.displayName = 'ResetPasswordPage';

export default ResetPasswordPage;
```

- [ ] **Step 3: Update login page to show success banner on `?reset=true`**

Open `apps/client/web/src/app/(auth)/login/page.tsx`.

Add `useSearchParams` to the imports:
```tsx
import { useRouter, useSearchParams } from 'next/navigation';
```

Add inside the `LoginPage` function body (after existing state declarations):
```tsx
const searchParams = useSearchParams();
const resetSuccess = searchParams.get('reset') === 'true';
```

Add the banner inside the JSX, right before the `<form>` element:
```tsx
{resetSuccess && (
  <p className={styles.hint} role='status' style={{ marginBottom: 16, color: 'green' }}>
    Password reset successfully. Please log in.
  </p>
)}
```

Also add a "Forgot password?" link inside the form footer:
```tsx
<p className={styles.footer}>
  Don&apos;t have an account?{' '}
  <Link className={styles.link} href='/register'>
    Register
  </Link>
  {' · '}
  <Link className={styles.link} href='/forgot-password'>
    Forgot password?
  </Link>
</p>
```

- [ ] **Step 4: Build the web app to check for errors**

Run from `apps/client/web/`: `pnpm build 2>&1 | tail -20`

Expected: build completes without TypeScript errors (Next.js may show route info which is fine).

- [ ] **Step 5: Commit**

```bash
git add apps/client/web/src/app/(auth)/forgot-password/page.tsx apps/client/web/src/app/(auth)/reset-password/page.tsx apps/client/web/src/app/(auth)/login/page.tsx
git commit -m "feat(web): add forgot-password and reset-password pages; update login with reset banner"
```

---

### Task 10: useAuth hook additions (forgotPassword and resetPassword mutations)

**Files:**
- Modify: `apps/client/web/src/state/useAuth.ts`
- Modify: `apps/client/web/src/__tests__/services/api.test.ts` (or add hook test if it exists)

- [ ] **Step 1: Add forgotPassword and resetPassword mutations to `apps/client/web/src/state/useAuth.ts`**

The full updated file:

```typescript
'use client';

import { api } from '@/services/api';
import type { User } from '@repo/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

export type { User };

// Runtime schema mirrors the User type from @repo/types.
const userSchema = z.object({
  createdAt: z.string(),
  email: z.string(),
  id: z.string(),
  updatedAt: z.string().nullable(),
});

const authResponseSchema = z.object({ user: userSchema });

type Credentials = { email: string; password: string };
type ForgotPasswordInput = { email: string };
type ResetPasswordInput = { password: string; token: string };
type UpdateMeInput = { currentPassword?: string; newPassword?: string };

const AUTH_KEY = ['auth', 'me'] as const;

function useAuth() {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryFn: async () => {
      const data = await api('/auth/me', authResponseSchema);
      return data.user;
    },
    queryKey: AUTH_KEY,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api('/auth/login', authResponseSchema, {
        body: { email, password },
        method: 'POST',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.setQueryData(AUTH_KEY, null),
  });

  const registerMutation = useMutation({
    mutationFn: ({ email, password }: Credentials) =>
      api('/auth/register', authResponseSchema, {
        body: { email, password },
        method: 'POST',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: ({ email }: ForgotPasswordInput) =>
      api('/auth/forgot-password', { body: { email }, method: 'POST' }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ password, token }: ResetPasswordInput) =>
      api('/auth/reset-password', { body: { password, token }, method: 'POST' }),
  });

  const updateMeMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: UpdateMeInput) =>
      api('/auth/me', authResponseSchema, {
        body: { currentPassword, newPassword },
        method: 'PATCH',
      }).then((d) => d.user),
    onSuccess: (data) => queryClient.setQueryData(AUTH_KEY, data),
  });

  return {
    forgotPassword: (email: string) =>
      forgotPasswordMutation.mutateAsync({ email }),
    isLoading,
    login: (email: string, password: string) =>
      loginMutation.mutateAsync({ email, password }),
    logout: () => logoutMutation.mutateAsync(),
    register: (email: string, password: string) =>
      registerMutation.mutateAsync({ email, password }),
    resetPassword: (token: string, password: string) =>
      resetPasswordMutation.mutateAsync({ password, token }),
    updateMe: (input: UpdateMeInput) => updateMeMutation.mutateAsync(input),
    user,
  };
}

export { useAuth };
```

- [ ] **Step 2: Build the web app**

Run from `apps/client/web/`: `pnpm build 2>&1 | tail -10`

Expected: zero TypeScript errors.

- [ ] **Step 3: Run web tests**

Run from `apps/client/web/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -10`

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/client/web/src/state/useAuth.ts
git commit -m "feat(web): add forgotPassword, resetPassword, updateMe mutations to useAuth"
```

---

## PHASE 2: Observability + Integration Tests

---

### Task 11: packages/constants

**Files:**
- Create: `packages/constants/package.json`
- Create: `packages/constants/tsconfig.json`
- Create: `packages/constants/src/analytics.ts`
- Create: `packages/constants/src/index.ts`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Create the package files**

Create `packages/constants/package.json`:
```json
{
  "name": "@repo/constants",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create `packages/constants/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Create `packages/constants/src/analytics.ts`:
```typescript
export const ANALYTICS_EVENTS = {
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PROFILE_UPDATED: 'profile_updated',
  USER_LOGGED_IN: 'user_logged_in',
  USER_LOGGED_OUT: 'user_logged_out',
  USER_REGISTERED: 'user_registered',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
```

Create `packages/constants/src/index.ts`:
```typescript
export { ANALYTICS_EVENTS, type AnalyticsEvent } from './analytics.js';
```

- [ ] **Step 2: Add to pnpm-workspace.yaml**

Add `'packages/constants'` to the packages list in `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/server'
  - 'apps/client/web'
  - 'apps/client/extension'
  - 'apps/client/mobile'
  - 'packages/client-shared'
  - 'packages/constants'
  - 'packages/tokens'
  - 'packages/types'
```

- [ ] **Step 3: Install the workspace package into server and web**

Run from repo root:
```bash
pnpm --filter @template/server add @repo/constants
pnpm --filter web add @repo/constants
```

- [ ] **Step 4: Verify the package resolves**

Run: `node -e "import('@repo/constants').then(m => console.log(Object.keys(m)))" 2>&1 | head -5`

Expected output includes `ANALYTICS_EVENTS`.

- [ ] **Step 5: Commit**

```bash
git add packages/constants/ pnpm-workspace.yaml pnpm-lock.yaml apps/server/package.json apps/client/web/package.json
git commit -m "feat: add @repo/constants package with analytics event constants"
```

---

### Task 12: PostHog analytics service (server) + Sentry (server)

**Files:**
- Create: `apps/server/src/services/analytics/analytics.ts`
- Modify: `apps/server/src/handlers/auth/auth.ts` (add trackEvent calls)
- Modify: `apps/server/src/middleware/requireAuth/requireAuth.ts` (Sentry user context)
- Modify: `apps/server/src/app.ts` (Sentry init)

- [ ] **Step 1: Install server observability packages**

Run from `apps/server/`:
```bash
pnpm add @sentry/node posthog-node
```

- [ ] **Step 2: Create PostHog analytics service**

Create `apps/server/src/services/analytics/analytics.ts`:

```typescript
import { ANALYTICS_EVENTS } from '@repo/constants';
import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { PostHog } from 'posthog-node';

export type { AnalyticsEvent } from '@repo/constants';
export { ANALYTICS_EVENTS };

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.POSTHOG_API_KEY) return null;
  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      flushAt: 1,
      flushInterval: 0,
      host: 'https://us.i.posthog.com',
    });
  }
  return client;
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties });
  } catch (err) {
    logger.warn({ err, event }, 'PostHog trackEvent failed');
  }
}
```

- [ ] **Step 3: Add Sentry init to `apps/server/src/app.ts`**

At the very top of `apps/server/src/app.ts`, add Sentry import after the existing imports. Also update the `env` import to include the `env` object (currently only `isProduction` is imported):

Change:
```typescript
import { isProduction } from 'app/config/env.js';
```
To:
```typescript
import { env, isProduction } from 'app/config/env.js';
```

Then add Sentry init immediately after the import block, before `validateEnv()`:
```typescript
import * as Sentry from '@sentry/node';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}
```

Then register the Sentry error handler right before the custom `errorHandler` at the bottom:

```typescript
// ... existing code ...
app.use(notFoundHandler);
if (env.SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler());
}
app.use(errorHandler);
```

- [ ] **Step 4: Add Sentry user context to `apps/server/src/middleware/requireAuth/requireAuth.ts`**

Replace the file:

```typescript
import { SESSION_COOKIE_NAME } from 'app/constants/session.js';
import * as authRepo from 'app/repositories/auth/auth.js';
import type { NextFunction, Request, Response } from 'express';

// Sentry is optional; import lazily to avoid hard dependency when DSN not set
async function setSentryUser(id: string, email: string): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser({ email, id });
  } catch {
    // Sentry not available
  }
}

async function clearSentryUser(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.setUser(null);
  } catch {
    // Sentry not available
  }
}

export async function loadSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token || typeof token !== 'string') {
    next();
    return;
  }
  try {
    const user = await authRepo.getSessionWithUser(token);
    if (user) {
      req.user = user;
      void setSentryUser(user.id, user.email);
    }
  } catch (err) {
    next(err);
    return;
  }
  next();
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: { message: 'Authentication required' } });
    return;
  }
  next();
}

export async function clearSession(): Promise<void> {
  await clearSentryUser();
}
```

- [ ] **Step 5: Add trackEvent calls to auth handlers**

Open `apps/server/src/handlers/auth/auth.ts`.

Add import at the top:
```typescript
import { ANALYTICS_EVENTS, trackEvent } from 'app/services/analytics/analytics.js';
```

In the `register` handler, after `logger.info(...)` on success:
```typescript
trackEvent(user.id, ANALYTICS_EVENTS.USER_REGISTERED);
```

In the `login` handler, after `logger.info(...)` on success:
```typescript
trackEvent(user.id, ANALYTICS_EVENTS.USER_LOGGED_IN);
```

In the `logout` handler, after `logger.info(...)`:
```typescript
if (userId) trackEvent(userId, ANALYTICS_EVENTS.USER_LOGGED_OUT);
```

In the `forgotPassword` handler, inside the async block after `createPasswordReset`:
```typescript
trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_REQUESTED);
```

In the `resetPassword` handler, after `logger.info(...)` on success:
```typescript
trackEvent(user.id, ANALYTICS_EVENTS.PASSWORD_RESET_COMPLETED);
```

In the `updateMe` handler, after `logger.info(...)` on password change:
```typescript
trackEvent(userId, ANALYTICS_EVENTS.PROFILE_UPDATED);
```

- [ ] **Step 6: Run server tests**

Run from `apps/server/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -10`

Expected: all pass. (The mock for `app/repositories/auth/auth.js` covers the new calls; analytics service calls succeed silently.)

- [ ] **Step 7: Build server**

Run from `apps/server/`: `pnpm build 2>&1 | tail -10`

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/services/analytics/analytics.ts apps/server/src/app.ts apps/server/src/middleware/requireAuth/requireAuth.ts apps/server/src/handlers/auth/auth.ts apps/server/package.json pnpm-lock.yaml
git commit -m "feat(server): add PostHog analytics service and Sentry error tracking"
```

---

### Task 13: PostHog (web) + Sentry (web) + reverse proxy

**Files:**
- Create: `apps/client/web/sentry.client.config.ts`
- Create: `apps/client/web/sentry.server.config.ts`
- Create: `apps/client/web/instrumentation.ts`
- Create: `apps/client/web/src/app/ingest/[...path]/route.ts`
- Create: `apps/client/web/src/providers/PostHogProvider.tsx`
- Modify: `apps/client/web/src/app/layout.tsx`
- Modify: `apps/client/web/src/state/useAuth.ts`

- [ ] **Step 1: Install web observability packages**

Run from `apps/client/web/`:
```bash
pnpm add @sentry/nextjs posthog-js
```

- [ ] **Step 2: Create Sentry config files**

Create `apps/client/web/sentry.client.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}
```

Create `apps/client/web/sentry.server.config.ts`:
```typescript
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}
```

Create `apps/client/web/instrumentation.ts`:
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

Create `apps/client/web/sentry.edge.config.ts` (required by the instrumentation import):
```typescript
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}
```

- [ ] **Step 3: Enable instrumentation in next.config**

Read `apps/client/web/next.config.ts` (or `.js`) first. Add `experimental.instrumentationHook: true` if it is not already set.

If the file is TypeScript:
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create PostHog reverse proxy route handler**

Create `apps/client/web/src/app/ingest/[...path]/route.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server';

const POSTHOG_HOST = 'https://us.i.posthog.com';

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const pathname = path.join('/');
  const search = req.nextUrl.search;

  const targetUrl = `${POSTHOG_HOST}/${pathname}${search}`;

  const headers = new Headers(req.headers);
  headers.set('host', new URL(POSTHOG_HOST).host);

  const response = await fetch(targetUrl, {
    body: req.body,
    headers,
    method: req.method,
  });

  return new NextResponse(response.body, {
    headers: response.headers,
    status: response.status,
  });
}

export const GET = handler;
export const POST = handler;
```

- [ ] **Step 5: Create PostHogProvider**

Create `apps/client/web/src/providers/PostHogProvider.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

type PostHogProviderProps = {
  children: React.ReactNode;
};

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.capture('$pageview');
    }
  }, [pathname, searchParams]);

  return null;
}

PageViewTracker.displayName = 'PageViewTracker';

function PostHogProvider({ children }: PostHogProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === 'undefined' || initialized.current) return;

    posthog.init(key, {
      api_host: '/ingest',
      capture_pageview: false,
      persistence: 'localStorage',
      ui_host: 'https://us.posthog.com',
    });
    initialized.current = true;
  }, []);

  return (
    <PHProvider client={posthog}>
      <PageViewTracker />
      {children}
    </PHProvider>
  );
}

PostHogProvider.displayName = 'PostHogProvider';

export { PostHogProvider };
```

- [ ] **Step 6: Update root layout to include PostHogProvider**

Replace `apps/client/web/src/app/layout.tsx`:

```tsx
import { PostHogProvider } from '@/providers/PostHogProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.scss';

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

export const metadata: Metadata = {
  description: 'Express 5 + Next.js 15 + TypeScript monorepo template',
  title: 'template-express-next',
};

function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <PostHogProvider>
          <QueryProvider>{children}</QueryProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}

RootLayout.displayName = 'RootLayout';

export default RootLayout;
```

- [ ] **Step 7: Add PostHog identify/reset to useAuth**

Open `apps/client/web/src/state/useAuth.ts`.

Add posthog import at the top (after other imports):
```typescript
import posthog from 'posthog-js';
```

Update `loginMutation.onSuccess`:
```typescript
onSuccess: (data) => {
  queryClient.setQueryData(AUTH_KEY, data);
  posthog.identify(data.id, { email: data.email });
},
```

Update `registerMutation.onSuccess`:
```typescript
onSuccess: (data) => {
  queryClient.setQueryData(AUTH_KEY, data);
  posthog.identify(data.id, { email: data.email });
},
```

Update `logoutMutation.onSuccess`:
```typescript
onSuccess: () => {
  queryClient.setQueryData(AUTH_KEY, null);
  posthog.reset();
},
```

- [ ] **Step 8: Build web app**

Run from `apps/client/web/`: `pnpm build 2>&1 | tail -20`

Expected: build succeeds. Sentry and PostHog are gated by env vars so they are silent in dev.

- [ ] **Step 9: Run web tests**

Run from `apps/client/web/`: `pnpm test 2>&1 | grep -E "(FAIL|PASS)" | head -10`

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/client/web/sentry.client.config.ts apps/client/web/sentry.server.config.ts apps/client/web/sentry.edge.config.ts apps/client/web/instrumentation.ts apps/client/web/src/app/ingest/ apps/client/web/src/providers/PostHogProvider.tsx apps/client/web/src/app/layout.tsx apps/client/web/src/state/useAuth.ts apps/client/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add PostHog analytics, Sentry error tracking, and PostHog reverse proxy"
```

---

### Task 14: Fix ESLint no-explicit-any to error

**Files:**
- Modify: `apps/server/eslint.config.mjs`
- Modify: `apps/client/web/eslint.config.mjs`

- [ ] **Step 1: Change the rule in `apps/server/eslint.config.mjs`**

Find the line:
```javascript
'@typescript-eslint/no-explicit-any': 'warn',
```

Change it to:
```javascript
'@typescript-eslint/no-explicit-any': 'error',
```

- [ ] **Step 2: Run server lint to find existing violations**

Run from `apps/server/`: `pnpm lint 2>&1 | grep "no-explicit-any" | head -20`

Fix any reported occurrences. Common fix: replace `any` with `unknown` and add a type guard. For example:
- `(err as any).code` becomes `(err as { code?: unknown }).code`
- `Record<string, any>` becomes `Record<string, unknown>`

- [ ] **Step 3: Change the rule in `apps/client/web/eslint.config.mjs`**

Find the same line and change `'warn'` to `'error'`.

- [ ] **Step 4: Run web lint to find existing violations**

Run from `apps/client/web/`: `pnpm lint 2>&1 | grep "no-explicit-any" | head -20`

Fix any reported occurrences.

- [ ] **Step 5: Run full lint on both to confirm zero violations**

Run from repo root: `pnpm lint 2>&1 | grep -E "(error|warning)" | grep "no-explicit-any" | wc -l`

Expected: 0

- [ ] **Step 6: Commit**

```bash
git add apps/server/eslint.config.mjs apps/client/web/eslint.config.mjs
# Include any source files where any was fixed
git commit -m "fix(lint): promote no-explicit-any from warn to error; replace all any usages"
```

---

### Task 15: Integration tests

**Files:**
- Create: `apps/server/vitest.integration.config.ts`
- Create: `apps/server/src/__tests__/integration/auth-flow.test.ts`
- Modify: `apps/server/package.json` (update test:integration script)

- [ ] **Step 1: Create `apps/server/vitest.integration.config.ts`**

```typescript
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { app: path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 2: Update `apps/server/package.json` test:integration script**

Change:
```json
"test:integration": "vitest run integration"
```
To:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```

- [ ] **Step 3: Write the integration test file**

Create `apps/server/src/__tests__/integration/auth-flow.test.ts`:

```typescript
// Build a minimal test app to avoid importing app.ts which calls app.listen() and validateEnv()
// at module scope. This gives us a clean Express instance with all auth middleware and routes.
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { csrfGuard } from 'app/middleware/csrfGuard/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { loadSession } from 'app/middleware/requireAuth/requireAuth.js';
import { authRouter } from 'app/routes/auth.js';
import { pool } from 'app/db/pool/pool.js';

const testApp = express();
testApp.use(express.json({ limit: '10kb' }));
testApp.use(cookieParser());
testApp.use(csrfGuard);
testApp.use(loadSession);
testApp.use('/auth', authRouter);
testApp.use(errorHandler);

const DB_AVAILABLE = !!process.env.DATABASE_URL;

/**
 * Integration tests: run against a real Express app and real DB.
 * Skip gracefully when DATABASE_URL is not set.
 * Run: pnpm --filter server run test:integration
 */
describe.skipIf(!DB_AVAILABLE)('auth integration', () => {
  const TEST_EMAIL = `test-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'password123';

  beforeEach(async () => {
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM password_resets');
    await pool.query("DELETE FROM users WHERE email LIKE 'test-%@example.com'");
  });

  afterAll(async () => {
    await pool.end();
  });

  function agent() {
    return request(testApp);
  }

  describe('POST /auth/register', () => {
    it('returns 201 and sets session cookie', async () => {
      const res = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 409 on duplicate email', async () => {
      await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const res = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    });

    it('returns 200 and sets session cookie with valid credentials', async () => {
      const res = await agent()
        .post('/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('returns 401 with invalid credentials', async () => {
      const res = await agent()
        .post('/auth/login')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('returns 401 without session', async () => {
      const res = await agent()
        .get('/auth/me')
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(401);
    });

    it('returns 200 with authenticated user', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie = (registerRes.headers['set-cookie'] as string[])[0];

      const res = await agent()
        .get('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and subsequent /me returns 401', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie = (registerRes.headers['set-cookie'] as string[])[0];

      const logoutRes = await agent()
        .post('/auth/logout')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(logoutRes.status).toBe(204);

      const meRes = await agent()
        .get('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest');

      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('always returns 200 regardless of whether email exists', async () => {
      const res = await agent()
        .post('/auth/forgot-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: 'nobody@example.com' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /auth/reset-password', () => {
    it('returns 400 with an invalid token', async () => {
      const res = await agent()
        .post('/auth/reset-password')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ password: 'newpassword123', token: 'invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Invalid or expired token');
    });
  });

  describe('PATCH /auth/me', () => {
    it('returns 200 with updated user after password change', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie = (registerRes.headers['set-cookie'] as string[])[0];

      const res = await agent()
        .patch('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'newpassword456' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    it('returns 400 when currentPassword is wrong', async () => {
      const registerRes = await agent()
        .post('/auth/register')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      const cookie = (registerRes.headers['set-cookie'] as string[])[0];

      const res = await agent()
        .patch('/auth/me')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ currentPassword: 'wrong-password', newPassword: 'newpassword456' });

      expect(res.status).toBe(400);
    });
  });
});
```

- [ ] **Step 4: Run integration tests (skip if no DB)**

Run from `apps/server/`: `pnpm run test:integration 2>&1 | tail -20`

If `DATABASE_URL` is set: expected all 12 tests to pass.
If `DATABASE_URL` is not set: expected "skipped" output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/server/vitest.integration.config.ts apps/server/src/__tests__/integration/auth-flow.test.ts apps/server/package.json
git commit -m "test(server): add integration test suite for auth flow"
```

---

## Self-Review Checklist

Run these after all tasks complete:

- [ ] Run from repo root: `pnpm build` -- expected: zero errors across all workspaces
- [ ] Run from `apps/server/`: `pnpm test:coverage` -- expected: 80% thresholds met
- [ ] Run from `apps/client/web/`: `pnpm test` -- expected: all pass
- [ ] Run from repo root: `pnpm lint` -- expected: zero errors, zero warnings for no-explicit-any
- [ ] Run from repo root: `pnpm format:check` -- expected: all files formatted
