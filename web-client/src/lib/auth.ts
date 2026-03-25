import { api } from './api';

export type User = {
    id: string;
    email: string;
    created_at: string;
};

type AuthResponse = { user: User };

export async function register(email: string, password: string): Promise<User> {
    const data = await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: { email, password },
    });
    return data.user;
}

export async function login(email: string, password: string): Promise<User> {
    const data = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
    });
    return data.user;
}

export async function logout(): Promise<void> {
    await api('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<User> {
    const data = await api<AuthResponse>('/auth/me');
    return data.user;
}
