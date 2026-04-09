// Typed fetch wrapper for the extension.
// API calls must only be made from the background service worker.
// From popup or content scripts, route through sendMessage to background instead.

const API_BASE = import.meta.env.WXT_API_URL as string;

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
