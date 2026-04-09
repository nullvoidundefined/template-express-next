'use client';

import { type FormEvent, useCallback, useState } from 'react';

import { useAuth } from '@/state/useAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from '../auth.module.scss';

function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await login(email, password);
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed');
      } finally {
        setLoading(false);
      }
    },
    [email, login, password, router],
  );

  return (
    <main className={styles.page} data-test-id='login-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Log in</h1>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='email'>
              Email
            </label>
            <input
              className={styles.input}
              id='email'
              onChange={(e) => setEmail(e.target.value)}
              required
              type='email'
              value={email}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor='password'>
              Password
            </label>
            <input
              className={styles.input}
              id='password'
              onChange={(e) => setPassword(e.target.value)}
              required
              type='password'
              value={password}
            />
          </div>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={loading} type='submit'>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link className={styles.link} href='/register'>
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}

LoginPage.displayName = 'LoginPage';

export default LoginPage;
