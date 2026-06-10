/**
 * Single smoke test for route wiring: verifies each path/method reaches the correct handler.
 * Handler behavior is covered by handler tests; this only guards against broken router wiring.
 */
import { uuid } from 'app/__tests__/helpers/uuids.js';
import type { AuthHandlers } from 'app/handlers/authHandler.js';
import type { PostsHandlers } from 'app/handlers/postsHandler.js';
import { createAuthRouter } from 'app/routes/authRoutes.js';
import { createPostsRouter } from 'app/routes/postsRoutes.js';
import express from 'express';
import type { Request, Response } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Inject fake handlers rather than mocking the handler module. requireAuth is
// the real pure gate; the auth rate limiter self-skips under NODE_ENV=test.
const fakeHandlers = {
  forgotPassword: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
  login: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
  logout: (_req: Request, res: Response) => {
    res.status(204).send();
  },
  me: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
  register: (_req: Request, res: Response) => {
    res.status(201).json({ ok: true });
  },
  resetPassword: (_req: Request, res: Response) => {
    res.status(204).send();
  },
  updateMe: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
} as unknown as AuthHandlers;

const app = express();
app.use(express.json());
app.use('/auth', createAuthRouter(fakeHandlers));

const fakePostsHandlers = {
  createPost: (_req: Request, res: Response) => {
    res.status(201).json({ ok: true });
  },
  deletePost: (_req: Request, res: Response) => {
    res.status(204).send();
  },
  getPost: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
  listPosts: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
  updatePost: (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  },
} as unknown as PostsHandlers;

const postsId = uuid();

// Unauthenticated app: requireAuth gates every posts route.
const postsAppNoAuth = express();
postsAppNoAuth.use(express.json());
postsAppNoAuth.use('/posts', createPostsRouter(fakePostsHandlers));

// Authenticated app: inject a user before the router so requireAuth passes.
const postsApp = express();
postsApp.use(express.json());
postsApp.use((req, _res, next) => {
  req.user = {
    created_at: new Date('2025-01-01'),
    email: 'user@example.com',
    id: postsId,
    role: 'user',
    updated_at: null,
  };
  next();
});
postsApp.use('/posts', createPostsRouter(fakePostsHandlers));

describe('route wiring', () => {
  describe('auth', () => {
    it('POST /auth/forgot-password → 200', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'a@b.com' });
      expect(res.status).toBe(200);
    });
    it('POST /auth/login → 200', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'a@b.com', password: 'x' });
      expect(res.status).toBe(200);
    });
    it('POST /auth/logout → 204', async () => {
      const res = await request(app).post('/auth/logout');
      expect(res.status).toBe(204);
    });
    it('GET /auth/me → 401 when unauthenticated', async () => {
      const res = await request(app).get('/auth/me');
      expect(res.status).toBe(401);
    });
    it('PATCH /auth/me → 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch('/auth/me')
        .send({ newPassword: 'x' });
      expect(res.status).toBe(401);
    });
    it('POST /auth/register → 201', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'a@b.com', password: 'password123' });
      expect(res.status).toBe(201);
    });
    it('POST /auth/reset-password → 204', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({ password: 'password123', token: 'tok' });
      expect(res.status).toBe(204);
    });
  });

  describe('posts', () => {
    it('GET /posts → 401 when unauthenticated', async () => {
      const res = await request(postsAppNoAuth).get('/posts');
      expect(res.status).toBe(401);
    });
    it('GET /posts → 200 when authenticated', async () => {
      const res = await request(postsApp).get('/posts');
      expect(res.status).toBe(200);
    });
    it('GET /posts/:id → 200', async () => {
      const res = await request(postsApp).get(`/posts/${postsId}`);
      expect(res.status).toBe(200);
    });
    it('POST /posts → 201', async () => {
      const res = await request(postsApp)
        .post('/posts')
        .send({ body: 'Body text', title: 'A title' });
      expect(res.status).toBe(201);
    });
    it('PUT /posts/:id → 200', async () => {
      const res = await request(postsApp)
        .put(`/posts/${postsId}`)
        .send({ body: 'Body text', title: 'Updated' });
      expect(res.status).toBe(200);
    });
    it('DELETE /posts/:id → 204', async () => {
      const res = await request(postsApp).delete(`/posts/${postsId}`);
      expect(res.status).toBe(204);
    });
  });
});
