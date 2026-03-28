import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
const mockSendSlack = vi.fn().mockResolvedValue(undefined);

vi.mock("./twilio.js", () => ({ sendSms: mockSendSms }));
vi.mock("./resend.js", () => ({ sendEmail: mockSendEmail }));
vi.mock("./slack.js", () => ({ sendSlack: mockSendSlack }));

vi.mock("app/utils/logs/logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import type { NotificationEvent } from "app/services/notifications/dispatcher.js";

const incidentEvent: NotificationEvent = {
  type: "incident_created",
  serviceId: "svc-1",
  serviceName: "My API",
  serviceUrl: "https://myapi.com",
  incidentId: "inc-1",
};

describe("dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("calls SMS when all Twilio env vars are set", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_FROM_NUMBER: "+1555",
        ALERT_PHONE_NUMBER: "+1666",
        RESEND_API_KEY: undefined,
        ALERT_EMAIL: undefined,
        SLACK_WEBHOOK_URL: undefined,
      },
    }));

    const { dispatch } = await import("./dispatcher.js");
    await dispatch(incidentEvent);

    expect(mockSendSms).toHaveBeenCalledWith(incidentEvent);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSlack).not.toHaveBeenCalled();
  });

  it("calls email when RESEND_API_KEY and ALERT_EMAIL are set", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_NUMBER: undefined,
        ALERT_PHONE_NUMBER: undefined,
        RESEND_API_KEY: "re_key",
        ALERT_EMAIL: "a@b.com",
        SLACK_WEBHOOK_URL: undefined,
      },
    }));

    const { dispatch } = await import("./dispatcher.js");
    await dispatch(incidentEvent);

    expect(mockSendEmail).toHaveBeenCalledWith(incidentEvent);
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockSendSlack).not.toHaveBeenCalled();
  });

  it("calls Slack when SLACK_WEBHOOK_URL is set", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_NUMBER: undefined,
        ALERT_PHONE_NUMBER: undefined,
        RESEND_API_KEY: undefined,
        ALERT_EMAIL: undefined,
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
      },
    }));

    const { dispatch } = await import("./dispatcher.js");
    await dispatch(incidentEvent);

    expect(mockSendSlack).toHaveBeenCalledWith(incidentEvent);
    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("calls all channels when all env vars are set", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_FROM_NUMBER: "+1555",
        ALERT_PHONE_NUMBER: "+1666",
        RESEND_API_KEY: "re_key",
        ALERT_EMAIL: "a@b.com",
        SLACK_WEBHOOK_URL: "https://hooks.slack.com/test",
      },
    }));

    const { dispatch } = await import("./dispatcher.js");
    await dispatch(incidentEvent);

    expect(mockSendSms).toHaveBeenCalledWith(incidentEvent);
    expect(mockSendEmail).toHaveBeenCalledWith(incidentEvent);
    expect(mockSendSlack).toHaveBeenCalledWith(incidentEvent);
  });

  it("does not call any channel when no env vars are set", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: undefined,
        TWILIO_AUTH_TOKEN: undefined,
        TWILIO_FROM_NUMBER: undefined,
        ALERT_PHONE_NUMBER: undefined,
        RESEND_API_KEY: undefined,
        ALERT_EMAIL: undefined,
        SLACK_WEBHOOK_URL: undefined,
      },
    }));

    const { dispatch } = await import("./dispatcher.js");
    await dispatch(incidentEvent);

    expect(mockSendSms).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockSendSlack).not.toHaveBeenCalled();
  });

  it("continues dispatching other channels even if one fails", async () => {
    vi.doMock("app/config/env.js", () => ({
      env: {
        TWILIO_ACCOUNT_SID: "ACtest",
        TWILIO_AUTH_TOKEN: "token",
        TWILIO_FROM_NUMBER: "+1555",
        ALERT_PHONE_NUMBER: "+1666",
        RESEND_API_KEY: "re_key",
        ALERT_EMAIL: "a@b.com",
        SLACK_WEBHOOK_URL: undefined,
      },
    }));

    mockSendSms.mockRejectedValueOnce(new Error("SMS failed"));

    const { dispatch } = await import("./dispatcher.js");
    await expect(dispatch(incidentEvent)).resolves.not.toThrow();
    expect(mockSendEmail).toHaveBeenCalled();
  });
});
