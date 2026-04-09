import { api } from '@/services/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

    await api('/test');

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

    await api('/items', { body: { title: 'hello' }, method: 'POST' });

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

  it('throws with server error message on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: 'Email already registered' } }),
        { status: 409 },
      ),
    );

    await expect(
      api('/auth/register', {
        body: { email: 'a@b.com', password: 'pw' },
        method: 'POST',
      }),
    ).rejects.toThrow('Email already registered');
  });

  it('throws generic message when error body is missing message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 500 }),
    );

    await expect(api('/broken')).rejects.toThrow('Request failed');
  });
});
