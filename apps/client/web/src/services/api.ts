const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type RequestOptions = {
    body?: Record<string, unknown>;
    method?: string;
};

async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        method: opts.method ?? 'GET',
    });

    if (res.status === 204) {
        return undefined as T;
    }

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Request failed');
    }
    return data as T;
}

export { api };
