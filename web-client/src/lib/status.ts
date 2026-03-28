import type { PublicStatus } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getPublicStatus(): Promise<PublicStatus> {
    const res = await fetch(`${API_BASE}/api/v1/status`, {
        next: { revalidate: 30 },
    });
    if (!res.ok) {
        throw new Error('Failed to fetch status');
    }
    const json = await res.json();
    return json.data as PublicStatus;
}
