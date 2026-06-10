import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createPostsHandlers } from 'app/handlers/postsHandler.js';
import { errorHandler } from 'app/middleware/errorHandlerMiddleware.js';
import type { PostsRepo } from 'app/repositories/postsRepository.js';
import type { Post } from 'app/schemas/postsSchema.js';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPostsRepo = {
  createPost: vi.fn(),
  deletePost: vi.fn(),
  getPostById: vi.fn(),
  listPostsByUser: vi.fn(),
  updatePost: vi.fn(),
};

const handlers = createPostsHandlers({
  postsRepo: mockPostsRepo as unknown as PostsRepo,
});

const userId = uuid();
const postId = uuid();

const app = express();
app.use(express.json());
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
app.post('/posts', handlers.createPost);
app.get('/posts', handlers.listPosts);
app.get('/posts/:id', handlers.getPost);
app.put('/posts/:id', handlers.updatePost);
app.delete('/posts/:id', handlers.deletePost);
app.use(errorHandler);

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    body: 'Body text',
    created_at: new Date('2025-01-01'),
    id: postId,
    title: 'A title',
    updated_at: null,
    user_id: userId,
    ...overrides,
  };
}

describe('posts handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('returns 201 with the created post wrapped in data', async () => {
      const post = makePost();
      mockPostsRepo.createPost.mockResolvedValueOnce(post);

      const res = await request(app)
        .post('/posts')
        .send({ body: 'Body text', title: 'A title' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(postId);
      expect(mockPostsRepo.createPost).toHaveBeenCalledWith(userId, {
        body: 'Body text',
        title: 'A title',
      });
    });
  });

  describe('listPosts', () => {
    it('returns 200 with data and pagination meta', async () => {
      mockPostsRepo.listPostsByUser.mockResolvedValueOnce({
        posts: [makePost()],
        total: 1,
      });

      const res = await request(app).get('/posts?limit=10&offset=0');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({ limit: 10, offset: 0, total: 1 });
      expect(mockPostsRepo.listPostsByUser).toHaveBeenCalledWith(userId, 10, 0);
    });
  });

  describe('getPost', () => {
    it('returns 200 with the post when found', async () => {
      mockPostsRepo.getPostById.mockResolvedValueOnce(makePost());

      const res = await request(app).get(`/posts/${postId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(postId);
      expect(mockPostsRepo.getPostById).toHaveBeenCalledWith(postId, userId);
    });

    it('returns 404 POSTS_NOT_FOUND when the repo returns null', async () => {
      mockPostsRepo.getPostById.mockResolvedValueOnce(null);

      const res = await request(app).get(`/posts/${postId}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('POSTS_NOT_FOUND');
    });

    it('returns 404 without hitting the repo when the id is not a uuid', async () => {
      const res = await request(app).get('/posts/not-a-uuid');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('POSTS_NOT_FOUND');
      expect(mockPostsRepo.getPostById).not.toHaveBeenCalled();
    });
  });

  describe('updatePost', () => {
    it('returns 200 with the updated post', async () => {
      mockPostsRepo.updatePost.mockResolvedValueOnce(
        makePost({ title: 'Updated' }),
      );

      const res = await request(app)
        .put(`/posts/${postId}`)
        .send({ body: 'Body text', title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated');
    });

    it('returns 404 when the post is not found', async () => {
      mockPostsRepo.updatePost.mockResolvedValueOnce(null);

      const res = await request(app)
        .put(`/posts/${postId}`)
        .send({ body: 'x', title: 'x' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('POSTS_NOT_FOUND');
    });
  });

  describe('deletePost', () => {
    it('returns 204 when the post is deleted', async () => {
      mockPostsRepo.deletePost.mockResolvedValueOnce(true);

      const res = await request(app).delete(`/posts/${postId}`);

      expect(res.status).toBe(204);
      expect(mockPostsRepo.deletePost).toHaveBeenCalledWith(postId, userId);
    });

    it('returns 404 when nothing was deleted', async () => {
      mockPostsRepo.deletePost.mockResolvedValueOnce(false);

      const res = await request(app).delete(`/posts/${postId}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('POSTS_NOT_FOUND');
    });
  });
});
