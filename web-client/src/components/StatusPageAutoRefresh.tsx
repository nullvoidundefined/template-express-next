'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function StatusPageAutoRefresh() {
    const router = useRouter();

    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 30_000);
        return () => clearInterval(interval);
    }, [router]);

    return null;
}
