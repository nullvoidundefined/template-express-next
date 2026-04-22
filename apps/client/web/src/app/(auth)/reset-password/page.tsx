'use client';

import { type FormEvent, Suspense, useCallback, useState } from 'react';

import { api } from '@/services/api';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from '../auth.module.scss';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      if (!token) {
        setError('Missing reset token. Please use the link from your email.');
        return;
      }

      setLoading(true);
      try {
        await api('/auth/reset-password', {
          body: { password, token },
          method: 'POST',
        });
        router.push('/login?reset=true');
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'This link is invalid or has expired',
        );
      } finally {
        setLoading(false);
      }
    },
    [confirmPassword, password, router, token],
  );

  return (
    <form
      className={styles.form}
      data-test-id='reset-password-form'
      noValidate
      onSubmit={handleSubmit}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor='password'>
          New password
        </label>
        <input
          className={styles.input}
          id='password'
          minLength={8}
          onChange={(e) => setPassword(e.target.value)}
          required
          type='password'
          value={password}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor='confirm-password'>
          Confirm password
        </label>
        <input
          className={styles.input}
          id='confirm-password'
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          type='password'
          value={confirmPassword}
        />
      </div>
      {error && (
        <p className={styles.error} role='alert'>
          {error}
        </p>
      )}
      <button
        className={styles.submit}
        disabled={loading || !token}
        type='submit'
      >
        {loading ? 'Resetting...' : 'Reset password'}
      </button>
    </form>
  );
}

ResetPasswordForm.displayName = 'ResetPasswordForm';

function ResetPasswordPage() {
  return (
    <main className={styles.page} data-test-id='reset-password-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset password</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <p className={styles.footer}>
          <Link className={styles.link} href='/login'>
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}

ResetPasswordPage.displayName = 'ResetPasswordPage';

export default ResetPasswordPage;
