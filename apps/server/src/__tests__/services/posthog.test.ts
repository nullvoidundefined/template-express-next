import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock('posthog-node', () => ({
  PostHog: vi.fn(() => ({
    capture: mockCapture,
    shutdown: mockShutdown,
  })),
}));

vi.mock('app/config/env.js', () => ({
  env: {
    POSTHOG_API_KEY: undefined,
    POSTHOG_HOST: 'https://us.i.posthog.com',
  },
  isDev: true,
  isProd: false,
  isProduction: () => false,
  isStaging: false,
}));

describe('posthog service', () => {
  describe('when POSTHOG_API_KEY is not set', () => {
    beforeEach(() => {
      mockCapture.mockReset();
      mockShutdown.mockReset();
    });

    it('trackEvent does not throw and does not call capture', async () => {
      const { trackEvent } = await import('app/services/posthog.js');
      expect(() => trackEvent('user-1', 'test_event')).not.toThrow();
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('shutdownPostHog resolves without calling client shutdown', async () => {
      const { shutdownPostHog } = await import('app/services/posthog.js');
      await expect(shutdownPostHog()).resolves.toBeUndefined();
      expect(mockShutdown).not.toHaveBeenCalled();
    });
  });
});
