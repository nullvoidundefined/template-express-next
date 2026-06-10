import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Access = 'admin' | 'private' | 'public';

const ROUTE_MAP: Record<string, Access> = {
  '/': 'public',
  '/forgot-password': 'public',
  '/login': 'public',
  '/register': 'public',
  '/reset-password': 'public',
  '/dashboard': 'private',
};

const PREFIX_RULES: Array<{ access: Access; prefix: string }> = [
  { access: 'private', prefix: '/settings' },
  { access: 'admin', prefix: '/admin' },
];

function resolveAccess(pathname: string): Access {
  const exact = ROUTE_MAP[pathname];
  if (exact) return exact;

  for (const rule of PREFIX_RULES) {
    if (pathname.startsWith(rule.prefix)) return rule.access;
  }

  return 'private';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSid = request.cookies.has('sid');
  const access = resolveAccess(pathname);

  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);

  if (access === 'public') {
    if (hasSid && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // Middleware only gates authentication (cookie presence) for both private
  // and admin routes. Authorization is enforced server-side: the (protected)
  // layout verifies the session and the (admin) layout verifies role === admin.
  // The API additionally enforces admin access with the requireAdmin middleware.
  if (!hasSid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|ingest).*)'],
};
