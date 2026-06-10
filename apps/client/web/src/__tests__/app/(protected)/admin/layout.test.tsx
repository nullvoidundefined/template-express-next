import AdminLayout from '@/app/(protected)/admin/layout';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
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

function meResponse(role: 'admin' | 'user') {
  return {
    ok: true,
    json: async () => ({ user: { id: 'u1', email: 'u@e.com', role } }),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('AdminLayout (server-side role gate)', () => {
  it('redirects to /login when no sid cookie is present', async () => {
    mockCookies.mockResolvedValue(cookieStore(undefined));

    await expect(AdminLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/login',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirects authenticated non-admins to /dashboard', async () => {
    mockCookies.mockResolvedValue(cookieStore('valid-token'));
    vi.mocked(fetch).mockResolvedValue(meResponse('user'));

    await expect(AdminLayout({ children: null })).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('renders children for an admin', async () => {
    mockCookies.mockResolvedValue(cookieStore('valid-token'));
    vi.mocked(fetch).mockResolvedValue(meResponse('admin'));

    await AdminLayout({ children: 'admin-content' });

    expect(redirect).not.toHaveBeenCalled();
  });
});
