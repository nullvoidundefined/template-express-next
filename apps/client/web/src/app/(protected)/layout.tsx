import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const INTERNAL_API =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const sid = (await cookies()).get('sid');

  if (!sid) {
    redirect('/login');
  }

  // Server-side auth gate: verify the session against the API before rendering
  // any protected content. Replaces the old client-side useEffect check, which
  // flashed a blank screen on every protected route during hydration.
  const res = await fetch(`${INTERNAL_API}/v1/auth/me`, {
    cache: 'no-store',
    headers: { cookie: `${sid.name}=${sid.value}` },
  });

  if (!res.ok) {
    redirect('/login');
  }

  return <>{children}</>;
}

ProtectedLayout.displayName = 'ProtectedLayout';

export default ProtectedLayout;
