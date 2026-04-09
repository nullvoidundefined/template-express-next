'use client';

import { useEffect } from 'react';

import { useAuth } from '@/state/useAuth';
import { useRouter } from 'next/navigation';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return null;
  }

  return <>{children}</>;
}

ProtectedLayout.displayName = 'ProtectedLayout';

export default ProtectedLayout;
