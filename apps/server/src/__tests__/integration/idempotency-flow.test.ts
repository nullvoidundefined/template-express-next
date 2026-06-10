// Integration test: the idempotency middleware replays a stored response for a
// retried POST carrying the same Idempotency-Key, against the real app + DB.
// Schema migration, TRUNCATE between tests, and pool teardown live in setup.ts.
import { createApp } from 'app/app.js';
import { query, withTransaction } from 'app/database/databasePool.js';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const { app: testApp } = createApp({ query, withTransaction });

const DB_AVAILABLE = !!process.env.DATABASE_URL;

function agent() {
  return request(testApp);
}

async function registerUser(): Promise<string> {
  const email = `idem-test-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const res = await agent()
    .post('/v1/auth/register')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : String(cookie);
}

describe.skipIf(!DB_AVAILABLE)('idempotency integration', () => {
  it('replays the first response for a retried POST with the same key', async () => {
    const cookie = await registerUser();
    const headers = {
      Cookie: cookie,
      'Idempotency-Key': 'key-abc',
      'X-Requested-With': 'xhr',
    };

    const first = await agent()
      .post('/v1/posts')
      .set(headers)
      .send({ body: 'First body', title: 'First post' });
    expect(first.status).toBe(201);
    const firstId = first.body.data.id as string;

    // Same key, different payload: the stored first response is replayed and the
    // handler does not run again, so no second post is created.
    const second = await agent()
      .post('/v1/posts')
      .set(headers)
      .send({ body: 'Different body', title: 'Different post' });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(firstId);
    expect(second.body.data.title).toBe('First post');

    const listed = await agent().get('/v1/posts').set('Cookie', cookie);
    expect(listed.body.meta.total).toBe(1);
  });

  it('does not deduplicate when no Idempotency-Key is sent', async () => {
    const cookie = await registerUser();

    for (const title of ['One', 'Two']) {
      const res = await agent()
        .post('/v1/posts')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'xhr')
        .send({ body: 'Body', title });
      expect(res.status).toBe(201);
    }

    const listed = await agent().get('/v1/posts').set('Cookie', cookie);
    expect(listed.body.meta.total).toBe(2);
  });
});
