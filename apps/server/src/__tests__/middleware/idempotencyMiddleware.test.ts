import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createIdempotencyMiddleware } from 'app/middleware/idempotencyMiddleware.js';
import type { IdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import { hashToken } from 'app/services/hashService.js';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface ClaimInput {
  key: string;
  requestBodyHash: string;
  requestMethod: string;
  requestPath: string;
  userId: string;
}

interface StoredKey {
  requestBodyHash: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  responseBody: unknown;
  status: 'completed' | 'in_progress';
  statusCode: number | null;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

const userId = uuid();

// In-memory stand-in for the idempotency repository. It implements the spec's
// claim semantics (a claim succeeds only when no row exists for key + user) so
// the tests can assert on the stored rows the way they would on database rows.
function createFakeIdempotencyRepo() {
  const rows = new Map<string, StoredKey>();

  function rowId(key: string, ownerId: string): string {
    return `${ownerId}:${key}`;
  }

  return {
    claimKey: vi.fn((input: ClaimInput): Promise<boolean> => {
      const id = rowId(input.key, input.userId);
      if (rows.has(id)) {
        return Promise.resolve(false);
      }
      rows.set(id, {
        requestBodyHash: input.requestBodyHash,
        requestMethod: input.requestMethod,
        requestPath: input.requestPath,
        responseBody: null,
        status: 'in_progress',
        statusCode: null,
      });
      return Promise.resolve(true);
    }),
    completeKey: vi.fn(
      (
        key: string,
        ownerId: string,
        statusCode: number,
        responseBody: unknown,
      ): Promise<void> => {
        const existing = rows.get(rowId(key, ownerId));
        if (existing) {
          rows.set(rowId(key, ownerId), {
            ...existing,
            responseBody,
            status: 'completed',
            statusCode,
          });
        }
        return Promise.resolve();
      },
    ),
    findKey: vi.fn(
      (key: string, ownerId: string): Promise<StoredKey | null> =>
        Promise.resolve(rows.get(rowId(key, ownerId)) ?? null),
    ),
    releaseKey: vi.fn((key: string, ownerId: string): Promise<void> => {
      const existing = rows.get(rowId(key, ownerId));
      if (existing?.status === 'in_progress') {
        rows.delete(rowId(key, ownerId));
      }
      return Promise.resolve();
    }),
    rows,
    seedKey(key: string, row: StoredKey): void {
      rows.set(rowId(key, userId), row);
    },
    storedKey(key: string): StoredKey | undefined {
      return rows.get(rowId(key, userId));
    },
  };
}

function createDeferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function hashBody(body: unknown): string {
  return hashToken(JSON.stringify(body ?? {}));
}

let fakeRepo = createFakeIdempotencyRepo();
let gate = createDeferred();
let runCounts: Record<string, number> = {};

function countRun(route: string): number {
  runCounts[route] = (runCounts[route] ?? 0) + 1;
  return runCounts[route];
}

function runsOf(route: string): number {
  return runCounts[route] ?? 0;
}

// Builds an app that optionally injects a user, mounts the middleware, and
// registers handlers that count their own runs so each test can assert how many
// times the handler actually executed.
function buildApp(withUser: boolean) {
  const app = express();
  app.use(express.json());
  if (withUser) {
    app.use((req, _res, next) => {
      req.user = {
        created_at: new Date('2025-01-01'),
        email: 'user@example.com',
        id: userId,
        role: 'user',
        updated_at: null,
      };
      next();
    });
  }
  app.use(createIdempotencyMiddleware(fakeRepo as unknown as IdempotencyRepo));
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
  app.get('/create', (_req: Request, res: Response) => {
    const run = countRun('get');
    res.status(200).json({ data: { run } });
  });
  app.post('/flaky', (_req: Request, res: Response) => {
    const run = countRun('flaky');
    if (run === 1) {
      res.status(500).json({ error: 'transient failure' });
      return;
    }
    res.status(201).json({ data: { run } });
  });
  app.post('/throws', (_req: Request, res: Response) => {
    const run = countRun('throws');
    if (run === 1) {
      throw new Error('transient failure');
    }
    res.status(201).json({ data: { run } });
  });
  app.post('/unavailable', (_req: Request, res: Response) => {
    const run = countRun('unavailable');
    if (run === 1) {
      res.status(503).json({ error: 'try later' });
      return;
    }
    res.status(201).json({ data: { run } });
  });
  app.post('/invalid', (_req: Request, res: Response) => {
    const run = countRun('invalid');
    res.status(400).json({ error: `invalid input ${String(run)}` });
  });
  app.post('/empty', (_req: Request, res: Response) => {
    countRun('empty');
    res.status(204).end();
  });
  app.post('/slow', async (_req: Request, res: Response) => {
    const run = countRun('slow');
    await gate.promise;
    res.status(201).json({ data: { run } });
  });
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: String(err) });
  });
  return app;
}

