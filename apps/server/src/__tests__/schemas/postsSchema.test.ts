import { createPostSchema, updatePostSchema } from 'app/schemas/postsSchema.js';
import { describe, expect, it } from 'vitest';

describe('createPostSchema', () => {
  it('accepts a valid title and body', () => {
    const result = createPostSchema.safeParse({
      body: 'Some body text',
      title: 'A title',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty title', () => {
    const result = createPostSchema.safeParse({ body: 'x', title: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Title is required');
    }
  });

  it('rejects an empty body', () => {
    const result = createPostSchema.safeParse({ body: '', title: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a title longer than 255 characters', () => {
    const result = createPostSchema.safeParse({
      body: 'x',
      title: 'a'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a body longer than 10,000 characters', () => {
    const result = createPostSchema.safeParse({
      body: 'a'.repeat(10_001),
      title: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('updatePostSchema', () => {
  it('uses the same constraints as create', () => {
    expect(updatePostSchema).toBe(createPostSchema);
  });
});
