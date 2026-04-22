import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    logger.warn(
      { event: 'email_skipped', to },
      'RESEND_API_KEY not set; skipping password reset email',
    );
    return;
  }

  const { error } = await getClient().emails.send({
    from: env.RESEND_FROM_EMAIL,
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
    subject: 'Reset your password',
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
    to,
  });

  if (error) {
    logger.error(
      { err: error, event: 'email_send_failed', to },
      'Failed to send password reset email',
    );
    throw new Error(`Email send failed: ${error.message}`);
  }

  logger.info({ event: 'email_sent', to }, 'Password reset email sent');
}
