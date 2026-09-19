// Integration test: idempotent POST and PUT through the real app built by
// createApp (helmet, CORS, request IDs, express.json, cookies, the CSRF header
// guard, the request timeout, loadSession, then the idempotency middleware and
// the /v1 routers) against a real database. idempotency-flow.test.ts mounts the
// middleware on a purpose-built app; this file proves the production wiring
// behaves the same way on the real /v1/posts routes. Retries are sent the
// moment the first response arrives, as a real client would. Schema migration,
// TRUNCATE between tests, and pool teardown live in setup.ts.
import { createApp } from 'app/app.js';
import { query, withTransaction } from 'app/database/databasePool.js';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

interface ErrorBody {
  code: string;
  error: string;
}

interface PostBody {
  data: { body: string; id: string; title: string };
}

interface PostListBody {
  meta: { total: number };
}

const { app: testApp } = createApp({ query, withTransaction });

const DB_AVAILABLE = !!process.env.DATABASE_URL;
const EMAIL_PREFIX = 'idem-app-test-';

function agent() {
  return request(testApp);
}

// Assembled at run time so no credential-shaped literal sits in the file.
function buildPlaceholderPassphrase(): string {
  return ['change', 'me', 'placeholder'].join('-');
}

// Registers a fresh user and returns the session cookie for authenticated calls.
async function registerUser(): Promise<string> {
  const email = `${EMAIL_PREFIX}${String(Date.now())}-${String(Math.round(Math.random() * 1e6))}@example.com`;
  const password = buildPlaceholderPassphrase();
  const res = await agent()
    .post('/v1/auth/register')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password });
  expect(res.status).toBe(201);
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : String(cookie);
}

function postPost(cookie: string, key: string, body: object) {
  return agent()
    .post('/v1/posts')
    .set('Cookie', cookie)
    .set('Idempotency-Key', key)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send(body);
}

async function countPosts(cookie: string): Promise<number> {
  const res = await agent().get('/v1/posts').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return (res.body as PostListBody).meta.total;
}

describe.skipIf(!DB_AVAILABLE)('idempotency through createApp', () => {
  it('replays a retried POST with the same key and body', async () => {
    const cookie = await registerUser();
    const payload = { body: 'First body', title: 'First post' };

    const first = await postPost(cookie, 'app-key-replay', payload);
    const retry = await postPost(cookie, 'app-key-replay', payload);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect((retry.body as PostBody).data.id).toBe(
      (first.body as PostBody).data.id,
    );
    expect(await countPosts(cookie)).toBe(1);
  });

  it('answers 422 when the key is reused with a different body', async () => {
    const cookie = await registerUser();

    const first = await postPost(cookie, 'app-key-body', {
      body: 'First body',
      title: 'First post',
    });
    const reused = await postPost(cookie, 'app-key-body', {
      body: 'Different body',
      title: 'Different post',
    });

    expect(first.status).toBe(201);
    expect(reused.status).toBe(422);
    expect((reused.body as ErrorBody).code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await countPosts(cookie)).toBe(1);
  });

  it('answers 422 when the key is reused on a PUT to the post', async () => {
    const cookie = await registerUser();
    const payload = { body: 'First body', title: 'First post' };

    const created = await postPost(cookie, 'app-key-put', payload);
    const postId = (created.body as PostBody).data.id;
    const reused = await agent()
      .put(`/v1/posts/${postId}`)
      .set('Cookie', cookie)
      .set('Idempotency-Key', 'app-key-put')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ body: 'Edited body', title: 'Edited post' });
    const fetched = await agent()
      .get(`/v1/posts/${postId}`)
      .set('Cookie', cookie);

    expect(created.status).toBe(201);
    expect(reused.status).toBe(422);
    expect((reused.body as ErrorBody).code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(fetched.status).toBe(200);
    expect((fetched.body as PostBody).data).toMatchObject(payload);
  });

  it('replays a validation failure for the same request', async () => {
    const cookie = await registerUser();
    const invalidPayload = { body: 'Body without a title' };

    const first = await postPost(cookie, 'app-key-invalid', invalidPayload);
    const retry = await postPost(cookie, 'app-key-invalid', invalidPayload);

    expect(first.status).toBe(400);
    expect((first.body as ErrorBody).code).toBe('INPUT_VALIDATION_ERROR');
    expect(retry.status).toBe(400);
    expect(retry.body).toEqual(first.body);
    expect(await countPosts(cookie)).toBe(0);
  });

  it('rejects a 256-character key before creating anything', async () => {
    const cookie = await registerUser();

    const res = await postPost(cookie, 'k'.repeat(256), {
      body: 'Long key body',
      title: 'Long key post',
    });

    expect(res.status).toBe(400);
    expect((res.body as ErrorBody).code).toBe('INPUT_VALIDATION_ERROR');
    expect(await countPosts(cookie)).toBe(0);
  });

  it('keeps the same key independent for a different user', async () => {
    const firstCookie = await registerUser();
    const secondCookie = await registerUser();
    const payload = { body: 'Shared key body', title: 'Shared key post' };

    const firstUser = await postPost(firstCookie, 'app-key-shared', payload);
    const secondUser = await postPost(secondCookie, 'app-key-shared', payload);

    expect(firstUser.status).toBe(201);
    expect(secondUser.status).toBe(201);
    expect((secondUser.body as PostBody).data.id).not.toBe(
      (firstUser.body as PostBody).data.id,
    );
    expect(await countPosts(firstCookie)).toBe(1);
    expect(await countPosts(secondCookie)).toBe(1);
  });
});
