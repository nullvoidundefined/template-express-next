import { mockResult } from 'app/__tests__/helpers/mockResult.js';
import { uuid } from 'app/__tests__/helpers/uuids.js';
import { createPostsRepo } from 'app/repositories/postsRepository.js';
import type { PostsRepoDeps } from 'app/repositories/postsRepository.js';
import type { Post } from 'app/schemas/postsSchema.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const repo = createPostsRepo({ query: mockQuery } as unknown as PostsRepoDeps);

const userId = uuid();
const postId = uuid();

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

describe('posts repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPost', () => {
    it('inserts with the user id and returns the created row', async () => {
      const post = makePost();
      mockQuery.mockResolvedValueOnce(mockResult([post]));

      const result = await repo.createPost(userId, {
        body: 'Body text',
        title: 'A title',
      });

      expect(result).toEqual(post);
      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('INSERT INTO posts');
      expect(values).toEqual([userId, 'A title', 'Body text']);
    });
  });

  describe('getPostById', () => {
    it('scopes the lookup to the owning user', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([makePost()]));

      await repo.getPostById(postId, userId);

      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('WHERE id = $1 AND user_id = $2');
      expect(values).toEqual([postId, userId]);
    });

    it('returns null when no row matches', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result = await repo.getPostById(postId, userId);

      expect(result).toBeNull();
    });
  });

  describe('listPostsByUser', () => {
    it('returns the page of posts and the total count', async () => {
      const post = makePost();
      mockQuery
        .mockResolvedValueOnce(mockResult([post]))
        .mockResolvedValueOnce(mockResult([{ total: 3 }]));

      const result = await repo.listPostsByUser(userId, 20, 0);

      expect(result).toEqual({ posts: [post], total: 3 });
      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('WHERE user_id = $1');
      expect(values).toEqual([userId, 20, 0]);
    });
  });

  describe('updatePost', () => {
    it('scopes the update to the owning user and returns the row', async () => {
      const post = makePost({ title: 'Updated' });
      mockQuery.mockResolvedValueOnce(mockResult([post]));

      const result = await repo.updatePost(postId, userId, {
        body: 'Body text',
        title: 'Updated',
      });

      expect(result).toEqual(post);
      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('WHERE id = $3 AND user_id = $4');
      expect(values).toEqual(['Updated', 'Body text', postId, userId]);
    });

    it('returns null when no row matches', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([]));

      const result = await repo.updatePost(postId, userId, {
        body: 'x',
        title: 'x',
      });

      expect(result).toBeNull();
    });
  });

  describe('deletePost', () => {
    it('returns true when a row was deleted', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([{ id: postId }], 1));

      const result = await repo.deletePost(postId, userId);

      expect(result).toBe(true);
      const [sql, values] = mockQuery.mock.calls[0] ?? [];
      expect(sql).toContain('WHERE id = $1 AND user_id = $2');
      expect(values).toEqual([postId, userId]);
    });

    it('returns false when nothing was deleted', async () => {
      mockQuery.mockResolvedValueOnce(mockResult([], 0));

      const result = await repo.deletePost(postId, userId);

      expect(result).toBe(false);
    });
  });
});
