import { expect, test } from '@playwright/test';

// Posts has no UI in this template, so its E2E is an API-level Playwright spec
// hitting the Express server directly. The request fixture keeps the session
// cookie set by /auth/register across subsequent calls in the same test.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const XHR = { 'X-Requested-With': 'XMLHttpRequest' };

test.describe('Posts API', () => {
  test('full CRUD flow scoped to the authenticated user', async ({
    request,
  }) => {
    const email = `e2e-posts-${Date.now()}@example.com`;
    const register = await request.post(`${API}/v1/auth/register`, {
      data: { email, password: 'Password123!' },
      headers: XHR,
    });
    expect(register.status()).toBe(201);

    const created = await request.post(`${API}/v1/posts`, {
      data: { body: 'E2E body', title: 'E2E post' },
      headers: XHR,
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    const postId = createdBody.data.id as string;

    const listed = await request.get(`${API}/v1/posts`);
    expect(listed.status()).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.data).toHaveLength(1);
    expect(listedBody.meta.total).toBe(1);

    const got = await request.get(`${API}/v1/posts/${postId}`);
    expect(got.status()).toBe(200);

    const updated = await request.put(`${API}/v1/posts/${postId}`, {
      data: { body: 'Edited body', title: 'Edited post' },
      headers: XHR,
    });
    expect(updated.status()).toBe(200);
    const updatedBody = await updated.json();
    expect(updatedBody.data.title).toBe('Edited post');

    const deleted = await request.delete(`${API}/v1/posts/${postId}`, {
      headers: XHR,
    });
    expect(deleted.status()).toBe(204);

    const gone = await request.get(`${API}/v1/posts/${postId}`);
    expect(gone.status()).toBe(404);
  });

  test('rejects unauthenticated access with 401', async ({ request }) => {
    const res = await request.get(`${API}/v1/posts`);
    expect(res.status()).toBe(401);
  });
});
