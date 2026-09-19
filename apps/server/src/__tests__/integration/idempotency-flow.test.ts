// Integration test: the idempotency middleware claims a key before the handler
// runs, replays completed responses, releases failed claims, and binds a key to
// one request fingerprint, against the real database. Schema migration,
// TRUNCATE between tests, and pool teardown live in setup.ts.
import { query, withTransaction } from 'app/database/databasePool.js';
import { createIdempotencyMiddleware } from 'app/middleware/idempotencyMiddleware.js';
import { createIdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import type { User } from 'app/schemas/authSchema.js';
import express from 'express';
import type { Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

const DB_AVAILABLE = !!process.env.DATABASE_URL;

let currentUser: User | undefined;
let gate = createDeferred();
let runCounts: Record<string, number> = {};

function createDeferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function countRun(route: string): number {
  runCounts[route] = (runCounts[route] ?? 0) + 1;
  return runCounts[route];
}

function runsOf(route: string): number {
  return runCounts[route] ?? 0;
}

// Minimal app: a user injected from a real users row, the middleware bound to
// the real repository, and routes whose outcomes each test controls.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = currentUser;
    next();
  });
  app.use(
    createIdempotencyMiddleware(
      createIdempotencyRepo({ query, withTransaction }),
    ),
  );
  app.post('/create', (req: Request, res: Response) => {
    const run = countRun('create');
    res.status(201).json({ data: { body: req.body as unknown, run } });
  });
  app.put('/create', (req: Request, res: Response) => {
    const run = countRun('create');
    res.status(200).json({ data: { body: req.body as unknown, run } });
  });
  app.post('/other', (_req: Request, res: Response) => {
    const run = countRun('other');
    res.status(201).json({ data: { run } });
  });
  app.post('/flaky', (_req: Request, res: Response) => {
    const run = countRun('flaky');
    if (run === 1) {
      res.status(500).json({ error: 'transient failure' });
      return;
    }
    res.status(201).json({ data: { run } });
  });
  app.post('/slow', async (_req: Request, res: Response) => {
    const run = countRun('slow');
    await gate.promise;
    res.status(201).json({ data: { run } });
  });
  app.post('/empty', (_req: Request, res: Response) => {
    countRun('empty');
    res.status(204).end();
  });
  app.post('/invalid', (_req: Request, res: Response) => {
    const run = countRun('invalid');
    res.status(400).json({ error: `invalid input ${String(run)}` });
  });
  return app;
}

const testApp = buildApp();

