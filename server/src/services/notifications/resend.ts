import { env } from "app/config/env.js";
import type { NotificationEvent } from "app/services/notifications/dispatcher.js";

const RESEND_API = "https://api.resend.com/emails";

function formatEmailHtml(event: NotificationEvent): { subject: string; html: string } {
  if (event.type === "incident_created") {
    return {
      subject: `[DOWN] ${event.serviceName}`,
      html: `<h2>${event.serviceName} is down</h2><p>URL: <a href="${event.serviceUrl}">${event.serviceUrl}</a></p>${event.cause ? `<p>Error: ${event.cause}</p>` : ""}`,
    };
  }
  if (event.type === "incident_resolved") {
    return {
      subject: `[RECOVERED] ${event.serviceName}`,
      html: `<h2>${event.serviceName} is back up</h2><p>Outage duration: ${event.durationMinutes} minutes</p>`,
    };
  }
  if (event.type === "tls_warning") {
    return {
      subject: `[TLS WARNING] ${event.serviceName}`,
      html: `<h2>TLS certificate expiring</h2><p>${event.serviceName} certificate expires in ${event.daysUntilExpiry} days.</p>`,
    };
  }
  return { subject: "", html: "" };
}

export async function sendEmail(event: NotificationEvent): Promise<void> {
  const { subject, html } = formatEmailHtml(event);
  if (!subject) return;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "health@yourdomain.com",
      to: env.ALERT_EMAIL,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}
