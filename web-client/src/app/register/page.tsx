'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

import { register } from '@/lib/auth';

export default function RegisterPage() {
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
            await register(email, password);
            router.push('/account');
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Registration failed',
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
            <h1>Register</h1>
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
                        minLength={8}
                        maxLength={72}
                        style={{
                            display: 'block',
                            width: '100%',
                            padding: '0.5rem',
                            marginTop: '0.25rem',
                        }}
                    />
                    <small>8 to 72 characters</small>
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
                    {loading ? 'Creating account...' : 'Register'}
                </button>
            </form>
            <p style={{ marginTop: '1rem' }}>
                Already have an account? <Link href="/login">Log in</Link>
            </p>
        </div>
    );
}
