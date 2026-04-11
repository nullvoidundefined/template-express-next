import { env } from 'app/config/env.js';
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

if (env.POSTHOG_API_KEY) {
  client = new PostHog(env.POSTHOG_API_KEY, {
    host: env.POSTHOG_HOST,
  });
}

function trackEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!client) return;
  client.capture({ distinctId: userId, event, properties });
}

async function shutdownPostHog(): Promise<void> {
  if (!client) return;
  await client.shutdown();
}

export { shutdownPostHog, trackEvent };
