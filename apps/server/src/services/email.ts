import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { Resend } from 'resend';

interface SendEmailOptions {
  html: string;
  subject: string;
  to: string;
}

let resend: Resend | null = null;

if (env.RESEND_API_KEY) {
  resend = new Resend(env.RESEND_API_KEY);
}

async function sendEmail({
  html,
  subject,
  to,
}: SendEmailOptions): Promise<void> {
  logger.info({ subject, to }, 'Sending email');

  if (!resend) {
    console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
    return;
  }

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    html,
    subject,
    to,
  });
}

export { sendEmail };
export type { SendEmailOptions };
