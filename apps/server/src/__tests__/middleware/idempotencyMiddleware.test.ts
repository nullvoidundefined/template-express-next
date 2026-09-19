import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createIdempotencyMiddleware } from 'app/middleware/idempotencyMiddleware.js';
import type { IdempotencyRepo } from 'app/repositories/idempotencyRepository.js';
import { hashToken } from 'app/services/hashService.js';
import { logger } from 'app/services/loggerService.js';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ClaimInput {
  key: string;
  requestBodyHash: string;
  requestMethod: string;
  requestPath: string;
  userId: string;
}

interface StoredKey {
  hasJsonBody: boolean;
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

interface FakeIdempotencyRepo {
  claimKey: (input: ClaimInput) => Promise<boolean>;
  completeKey: (
    key: string,
    ownerId: string,
    statusCode: number,
    responseBody: unknown,
    hasJsonBody: boolean,
  ) => Promise<void>;
  findKey: (key: string, ownerId: string) => Promise<StoredKey | null>;
  releaseKey: (key: string, ownerId: string) => Promise<void>;
  rows: Map<string, StoredKey>;
  seedKey: (key: string, row: StoredKey) => void;
  storedKey: (key: string) => StoredKey | undefined;
}

// In-memory stand-in for the idempotency repository. It implements the spec's
// claim semantics (a claim succeeds only when no row exists for key + user) so
// the tests can assert on the stored rows the way they would on database rows.
// Tests replace single methods to simulate slow or failing storage.
function createFakeIdempotencyRepo(): FakeIdempotencyRepo {
  const rows = new Map<string, StoredKey>();

  function rowId(key: string, ownerId: string): string {
    return `${ownerId}:${key}`;
  }

  return {
    claimKey(input: ClaimInput): Promise<boolean> {
      const id = rowId(input.key, input.userId);
      if (rows.has(id)) {
        return Promise.resolve(false);
      }
      rows.set(id, {
        hasJsonBody: false,
        requestBodyHash: input.requestBodyHash,
        requestMethod: input.requestMethod,
        requestPath: input.requestPath,
        responseBody: null,
        status: 'in_progress',
        statusCode: null,
      });
      return Promise.resolve(true);
    },
    completeKey(
      key: string,
      ownerId: string,
      statusCode: number,
      responseBody: unknown,
      hasJsonBody: boolean,
    ): Promise<void> {
      const existing = rows.get(rowId(key, ownerId));
      if (existing?.status === 'in_progress') {
        rows.set(rowId(key, ownerId), {
          ...existing,
          hasJsonBody,
          responseBody,
          status: 'completed',
          statusCode,
        });
      }
      return Promise.resolve();
    },
    findKey(key: string, ownerId: string): Promise<StoredKey | null> {
      return Promise.resolve(rows.get(rowId(key, ownerId)) ?? null);
    },
    releaseKey(key: string, ownerId: string): Promise<void> {
      const existing = rows.get(rowId(key, ownerId));
      if (existing?.status === 'in_progress') {
        rows.delete(rowId(key, ownerId));
      }
      return Promise.resolve();
    },
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

const REQUEST_ID = 'req-idempotency-test';
const USER_EMAIL = 'user@example.com';

let fakeRepo = createFakeIdempotencyRepo();
let gate = createDeferred();
let isClientGone = false;
let runCounts: Record<string, number> = {};
let timeoutFired = createDeferred();

function countRun(route: string): number {
  runCounts[route] = (runCounts[route] ?? 0) + 1;
  return runCounts[route];
}

function runsOf(route: string): number {
  return runCounts[route] ?? 0;
}

// Mirrors the request timeout middleware in app.ts: on expiry it answers 408
// through res.json, then destroys the request. It also resolves timeoutFired so
// a test can hold storage until the timeout has happened.
function createTimeoutMiddleware(timeoutMs: number) {
  return function requestTimeout(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(408).json({
          code: 'SERVER_REQUEST_TIMEOUT',
          error: 'Request timeout',
        });
      }
      req.destroy();
      timeoutFired.resolve();
    });
    next();
  };
}

