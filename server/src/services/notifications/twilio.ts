import { env } from "app/config/env.js";
import type { NotificationEvent } from "app/services/notifications/dispatcher.js";

const TWILIO_API = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

function formatSmsMessage(event: NotificationEvent): string {
  if (event.type === "incident_created") {
    return `[HEALTH] DOWN: ${event.serviceName}\n3 consecutive failures\n${event.serviceUrl}`;
  }
  if (event.type === "incident_resolved") {
    return `[HEALTH] RECOVERED: ${event.serviceName}\nBack up (${event.durationMinutes} min outage)\n${event.serviceUrl}`;
  }
  if (event.type === "tls_warning") {
    return `[HEALTH] TLS WARNING: ${event.serviceName}\nCertificate expires in ${event.daysUntilExpiry} days`;
  }
  return "";
}

export async function sendSms(event: NotificationEvent): Promise<void> {
  const message = formatSmsMessage(event);
  if (!message) return;

  const body = new URLSearchParams({
    To: env.ALERT_PHONE_NUMBER ?? "",
    From: env.TWILIO_FROM_NUMBER ?? "",
    Body: message,
  });

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");

  const res = await fetch(TWILIO_API, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error ${res.status}: ${text}`);
  }
}
