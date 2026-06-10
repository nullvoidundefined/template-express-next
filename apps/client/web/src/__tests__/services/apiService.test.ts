import { ApiError, api } from '@/services/apiService';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends GET with credentials and CSRF header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 }),
    );

    await api('/test', z.object({ data: z.string() }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'X-Requested-With': 'XMLHttpRequest',
        }),
        method: 'GET',
      }),
    );
  });

  it('sends POST with JSON body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: 'created' }), { status: 201 }),
    );

    await api('/items', z.object({ data: z.string() }), {
      body: { title: 'hello' },
      method: 'POST',
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ title: 'hello' }),
        method: 'POST',
      }),
    );
  });

  it('returns undefined on 204', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await api('/auth/logout', { method: 'POST' });

    expect(result).toBeUndefined();
  });

  it('parses and returns response through Zod schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: '123', name: 'test' }), {
        status: 200,
      }),
    );

    const schema = z.object({ id: z.string(), name: z.string() });
    const result = await api('/items/1', schema);

    expect(result).toEqual({ id: '123', name: 'test' });
  });

  it('throws when response does not match schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ wrong: 'shape' }), { status: 200 }),
    );

    const schema = z.object({ id: z.string().uuid() });
    await expect(api('/items/1', schema)).rejects.toThrow();
  });

  it('throws with the server error message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'AUTH_EMAIL_ALREADY_REGISTERED',
          error: 'Email already registered',
        }),
        { status: 409 },
      ),
    );

    await expect(
      api('/auth/register', z.unknown(), {
        body: { email: 'a@b.com', password: 'pw' },
        method: 'POST',
      }),
    ).rejects.toThrow('Email already registered');
  });

  it('throws a generic message when the error body has no message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 }),
    );

    await expect(api('/broken', z.unknown())).rejects.toThrow('Request failed');
  });

  it('throws an ApiError carrying the HTTP status and code so callers can branch', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: 'AUTH_REQUIRED', error: 'Unauthorized' }),
        { status: 401 },
      ),
    );

    const err = await api('/auth/me', z.unknown()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
    expect((err as ApiError).code).toBe('AUTH_REQUIRED');
  });
});
