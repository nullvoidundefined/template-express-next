import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const INTERNAL_API =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001';

async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  // Strip the local /api prefix and target the versioned backend: a browser
  // call to /api/auth/me proxies to the server's /v1/auth/me.
  const targetPath = url.pathname.replace(/^\/api/, '/v1');
  const target = `${INTERNAL_API}${targetPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const body =
    request.method !== 'GET' && request.method !== 'HEAD'
      ? await request.arrayBuffer()
      : undefined;

  const upstream = await fetch(target, {
    body,
    headers,
    method: request.method,
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(upstream.body, {
    headers: responseHeaders,
    status: upstream.status,
    statusText: upstream.statusText,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
