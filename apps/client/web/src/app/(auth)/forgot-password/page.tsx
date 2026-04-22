'use client';

import { type FormEvent, useCallback, useState } from 'react';

import { api } from '@/services/api';
import Link from 'next/link';

import styles from '../auth.module.scss';

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      try {
        await api('/auth/forgot-password', { body: { email }, method: 'POST' });
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  if (submitted) {
    return (
      <main className={styles.page} data-test-id='forgot-password-page'>
        <div className={styles.card}>
          <h1 className={styles.title}>Check your email</h1>
          <p className={styles.hint}>
            If that email is registered, you will receive a reset link shortly.
          </p>
          <p className={`${styles.footer} ${styles.footerSpaced}`}>
            <Link className={styles.link} href='/login'>
              Back to log in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page} data-test-id='forgot-password-page'>
      <div className={styles.card}>
        <h1 className={styles.title}>Forgot password</h1>
        <form
          className={styles.form}
          data-test-id='forgot-password-form'
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
          {error && (
            <p className={styles.error} role='alert'>
              {error}
            </p>
          )}
          <button className={styles.submit} disabled={loading} type='submit'>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
        <p className={styles.footer}>
          <Link className={styles.link} href='/login'>
            Back to log in
          </Link>
        </p>
      </div>
    </main>
  );
}

ForgotPasswordPage.displayName = 'ForgotPasswordPage';

export default ForgotPasswordPage;