async function waitForStatus(
  key: string,
  status: 'absent' | 'completed',
): Promise<void> {
  await vi.waitFor(() => {
    const row = fakeRepo.storedKey(key);
    if (status === 'absent') {
      expect(row).toBeUndefined();
    } else {
      expect(row?.status).toBe('completed');
    }
  });
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    fakeRepo = createFakeIdempotencyRepo();
    gate = createDeferred();
    runCounts = {};
  });

  describe('replay of a completed request (I-1)', () => {
    it('replays the stored status and body and runs the handler once', async () => {
      const app = buildApp(true);
      const payload = { title: 'First' };

      const first = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k1')
        .send(payload);
      await waitForStatus('k1', 'completed');
      const second = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k1')
        .send(payload);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body);
      expect(runsOf('create')).toBe(1);
    });

    it('replays a PUT the same way', async () => {
      const app = buildApp(true);
      const payload = { title: 'Put' };

      const first = await request(app)
        .put('/create')
        .set('Idempotency-Key', 'k-put')
        .send(payload);
      await waitForStatus('k-put', 'completed');
      const second = await request(app)
        .put('/create')
        .set('Idempotency-Key', 'k-put')
        .send(payload);

      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect(runsOf('create')).toBe(1);
    });

    it('stores the request fingerprint and the completed response', async () => {
      const app = buildApp(true);
      const payload = { title: 'Fingerprint' };

      const res = await request(app)
        .post('/create?page=2')
        .set('Idempotency-Key', 'k-print')
        .send(payload);
      await waitForStatus('k-print', 'completed');

      expect(fakeRepo.storedKey('k-print')).toEqual({
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/create?page=2',
        responseBody: res.body as unknown,
        status: 'completed',
        statusCode: 201,
      });
    });

    it('replays a seeded completed row whose fingerprint matches', async () => {
      const app = buildApp(true);
      const payload = { title: 'Seeded' };
      fakeRepo.seedKey('k-seed', {
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/create',
        responseBody: { data: 'stored' },
        status: 'completed',
        statusCode: 202,
      });

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-seed')
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body).toEqual({ data: 'stored' });
      expect(runsOf('create')).toBe(0);
    });
  });

  describe('release on failure (I-2)', () => {
    it('lets a retry run the handler again after a 500 response', async () => {
      const app = buildApp(true);

      const first = await request(app)
        .post('/flaky')
        .set('Idempotency-Key', 'k-flaky')
        .send({ n: 1 });
      await waitForStatus('k-flaky', 'absent');
      const second = await request(app)
        .post('/flaky')
        .set('Idempotency-Key', 'k-flaky')
        .send({ n: 1 });

      expect(first.status).toBe(500);
      expect(second.status).toBe(201);
      expect(second.body).toEqual({ data: { run: 2 } });
      expect(runsOf('flaky')).toBe(2);
    });

    it('lets a retry run the handler again after a 503 response', async () => {
      const app = buildApp(true);

      const first = await request(app)
        .post('/unavailable')
        .set('Idempotency-Key', 'k-503')
        .send({ n: 1 });
      await waitForStatus('k-503', 'absent');
      const second = await request(app)
        .post('/unavailable')
        .set('Idempotency-Key', 'k-503')
        .send({ n: 1 });

      expect(first.status).toBe(503);
      expect(second.status).toBe(201);
      expect(runsOf('unavailable')).toBe(2);
    });

    it('lets a retry run the handler again after it throws', async () => {
      const app = buildApp(true);

      const first = await request(app)
        .post('/throws')
        .set('Idempotency-Key', 'k-throw')
        .send({ n: 1 });
      await waitForStatus('k-throw', 'absent');
      const second = await request(app)
        .post('/throws')
        .set('Idempotency-Key', 'k-throw')
        .send({ n: 1 });

      expect(first.status).toBe(500);
      expect(second.status).toBe(201);
      expect(runsOf('throws')).toBe(2);
    });

    it('replays the successful retry once the failure was released', async () => {
      const app = buildApp(true);
      const send = () =>
        request(app)
          .post('/flaky')
          .set('Idempotency-Key', 'k-heal')
          .send({ n: 1 });

      await send();
      await waitForStatus('k-heal', 'absent');
      const healed = await send();
      await waitForStatus('k-heal', 'completed');
      const replayed = await send();

      expect(replayed.status).toBe(201);
      expect(replayed.body).toEqual(healed.body);
      expect(runsOf('flaky')).toBe(2);
    });

    it('releases the claim when the client disconnects mid-request', async () => {
      const app = buildApp(true);

      await expect(
        request(app)
          .post('/slow')
          .set('Idempotency-Key', 'k-abort')
          .send({ n: 1 })
          .timeout(100),
      ).rejects.toThrow();
      await waitForStatus('k-abort', 'absent');
      gate.resolve();

      expect(runsOf('slow')).toBe(1);
    });
  });

  describe('in-flight claim (I-3)', () => {
    it('answers 409 while the first request is still running', async () => {
      const app = buildApp(true);
      const payload = { n: 1 };
      const first = request(app)
        .post('/slow')
        .set('Idempotency-Key', 'k-slow')
        .send(payload)
        .then((res) => res);
      await vi.waitFor(() => {
        expect(runsOf('slow')).toBe(1);
      });

      // Release the first request once the second is answered, or once the
      // second has wrongly entered the handler, so a failure cannot hang.
      let isSecondAnswered = false;
      const pendingSecond = request(app)
        .post('/slow')
        .set('Idempotency-Key', 'k-slow')
        .send(payload)
        .then((res) => {
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

    it('answers 409 for a seeded in-progress row with a matching fingerprint', async () => {
      const app = buildApp(true);
      const payload = { title: 'Pending' };
      fakeRepo.seedKey('k-pending', {
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/create',
        responseBody: null,
        status: 'in_progress',
        statusCode: null,
      });

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-pending')
        .send(payload);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        error: expect.any(String) as unknown,
      });
      expect(runsOf('create')).toBe(0);
    });
  });

  describe('key reuse with a different request (I-4)', () => {
    const payload = { title: 'Original' };

    beforeEach(() => {
      fakeRepo.seedKey('k-reuse', {
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/create',
        responseBody: { data: 'original' },
        status: 'completed',
        statusCode: 201,
      });
    });

    it('answers 422 for a different body', async () => {
      const app = buildApp(true);

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-reuse')
        .send({ title: 'Changed' });

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        code: 'IDEMPOTENCY_KEY_REUSED',
        error: expect.any(String) as unknown,
      });
      expect(runsOf('create')).toBe(0);
    });

    it('answers 422 for a different path', async () => {
      const app = buildApp(true);

      const res = await request(app)
        .post('/other')
        .set('Idempotency-Key', 'k-reuse')
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        code: 'IDEMPOTENCY_KEY_REUSED',
        error: expect.any(String) as unknown,
      });
      expect(runsOf('other')).toBe(0);
    });

    it('answers 422 for a different method', async () => {
      const app = buildApp(true);

      const res = await request(app)
        .put('/create')
        .set('Idempotency-Key', 'k-reuse')
        .send(payload);

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        code: 'IDEMPOTENCY_KEY_REUSED',
        error: expect.any(String) as unknown,
      });
      expect(runsOf('create')).toBe(0);
    });

    it('answers 422 for a different body while the first is in progress', async () => {
      const app = buildApp(true);
      fakeRepo.seedKey('k-reuse', {
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/create',
        responseBody: null,
        status: 'in_progress',
        statusCode: null,
      });

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-reuse')
        .send({ title: 'Changed' });

      expect(res.status).toBe(422);
      expect(runsOf('create')).toBe(0);
    });
  });

  describe('4xx responses (I-7)', () => {
    it('completes the claim and replays the stored 400', async () => {
      const app = buildApp(true);
      const payload = { title: '' };

      const first = await request(app)
        .post('/invalid')
        .set('Idempotency-Key', 'k-400')
        .send(payload);
      await waitForStatus('k-400', 'completed');
      const second = await request(app)
        .post('/invalid')
        .set('Idempotency-Key', 'k-400')
        .send(payload);

      expect(first.status).toBe(400);
      expect(second.status).toBe(400);
      expect(second.body).toEqual({ error: 'invalid input 1' });
      expect(runsOf('invalid')).toBe(1);
      expect(fakeRepo.storedKey('k-400')?.statusCode).toBe(400);
    });
  });

  describe('responses without a JSON body (I-8)', () => {
    it('stores a 204 with a null body and replays it as an empty 204', async () => {
      const app = buildApp(true);
      const payload = { n: 1 };

      const first = await request(app)
        .post('/empty')
        .set('Idempotency-Key', 'k-204')
        .send(payload);
      await waitForStatus('k-204', 'completed');
      const second = await request(app)
        .post('/empty')
        .set('Idempotency-Key', 'k-204')
        .send(payload);

      expect(first.status).toBe(204);
      expect(second.status).toBe(204);
      expect(second.text).toBe('');
      expect(runsOf('empty')).toBe(1);
      expect(fakeRepo.storedKey('k-204')).toMatchObject({
        responseBody: null,
        status: 'completed',
        statusCode: 204,
      });
    });

    it('replays a seeded 204 row with no stored body as an empty 204', async () => {
      const app = buildApp(true);
      const payload = { n: 2 };
      fakeRepo.seedKey('k-204-seed', {
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/empty',
        responseBody: null,
        status: 'completed',
        statusCode: 204,
      });

      const res = await request(app)
        .post('/empty')
        .set('Idempotency-Key', 'k-204-seed')
        .send(payload);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect(runsOf('empty')).toBe(0);
    });
  });

  describe('requests the middleware does not apply to (I-9)', () => {
    it('passes through when no Idempotency-Key header is present', async () => {
      const app = buildApp(true);

      await request(app).post('/create').send({ n: 1 });
      const second = await request(app).post('/create').send({ n: 1 });

      expect(second.status).toBe(201);
      expect(runsOf('create')).toBe(2);
      expect(fakeRepo.rows.size).toBe(0);
    });

    it('passes through GET requests even with a key', async () => {
      const app = buildApp(true);

      await request(app).get('/create').set('Idempotency-Key', 'k-get');
      const second = await request(app)
        .get('/create')
        .set('Idempotency-Key', 'k-get');

      expect(second.status).toBe(200);
      expect(runsOf('get')).toBe(2);
      expect(fakeRepo.rows.size).toBe(0);
    });

    it('passes through when the request is unauthenticated', async () => {
      const app = buildApp(false);

      await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-anon')
        .send({ n: 1 });
      const second = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-anon')
        .send({ n: 1 });

      expect(second.status).toBe(201);
      expect(runsOf('create')).toBe(2);
      expect(fakeRepo.rows.size).toBe(0);
    });
  });
});