// Records whether the connection closed before the response finished, so a
// test can wait until the server has seen the client disconnect.
function trackClientDisconnect(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.on('close', () => {
    if (!res.writableFinished) {
      isClientGone = true;
    }
  });
  next();
}

// Builds an app that optionally injects a user, mounts the middleware, and
// registers handlers that count their own runs so each test can assert how many
// times the handler actually executed. A timeout, when given, is registered
// before the idempotency middleware, as in app.ts.
function buildApp(withUser: boolean, timeoutMs?: number) {
  const app = express();
  app.use(express.json());
  if (timeoutMs !== undefined) {
    app.use(createTimeoutMiddleware(timeoutMs));
  }
  app.use(trackClientDisconnect);
  if (withUser) {
    app.use((req, _res, next) => {
      req.id = REQUEST_ID;
      req.user = {
        created_at: new Date('2025-01-01'),
        email: USER_EMAIL,
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
  // The first call outlives any request timeout; later calls answer at once.
  app.post('/hang', async (_req: Request, res: Response) => {
    const run = countRun('hang');
    if (run === 1) {
      await gate.promise;
    }
    if (!res.headersSent) {
      res.status(201).json({ data: { run } });
    }
  });
  app.post('/null-body', (_req: Request, res: Response) => {
    countRun('null-body');
    res.status(200).json(null);
  });
  app.post('/end-200', (_req: Request, res: Response) => {
    countRun('end-200');
    res.status(200).end();
  });
  app.post('/text', (_req: Request, res: Response) => {
    countRun('text');
    res.status(200).send('plain text');
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
    isClientGone = false;
    runCounts = {};
    timeoutFired = createDeferred();
  });

  afterEach(() => {
    gate.resolve();
    vi.restoreAllMocks();
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
        hasJsonBody: true,
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
        hasJsonBody: true,
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
        hasJsonBody: false,
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
        hasJsonBody: true,
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
        hasJsonBody: false,
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
        hasJsonBody: false,
        responseBody: null,
        status: 'completed',
        statusCode: 204,
      });
    });

    it('replays a seeded 204 row with no stored body as an empty 204', async () => {
      const app = buildApp(true);
      const payload = { n: 2 };
      fakeRepo.seedKey('k-204-seed', {
        hasJsonBody: false,
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

  describe('request timeout (I-10)', () => {
    it('releases the claim after a 408 timeout so the retry runs the handler', async () => {
      const app = buildApp(true, 50);
      const payload = { n: 1 };

      // A socket hang-up is recorded as a null status so it fails the 408
      // assertion below instead of throwing.
      const first = await request(app)
        .post('/hang')
        .set('Idempotency-Key', 'k-timeout')
        .send(payload)
        .then(
          (res) => ({ body: res.body as unknown, status: res.status }),
          () => ({ body: null, status: null }),
        );
      await waitForStatus('k-timeout', 'absent');
      const retry = await request(app)
        .post('/hang')
        .set('Idempotency-Key', 'k-timeout')
        .send(payload);

      expect(first).toEqual({
        body: {
          code: 'SERVER_REQUEST_TIMEOUT',
          error: expect.any(String) as unknown,
        },
        status: 408,
      });
      expect(retry.status).toBe(201);
      expect(retry.body).toEqual({ data: { run: 2 } });
      expect(runsOf('hang')).toBe(2);
    });
  });

  describe('client disconnect during the claim (I-11)', () => {
    it('releases a claim that resolves after the client has gone', async () => {
      const claimGate = createDeferred();
      const { claimKey } = fakeRepo;
      let isClaimWritten = false;
      fakeRepo.claimKey = async (input: ClaimInput): Promise<boolean> => {
        await claimGate.promise;
        const isClaimed = await claimKey(input);
        isClaimWritten = isClaimed;
        return isClaimed;
      };
      const app = buildApp(true);

      await expect(
        request(app)
          .post('/create')
          .set('Idempotency-Key', 'k-late-claim')
          .send({ n: 1 })
          .timeout(50),
      ).rejects.toThrow();
      await vi.waitFor(() => {
        expect(isClientGone).toBe(true);
      });
      claimGate.resolve();
      await vi.waitFor(() => {
        expect(isClaimWritten).toBe(true);
      });

      await waitForStatus('k-late-claim', 'absent');
    });
  });

  describe('failure to store the response (I-12)', () => {
    it('releases the claim so the retry runs the handler', async () => {
      vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      fakeRepo.completeKey = () => Promise.reject(new Error('storage down'));
      const app = buildApp(true);
      const payload = { title: 'Unstored' };

      const first = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-store-fail')
        .send(payload);
      await waitForStatus('k-store-fail', 'absent');
      const retry = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-store-fail')
        .send(payload);

      expect(first.status).toBe(201);
      expect(retry.status).toBe(201);
      expect(runsOf('create')).toBe(2);
    });

    it('logs the settle failure with the key, user ID, and request ID, never the email', async () => {
      const errorSpy = vi
        .spyOn(logger, 'error')
        .mockImplementation(() => undefined);
      fakeRepo.completeKey = () => Promise.reject(new Error('storage down'));
      const app = buildApp(true);

      await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-store-log')
        .send({ title: 'Logged' });

      await vi.waitFor(() => {
        const logged = JSON.stringify(errorSpy.mock.calls);
        expect(logged).toContain('k-store-log');
        expect(logged).toContain(userId);
        expect(logged).toContain(REQUEST_ID);
      });
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(USER_EMAIL);
    });
  });

  describe('JSON null bodies (I-13)', () => {
    it('replays a 200 JSON null body as JSON null', async () => {
      const app = buildApp(true);
      const payload = { n: 1 };

      const first = await request(app)
        .post('/null-body')
        .set('Idempotency-Key', 'k-null')
        .send(payload);
      await waitForStatus('k-null', 'completed');
      const second = await request(app)
        .post('/null-body')
        .set('Idempotency-Key', 'k-null')
        .send(payload);

      expect(first.text).toBe('null');
      expect(second.status).toBe(200);
      expect(second.headers['content-type']).toMatch(/application\/json/);
      expect(second.text).toBe('null');
      expect(runsOf('null-body')).toBe(1);
    });
  });

  describe('row released between the claim and the read (I-15)', () => {
    it('claims the key again and runs the handler', async () => {
      const { claimKey } = fakeRepo;
      let isFirstClaim = true;
      fakeRepo.claimKey = (input: ClaimInput): Promise<boolean> => {
        if (isFirstClaim) {
          isFirstClaim = false;
          return Promise.resolve(false);
        }
        return claimKey(input);
      };
      const app = buildApp(true);

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k-vanished')
        .send({ title: 'Vanished' });
      await waitForStatus('k-vanished', 'completed');

      expect(res.status).toBe(201);
      expect(runsOf('create')).toBe(1);
    });
  });

  describe('key length (I-16)', () => {
    it('answers 400 for a key longer than the maximum, before any claim', async () => {
      const { IDEMPOTENCY_KEY_MAX_LENGTH } =
        await import('app/constants/idempotencyConstants.js');
      const app = buildApp(true);

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', 'k'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1))
        .send({ title: 'Long key' });

      expect(IDEMPOTENCY_KEY_MAX_LENGTH).toBe(255);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        code: 'INPUT_VALIDATION_ERROR',
        error: expect.any(String) as unknown,
      });
      expect(runsOf('create')).toBe(0);
      expect(fakeRepo.rows.size).toBe(0);
    });

    it('accepts a key of exactly the maximum length', async () => {
      const { IDEMPOTENCY_KEY_MAX_LENGTH } =
        await import('app/constants/idempotencyConstants.js');
      const longestKey = 'k'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH);
      const app = buildApp(true);

      const res = await request(app)
        .post('/create')
        .set('Idempotency-Key', longestKey)
        .send({ title: 'Longest key' });
      await waitForStatus(longestKey, 'completed');

      expect(res.status).toBe(201);
      expect(runsOf('create')).toBe(1);
    });
  });

  describe('responses without a JSON body (I-18)', () => {
    it('replays a 200 ended without a body as an empty 200', async () => {
      const app = buildApp(true);
      const payload = { n: 1 };

      const first = await request(app)
        .post('/end-200')
        .set('Idempotency-Key', 'k-end-200')
        .send(payload);
      await waitForStatus('k-end-200', 'completed');
      const second = await request(app)
        .post('/end-200')
        .set('Idempotency-Key', 'k-end-200')
        .send(payload);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.text).toBe('');
      expect(second.headers['content-type'] ?? '').not.toMatch(
        /application\/json/,
      );
      expect(runsOf('end-200')).toBe(1);
      expect(fakeRepo.storedKey('k-end-200')).toMatchObject({
        hasJsonBody: false,
        statusCode: 200,
      });
    });

    it('replays a 200 text response as an empty 200 without storing the text', async () => {
      const app = buildApp(true);
      const payload = { n: 1 };

      const first = await request(app)
        .post('/text')
        .set('Idempotency-Key', 'k-text')
        .send(payload);
      await waitForStatus('k-text', 'completed');
      const second = await request(app)
        .post('/text')
        .set('Idempotency-Key', 'k-text')
        .send(payload);

      expect(first.text).toBe('plain text');
      expect(second.status).toBe(200);
      expect(second.text).toBe('');
      expect(second.headers['content-type'] ?? '').not.toMatch(
        /application\/json/,
      );
      expect(runsOf('text')).toBe(1);
      expect(fakeRepo.storedKey('k-text')).toMatchObject({
        hasJsonBody: false,
        responseBody: null,
        statusCode: 200,
      });
    });

    it('stores a JSON null body as a JSON body', async () => {
      const app = buildApp(true);

      await request(app)
        .post('/null-body')
        .set('Idempotency-Key', 'k-null-stored')
        .send({ n: 1 });
      await waitForStatus('k-null-stored', 'completed');

      expect(fakeRepo.storedKey('k-null-stored')).toMatchObject({
        hasJsonBody: true,
        responseBody: null,
        statusCode: 200,
      });
    });

    it('replays a seeded row without a JSON body as an empty 200', async () => {
      const app = buildApp(true);
      const payload = { n: 2 };
      fakeRepo.seedKey('k-end-seed', {
        hasJsonBody: false,
        requestBodyHash: hashBody(payload),
        requestMethod: 'POST',
        requestPath: '/end-200',
        responseBody: null,
        status: 'completed',
        statusCode: 200,
      });

      const res = await request(app)
        .post('/end-200')
        .set('Idempotency-Key', 'k-end-seed')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.text).toBe('');
      expect(runsOf('end-200')).toBe(0);
    });
  });

  describe('timeout while the response is held (I-20)', () => {
    it('answers 408 and completes the claim with the handler result for the retry', async () => {
      const { completeKey } = fakeRepo;
      fakeRepo.completeKey = async (
        key: string,
        ownerId: string,
        statusCode: number,
        responseBody: unknown,
        hasJsonBody: boolean,
      ): Promise<void> => {
        await timeoutFired.promise;
        await completeKey(key, ownerId, statusCode, responseBody, hasJsonBody);
      };
      const app = buildApp(true, 50);
      const payload = { title: 'Held' };
      const send = () =>
        request(app)
          .post('/create')
          .set('Idempotency-Key', 'k-held')
          .send(payload);

      const first = await send().then(
        (res) => ({ body: res.body as unknown, status: res.status }),
        () => ({ body: null, status: null }),
      );
      await waitForStatus('k-held', 'completed');
      const retry = await send();

      expect(first).toEqual({
        body: {
          code: 'SERVER_REQUEST_TIMEOUT',
          error: expect.any(String) as unknown,
        },
        status: 408,
      });
      expect(fakeRepo.storedKey('k-held')).toMatchObject({
        hasJsonBody: true,
        responseBody: { data: { body: payload, run: 1 } },
        statusCode: 201,
      });
      expect(retry.status).toBe(201);
      expect(retry.body).toEqual({ data: { body: payload, run: 1 } });
      expect(runsOf('create')).toBe(1);
    });
  });
});
