import ProtectedLayout from '@/app/(protected)/layout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    // Mimic Next's redirect, which throws to halt rendering.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

const mockCookies = vi.mocked(cookies);

function cookieStore(sid?: string) {
  return {
    get: (name: string) =>
      sid && name === 'sid' ? { name: 'sid', value: sid } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('ProtectedLayout (server-side auth gate)', () => {
  it('redirects to /login when no sid cookie is present', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));

    await expect(ProtectedLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(redirect).toHaveBeenCalledWith('/login');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirects to /login when the session is rejected by the API', async () => {
    mockCookies.mockResolvedValue(cookieStore('stale-token'));
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);

    await expect(ProtectedLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('renders children and forwards the sid cookie when the session is valid', async () => {
    mockCookies.mockResolvedValue(cookieStore('valid-token'));
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response);

    await ProtectedLayout({ children: 'protected-content' });

    expect(redirect).not.toHaveBeenCalled();
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/auth/me');
    expect((init.headers as Record<string, string>).cookie).toBe(
      'sid=valid-token',
    );
  });
});
