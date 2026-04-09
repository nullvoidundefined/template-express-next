'use client';

import { type FormEvent, useCallback, useState } from 'react';

import { useAuth } from '@/state/useAuth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import styles from '../auth.module.scss';

function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
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
        await register(email, password);
        router.push('/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed');
      } finally {
        setLoading(false);
      }
    },
    [email, password, register, router],
  );

  return (
    <main className={styles.page} data-test-id='register-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
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
              maxLength={72}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              required
              type='password'
              value={password}
            />
            <span className={styles.hint}>8 to 72 characters</span>
          </div>
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={loading} type='submit'>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className={styles.footer}>
          Already have an account?{' '}
          <Link className={styles.link} href='/login'>
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

RegisterPage.displayName = 'RegisterPage';

export default RegisterPage;
