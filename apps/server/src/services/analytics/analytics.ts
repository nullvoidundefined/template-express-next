import { ANALYTICS_EVENTS } from '@repo/constants';
import { env } from 'app/config/env.js';
import { logger } from 'app/utils/logs/logger.js';
import { PostHog } from 'posthog-node';

export type { AnalyticsEvent } from '@repo/constants';
export { ANALYTICS_EVENTS };

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!env.POSTHOG_API_KEY) return null;
  if (!client) {
    client = new PostHog(env.POSTHOG_API_KEY, {
      flushAt: 1,
      flushInterval: 0,
      host: 'https://us.i.posthog.com',
    });
  }
  return client;
}

export function trackEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const ph = getClient();
  if (!ph) return;
  try {
    ph.capture({ distinctId, event, properties });
  } catch (err) {
    logger.warn({ err, event }, 'PostHog trackEvent failed');
  }
}
