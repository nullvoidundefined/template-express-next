// Typed fetch wrapper for the mobile client.
// All API calls go through this function; no raw fetch in components.

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type RequestOptions = {
    body?: Record<string, unknown>;
    method?: string;
};

async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { body, method = 'GET' } = opts;

    const res = await fetch(`${API_BASE}${path}`, {
        body: body !== undefined ? JSON.stringify(body) : undefined,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        method,
    });

    if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
            (payload as { error?: { message?: string } }).error?.message ??
                `HTTP ${res.status}`,
        );
    }

    return res.json() as Promise<T>;
}

export { api };
