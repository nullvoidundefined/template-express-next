'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { login } from '@/lib/auth';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            router.push('/account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
            <h1>Log in</h1>
            <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.5rem',
                            marginTop: '0.25rem',
                        }}
                    />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.5rem',
                            marginTop: '0.25rem',
                        }}
                    />
                </div>
                {error && (
                    <p style={{ color: 'red', marginBottom: '1rem' }}>
                        {error}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: '0.5rem 1.5rem' }}
                >
                    {loading ? 'Logging in...' : 'Log in'}
                </button>
            </form>
            <p style={{ marginTop: '1rem' }}>
                Don&apos;t have an account?{' '}
                <Link href="/register">Register</Link>
            </p>
        </div>
    );
}
