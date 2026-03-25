'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { type User, getMe, logout } from '@/lib/auth';

export default function AccountPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getMe()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    const handleLogout = useCallback(async () => {
        await logout();
        router.push('/login');
    }, [router]);

    if (loading) {
        return <p style={{ padding: '2rem' }}>Loading...</p>;
    }

    if (!user) {
        return (
            <div
                style={{
                    maxWidth: 400,
                    margin: '4rem auto',
                    padding: '0 1rem',
                }}
            >
                <h1>Account</h1>
                <p>You are not logged in.</p>
                <p style={{ marginTop: '1rem' }}>
                    <Link href="/login">Log in</Link> or{' '}
                    <Link href="/register">Register</Link>
                </p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
            <h1>Account</h1>
            <dl style={{ marginTop: '1.5rem' }}>
                <dt>Email</dt>
                <dd>{user.email}</dd>
                <dt style={{ marginTop: '0.5rem' }}>User ID</dt>
                <dd
                    style={{
                        fontFamily: 'var(--font-geist-mono)',
                        fontSize: '0.85rem',
                    }}
                >
                    {user.id}
                </dd>
                <dt style={{ marginTop: '0.5rem' }}>Joined</dt>
                <dd>{new Date(user.created_at).toLocaleDateString()}</dd>
            </dl>
            <button
                onClick={handleLogout}
                style={{ marginTop: '2rem', padding: '0.5rem 1.5rem' }}
            >
                Log out
            </button>
        </div>
    );
}
