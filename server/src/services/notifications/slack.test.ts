import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/config/env.js", () => ({
  env: {
    SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/test/webhook",
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import type { NotificationEvent } from "app/services/notifications/dispatcher.js";
import { sendSlack } from "app/services/notifications/slack.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

describe("sendSlack", () => {
  it("sends Slack message for incident_created event", async () => {
    const event: NotificationEvent = {
      type: "incident_created",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      cause: "503 error",
      incidentId: "inc-1",
    };

    await sendSlack(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.slack.com/services/test/webhook");
    const body = JSON.parse(opts.body as string);
    expect(body.blocks).toBeDefined();
    const blockText = JSON.stringify(body.blocks);
    expect(blockText).toContain("My API");
    expect(blockText).toContain("DOWN");
  });

  it("sends Slack message for incident_resolved event", async () => {
    const event: NotificationEvent = {
      type: "incident_resolved",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      durationMinutes: 20,
    };

    await sendSlack(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const blockText = JSON.stringify(body.blocks);
    expect(blockText).toContain("RECOVERED");
    expect(blockText).toContain("20");
  });

  it("sends Slack message for tls_warning event", async () => {
    const event: NotificationEvent = {
      type: "tls_warning",
      serviceId: "svc-1",
      serviceName: "My API",
      daysUntilExpiry: 4,
    };

    await sendSlack(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    const blockText = JSON.stringify(body.blocks);
    expect(blockText).toContain("TLS");
    expect(blockText).toContain("4");
  });

  it("throws on non-ok Slack response", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const event: NotificationEvent = {
      type: "incident_created",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      incidentId: "inc-1",
    };

    await expect(sendSlack(event)).rejects.toThrow("Slack webhook error 500");
  });
});
