import { env } from "app/config/env.js";
import type { NotificationEvent } from "app/services/notifications/dispatcher.js";

function buildSlackBlocks(event: NotificationEvent): object[] {
  if (event.type === "incident_created") {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:red_circle: *DOWN: ${event.serviceName}*\n3 consecutive failures detected`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*URL:*\n<${event.serviceUrl}|${event.serviceUrl}>` },
          ...(event.cause ? [{ type: "mrkdwn", text: `*Error:*\n${event.cause}` }] : []),
        ],
      },
    ];
  }
  if (event.type === "incident_resolved") {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:large_green_circle: *RECOVERED: ${event.serviceName}*\nBack up after ${event.durationMinutes} minute outage`,
        },
      },
      {
        type: "section",
        fields: [{ type: "mrkdwn", text: `*URL:*\n<${event.serviceUrl}|${event.serviceUrl}>` }],
      },
    ];
  }
  if (event.type === "tls_warning") {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:warning: *TLS WARNING: ${event.serviceName}*\nCertificate expires in ${event.daysUntilExpiry} days`,
        },
      },
    ];
  }
  return [];
}

export async function sendSlack(event: NotificationEvent): Promise<void> {
  const blocks = buildSlackBlocks(event);
  const res = await fetch(env.SLACK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  if (!res.ok) throw new Error(`Slack webhook error ${res.status}`);
}
