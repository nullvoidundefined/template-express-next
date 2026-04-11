import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi
  .fn()
  .mockResolvedValue({ data: { id: 'email-id' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockSend },
  })),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('sendEmail', () => {
  describe('when RESEND_API_KEY is not set', () => {
    beforeEach(() => {
      vi.resetModules();
      mockSend.mockReset();
      vi.doMock('app/config/env.js', () => ({
        env: {
          RESEND_API_KEY: undefined,
          RESEND_FROM_EMAIL: 'hello@doppelscript.com',
        },
        isDev: true,
        isProd: false,
        isProduction: () => false,
        isStaging: false,
      }));
    });

    it('logs to console instead of calling Resend', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({
        html: '<p>Hello</p>',
        subject: 'Test',
        to: 'user@example.com',
      });
      expect(mockSend).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('user@example.com'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('when RESEND_API_KEY is set', () => {
    beforeEach(() => {
      vi.resetModules();
      mockSend.mockReset();
      vi.doMock('app/config/env.js', () => ({
        env: {
          RESEND_API_KEY: 're_test_key',
          RESEND_FROM_EMAIL: 'hello@doppelscript.com',
        },
        isDev: false,
        isProd: true,
        isProduction: () => true,
        isStaging: false,
      }));
    });

    it('calls Resend with correct sender and fields', async () => {
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({
        html: '<p>Hello</p>',
        subject: 'Test Subject',
        to: 'user@example.com',
      });
      expect(mockSend).toHaveBeenCalledWith({
        from: 'hello@doppelscript.com',
        html: '<p>Hello</p>',
        subject: 'Test Subject',
        to: 'user@example.com',
      });
    });

    it('logs to address and subject but not html body', async () => {
      const { logger } = await import('app/utils/logs/logger.js');
      const { sendEmail } = await import('app/services/email.js');
      await sendEmail({
        html: '<p>SENSITIVE BODY CONTENT</p>',
        subject: 'My Subject',
        to: 'user@example.com',
      });
      expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'My Subject',
          to: 'user@example.com',
        }),
        expect.any(String),
      );
      const calls = vi.mocked(logger.info).mock.calls;
      const loggedObject = JSON.stringify(calls);
      expect(loggedObject).not.toContain('SENSITIVE BODY CONTENT');
    });
  });
});
