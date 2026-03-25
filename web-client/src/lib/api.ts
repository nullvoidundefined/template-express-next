const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type RequestOptions = {
    method?: string;
    body?: Record<string, unknown>;
};

export async function api<T>(
    path: string,
    opts: RequestOptions = {},
): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: opts.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: opts.body ? JSON.stringify(opts.body) : undefined,
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
