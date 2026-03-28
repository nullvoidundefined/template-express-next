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
        <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
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
