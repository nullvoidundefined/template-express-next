import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';

export type NotificationEvent =
  | {
      type: 'incident_created';
      serviceId: string;
      serviceName: string;
      serviceUrl: string;
      cause?: string | null;
      incidentId: string;
    }
  | {
      type: 'incident_resolved';
      serviceId: string;
      serviceName: string;
      serviceUrl: string;
      durationMinutes: number;
    }
  | {
      type: 'tls_warning';
      serviceId: string;
      serviceName: string;
      daysUntilExpiry: number;
    };

export async function dispatch(event: NotificationEvent): Promise<void> {
  const { sendSms } = await import('./twilio.js');
  const { sendEmail } = await import('./resend.js');
  const { sendSlack } = await import('./slack.js');

  const promises: Promise<void>[] = [];

  if (
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    env.TWILIO_FROM_NUMBER &&
    env.ALERT_PHONE_NUMBER
  ) {
    promises.push(
      sendSms(event).catch((err) =>
        logger.error({ err }, 'SMS notification failed'),
      ),
    );
  }
  if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
    promises.push(
      sendEmail(event).catch((err) =>
        logger.error({ err }, 'Email notification failed'),
      ),
    );
  }
  if (env.SLACK_WEBHOOK_URL) {
    promises.push(
      sendSlack(event).catch((err) =>
        logger.error({ err }, 'Slack notification failed'),
      ),
    );
  }

  await Promise.allSettled(promises);
}
