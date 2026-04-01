import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("app/config/env.js", () => ({
  env: {
    RESEND_API_KEY: "re_test_key123",
    ALERT_EMAIL: "alerts@example.com",
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import type { NotificationEvent } from "app/services/notifications/dispatcher.js";
import { sendEmail } from "app/services/notifications/resend.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

describe("sendEmail", () => {
  it("sends email for incident_created event", async () => {
    const event: NotificationEvent = {
      type: "incident_created",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      cause: "Timeout",
      incidentId: "inc-1",
    };

    await sendEmail(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(opts.body as string);
    expect(body.subject).toBe("[DOWN] My API");
    expect(body.to).toBe("alerts@example.com");
    expect(body.html).toContain("Timeout");
  });

  it("sends email for incident_resolved event", async () => {
    const event: NotificationEvent = {
      type: "incident_resolved",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      durationMinutes: 30,
    };

    await sendEmail(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.subject).toBe("[RECOVERED] My API");
    expect(body.html).toContain("30 minutes");
  });

  it("sends email for tls_warning event", async () => {
    const event: NotificationEvent = {
      type: "tls_warning",
      serviceId: "svc-1",
      serviceName: "My API",
      daysUntilExpiry: 6,
    };

    await sendEmail(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.subject).toBe("[TLS WARNING] My API");
    expect(body.html).toContain("6 days");
  });

  it("throws on non-ok Resend response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => "Unprocessable",
    });

    const event: NotificationEvent = {
      type: "incident_created",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      incidentId: "inc-1",
    };

    await expect(sendEmail(event)).rejects.toThrow("Resend error 422");
  });

  it("uses Bearer auth header", async () => {
    const event: NotificationEvent = {
      type: "incident_created",
      serviceId: "svc-1",
      serviceName: "My API",
      serviceUrl: "https://myapi.com",
      incidentId: "inc-1",
    };

    await sendEmail(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer re_test_key123");
  });
});
