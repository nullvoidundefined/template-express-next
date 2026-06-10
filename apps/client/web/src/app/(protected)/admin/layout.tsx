import type { User } from '@repo/types';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const INTERNAL_API =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sid = (await cookies()).get('sid');

  if (!sid) {
    redirect('/login');
  }

  // Authorization gate: only admins may see /admin routes. Authenticated
  // non-admins are sent back to their dashboard. The API enforces the same
  // rule with requireAdmin, so this redirect is UX, not the security boundary.
  const res = await fetch(`${INTERNAL_API}/v1/auth/me`, {
    cache: 'no-store',
    headers: { cookie: `${sid.name}=${sid.value}` },
  });

  if (!res.ok) {
    redirect('/login');
  }

  const { user } = (await res.json()) as { user: User };
  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;
