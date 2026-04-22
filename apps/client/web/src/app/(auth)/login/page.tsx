'use client';

import { type FormEvent, Suspense, useCallback, useState } from 'react';

import { useAuth } from '@/state/useAuth';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '../auth.module.scss';

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  const resetSuccess = searchParams.get('reset') === 'true';
  if (!resetSuccess) return null;
  return (
    <p className={styles.hint} role='status'>
      Password reset successfully. Please log in.
    </p>
  );
}

ResetSuccessBanner.displayName = 'ResetSuccessBanner';

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
        <Suspense fallback={null}>
          <ResetSuccessBanner />
        </Suspense>
        <form
          className={styles.form}
          data-test-id='login-form'
          noValidate
          onSubmit={handleSubmit}
        >
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
          {' · '}
          <Link className={styles.link} href='/forgot-password'>
            Forgot password?
          </Link>
        </p>
      </div>
    </main>
  );
}

LoginPage.displayName = 'LoginPage';

export default LoginPage;
