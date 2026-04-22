'use client';

import { Suspense, useEffect, useRef } from 'react';

import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

type PostHogProviderProps = {
  children: React.ReactNode;
};

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.capture('$pageview');
    }
  }, [pathname, searchParams]);

  return null;
}

PageViewTracker.displayName = 'PageViewTracker';

function PostHogProvider({ children }: PostHogProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === 'undefined' || initialized.current) return;

    posthog.init(key, {
      api_host: '/ingest',
      capture_pageview: false,
      persistence: 'localStorage',
      ui_host: 'https://us.posthog.com',
    });
    initialized.current = true;
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}

PostHogProvider.displayName = 'PostHogProvider';

export { PostHogProvider };
