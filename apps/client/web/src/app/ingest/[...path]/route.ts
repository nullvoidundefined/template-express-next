import { type NextRequest, NextResponse } from 'next/server';

const POSTHOG_HOST = 'https://us.i.posthog.com';

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const pathname = path.join('/');
  const search = req.nextUrl.search;

  const targetUrl = `${POSTHOG_HOST}/${pathname}${search}`;

  const headers = new Headers(req.headers);
  headers.set('host', new URL(POSTHOG_HOST).host);

  const response = await fetch(targetUrl, {
    body: req.body,
    headers,
    method: req.method,
  });

  return new NextResponse(response.body, {
    headers: response.headers,
    status: response.status,
  });
}

export const GET = handler;
export const POST = handler;