async function insertUser(): Promise<User> {
  const email = `idem-${String(Date.now())}-${String(Math.round(Math.random() * 1e6))}@example.com`;
  const result = await query<User>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2)
     RETURNING id, email, role, created_at, updated_at`,
    [email, 'placeholder-hash-not-used-for-login'],
  );
  const [user] = result.rows;
  if (!user) {
    throw new Error('users insert returned no row');
  }
  return user;
}

async function readKeyStatus(key: string): Promise<string | null> {
  const result = await query<{ status: string }>(
    'SELECT status FROM idempotency_keys WHERE key = $1',
    [key],
  );
  return result.rows[0]?.status ?? null;
}

// The claim is completed or released when the response finishes, which can
// land just after the client has read it, so retries wait for the row state.
async function waitForKeyStatus(
  key: string,
  expected: 'completed' | null,
): Promise<void> {
  await vi.waitFor(
    async () => {
      expect(await readKeyStatus(key)).toBe(expected);
    },
    { timeout: 3_000 },
  );
}

function post(path: string, key: string, body: object) {
  return request(testApp).post(path).set('Idempotency-Key', key).send(body);
}

describe.skipIf(!DB_AVAILABLE)('idempotency integration', () => {
  beforeEach(async () => {
    currentUser = await insertUser();
    gate = createDeferred();
    runCounts = {};
  });

  it('replays a completed response for a retried POST (I-1)', async () => {
    const payload = { title: 'First post' };

    const first = await post('/create', 'key-replay', payload);
    await waitForKeyStatus('key-replay', 'completed');
    const second = await post('/create', 'key-replay', payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);
    expect(runsOf('create')).toBe(1);
  });

  it('answers 422 when the key is reused with a different body (I-4)', async () => {
    const first = await post('/create', 'key-body', { title: 'First post' });
    await waitForKeyStatus('key-body', 'completed');
    const second = await post('/create', 'key-body', {
      title: 'Different post',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(422);
    expect(second.body).toEqual({
      code: 'IDEMPOTENCY_KEY_REUSED',
      error: expect.any(String) as unknown,
    });
    expect(runsOf('create')).toBe(1);
  });

  it('answers 422 when the key is reused on a different path (I-4)', async () => {
    const payload = { title: 'First post' };

    await post('/create', 'key-path', payload);
    await waitForKeyStatus('key-path', 'completed');
    const second = await post('/other', 'key-path', payload);

    expect(second.status).toBe(422);
    expect(second.body).toEqual({
      code: 'IDEMPOTENCY_KEY_REUSED',
      error: expect.any(String) as unknown,
    });
    expect(runsOf('other')).toBe(0);
  });

  it('answers 422 when the key is reused with a different method (I-4)', async () => {
    const payload = { title: 'First post' };

    await post('/create', 'key-method', payload);
    await waitForKeyStatus('key-method', 'completed');
    const second = await request(testApp)
      .put('/create')
      .set('Idempotency-Key', 'key-method')
      .send(payload);

    expect(second.status).toBe(422);
    expect(second.body).toEqual({
      code: 'IDEMPOTENCY_KEY_REUSED',
      error: expect.any(String) as unknown,
    });
    expect(runsOf('create')).toBe(1);
  });

  it('releases a failed claim so the retry runs the handler (I-2)', async () => {
    const payload = { n: 1 };

    const first = await post('/flaky', 'key-flaky', payload);
    await waitForKeyStatus('key-flaky', null);
    const second = await post('/flaky', 'key-flaky', payload);
    await waitForKeyStatus('key-flaky', 'completed');
    const third = await post('/flaky', 'key-flaky', payload);

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(second.body).toEqual({ data: { run: 2 } });
    expect(third.status).toBe(201);
    expect(third.body).toEqual(second.body);
    expect(runsOf('flaky')).toBe(2);
  });

  it('answers 409 while the first request is still running (I-3)', async () => {
    const payload = { n: 1 };
    const first = post('/slow', 'key-slow', payload).then((res) => res);
    await vi.waitFor(() => {
      expect(runsOf('slow')).toBe(1);
    });

    // Release the first request once the second is answered, or once the
    // second has wrongly entered the handler, so a failure cannot hang.
    let isSecondAnswered = false;
    const pendingSecond = post('/slow', 'key-slow', payload).then((res) => {
      isSecondAnswered = true;
      return res;
    });
    await vi.waitFor(() => {
      expect(isSecondAnswered || runsOf('slow') > 1).toBe(true);
    });
    gate.resolve();
    const [firstRes, second] = await Promise.all([first, pendingSecond]);

    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      error: expect.any(String) as unknown,
    });
    expect(firstRes.status).toBe(201);
    expect(runsOf('slow')).toBe(1);
  });

  it('treats a key older than 24 hours as new (I-5)', async () => {
    const payload = { title: 'Aged' };

    const first = await post('/create', 'key-aged', payload);
    await waitForKeyStatus('key-aged', 'completed');
    await query(
      `UPDATE idempotency_keys SET created_at = NOW() - INTERVAL '25 hours'
       WHERE key = $1`,
      ['key-aged'],
    );
    const second = await post('/create', 'key-aged', payload);
    await waitForKeyStatus('key-aged', 'completed');
    const third = await post('/create', 'key-aged', payload);

    expect(first.body).toEqual({ data: { body: payload, run: 1 } });
    expect(second.status).toBe(201);
    expect(second.body).toEqual({ data: { body: payload, run: 2 } });
    expect(third.status).toBe(201);
    expect(third.body).toEqual(second.body);
    expect(runsOf('create')).toBe(2);
  });

  it('runs the handler once for two simultaneous requests (I-6)', async () => {
    const payload = { n: 1 };
    const both = Promise.all([
      post('/slow', 'key-race', payload).then((res) => res),
      post('/slow', 'key-race', payload).then((res) => res),
    ]);
    await vi.waitFor(() => {
      expect(runsOf('slow')).toBeGreaterThanOrEqual(1);
    });
    gate.resolve();
    const responses = await both;

    const statuses = responses.map((res) => res.status).sort();
    const [winner] = responses.filter((res) => res.status === 201);
    const [other] = responses.filter((res) => res !== winner);

    expect(runsOf('slow')).toBe(1);
    expect(winner?.body).toEqual({ data: { run: 1 } });
    expect([
      [201, 201],
      [201, 409],
    ]).toContainEqual(statuses);
    if (other?.status === 201) {
      expect(other.body).toEqual(winner?.body);
    }
  });

  it('replays a completed 204 as 204 with an empty body (I-8)', async () => {
    const payload = { n: 1 };

    const first = await post('/empty', 'key-204', payload);
    await waitForKeyStatus('key-204', 'completed');
    const second = await post('/empty', 'key-204', payload);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(second.text).toBe('');
    expect(runsOf('empty')).toBe(1);
  });

  it('completes and replays a 400 response (I-7)', async () => {
    const payload = { title: '' };

    const first = await post('/invalid', 'key-400', payload);
    await waitForKeyStatus('key-400', 'completed');
    const second = await post('/invalid', 'key-400', payload);

    expect(first.status).toBe(400);
    expect(second.status).toBe(400);
    expect(second.body).toEqual({ error: 'invalid input 1' });
    expect(runsOf('invalid')).toBe(1);
  });

  it('does not deduplicate when no Idempotency-Key is sent (I-9)', async () => {
    for (const title of ['One', 'Two']) {
      const res = await request(testApp).post('/create').send({ title });
      expect(res.status).toBe(201);
    }

    expect(runsOf('create')).toBe(2);
  });
});
