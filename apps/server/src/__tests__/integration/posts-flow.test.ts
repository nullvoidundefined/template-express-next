// Integration test: real Express app (built via createApp, no listener) against
// a real database. Exercises the full auth-scoped posts CRUD flow including CSRF
// and loadSession. Skips gracefully when DATABASE_URL is not set.
// Run: pnpm --filter server run test:integration
import { createApp } from 'app/app.js';
import { query, withTransaction } from 'app/database/databasePool.js';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const { app: testApp } = createApp({ query, withTransaction });

const DB_AVAILABLE = !!process.env.DATABASE_URL;
const EMAIL_PREFIX = 'posts-test-';

function agent() {
  return request(testApp);
}

// Registers a fresh user and returns the session cookie for authenticated calls.
async function registerUser(): Promise<string> {
  const email = `${EMAIL_PREFIX}${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`;
  const res = await agent()
    .post('/v1/auth/register')
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ email, password: 'password123' });
  expect(res.status).toBe(201);
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? cookie.join('; ') : String(cookie);
}

describe.skipIf(!DB_AVAILABLE)('posts integration', () => {
  it('runs the full create-list-get-update-delete flow scoped to the user', async () => {
    const cookie = await registerUser();

    // Create
    const created = await agent()
      .post('/v1/posts')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ body: 'First body', title: 'First post' });
    expect(created.status).toBe(201);
    expect(created.body.data.title).toBe('First post');
    const postId = created.body.data.id as string;

    // List
    const listed = await agent().get('/v1/posts').set('Cookie', cookie);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.total).toBe(1);

    // Get
    const got = await agent().get(`/v1/posts/${postId}`).set('Cookie', cookie);
    expect(got.status).toBe(200);
    expect(got.body.data.id).toBe(postId);

    // Update
    const updated = await agent()
      .put(`/v1/posts/${postId}`)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ body: 'Edited body', title: 'Edited post' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.title).toBe('Edited post');

    // Delete
    const deleted = await agent()
      .delete(`/v1/posts/${postId}`)
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest');
    expect(deleted.status).toBe(204);

    // Gone
    const gone = await agent().get(`/v1/posts/${postId}`).set('Cookie', cookie);
    expect(gone.status).toBe(404);
    expect(gone.body.code).toBe('POSTS_NOT_FOUND');
  });

  it('rejects unauthenticated access with 401', async () => {
    const res = await agent().get('/v1/posts');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  it("does not return another user's post", async () => {
    const ownerCookie = await registerUser();
    const created = await agent()
      .post('/v1/posts')
      .set('Cookie', ownerCookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ body: 'Private body', title: 'Private post' });
    const postId = created.body.data.id as string;

    const otherCookie = await registerUser();
    const res = await agent()
      .get(`/v1/posts/${postId}`)
      .set('Cookie', otherCookie);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('POSTS_NOT_FOUND');
  });
});
