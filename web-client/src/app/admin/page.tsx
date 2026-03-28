import { redirect } from 'next/navigation';

import { getServices } from '@/lib/services';
import type { Service } from '@/types';

import ServiceGrid from './components/ServiceGrid';

async function getSessionUser() {
    try {
        const API_BASE =
            process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            credentials: 'include',
            cache: 'no-store',
        });
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return data?.user ?? null;
    } catch {
        return null;
    }
}

export default async function AdminPage() {
    const user = await getSessionUser();
    if (!user) {
        redirect('/login');
    }

    let services: Service[] = [];
    try {
        services = await getServices();
    } catch {
        // backend not available; render empty grid
    }

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
            <div className="mb-4 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                        Admin Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage and monitor your services
                    </p>
                </div>
            </div>
            <ServiceGrid initialServices={services} />
        </div>
    );
}
