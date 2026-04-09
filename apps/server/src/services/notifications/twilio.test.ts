import type { NotificationEvent } from 'app/services/notifications/dispatcher.js';
import { sendSms } from 'app/services/notifications/twilio.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('app/config/env.js', () => ({
  env: {
    TWILIO_ACCOUNT_SID: 'ACtest123',
    TWILIO_AUTH_TOKEN: 'authtoken456',
    TWILIO_FROM_NUMBER: '+15551234567',
    ALERT_PHONE_NUMBER: '+15557654321',
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true });
});

describe('sendSms', () => {
  it('sends SMS for incident_created event', async () => {
    const event: NotificationEvent = {
      type: 'incident_created',
      serviceId: 'svc-1',
      serviceName: 'My API',
      serviceUrl: 'https://myapi.com',
      cause: 'Connection refused',
      incidentId: 'inc-1',
    };

    await sendSms(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('ACtest123');
    expect(opts.method).toBe('POST');
    const body = opts.body as string;
    expect(body).toContain('My+API');
    expect(body).toContain('DOWN');
  });

  it('sends SMS for incident_resolved event', async () => {
    const event: NotificationEvent = {
      type: 'incident_resolved',
      serviceId: 'svc-1',
      serviceName: 'My API',
      serviceUrl: 'https://myapi.com',
      durationMinutes: 15,
    };

    await sendSms(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = opts.body as string;
    expect(body).toContain('RECOVERED');
    expect(body).toContain('15');
  });

  it('sends SMS for tls_warning event', async () => {
    const event: NotificationEvent = {
      type: 'tls_warning',
      serviceId: 'svc-1',
      serviceName: 'My API',
      daysUntilExpiry: 5,
    };

    await sendSms(event);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = opts.body as string;
    expect(body).toContain('TLS');
  });

  it('throws on non-ok Twilio response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad request',
    });

    const event: NotificationEvent = {
      type: 'incident_created',
      serviceId: 'svc-1',
      serviceName: 'My API',
      serviceUrl: 'https://myapi.com',
      incidentId: 'inc-1',
    };

    await expect(sendSms(event)).rejects.toThrow('Twilio error 400');
  });

  it('uses Basic auth header with base64 encoded credentials', async () => {
    const event: NotificationEvent = {
      type: 'incident_created',
      serviceId: 'svc-1',
      serviceName: 'My API',
      serviceUrl: 'https://myapi.com',
      incidentId: 'inc-1',
    };

    await sendSms(event);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    const expected = Buffer.from('ACtest123:authtoken456').toString('base64');
    expect(headers['Authorization']).toBe(`Basic ${expected}`);
  });
});
