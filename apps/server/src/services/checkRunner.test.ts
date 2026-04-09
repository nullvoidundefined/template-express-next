import { determineStatus } from 'app/services/checkRunner.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('app/repositories/checks/checks.js', () => ({
  insertCheck: vi.fn().mockResolvedValue({}),
}));

vi.mock('app/utils/logs/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('determineStatus', () => {
  const base = {
    statusCodeMatches: true,
    responseTimeMs: 100,
    timeoutMs: 10000,
    tlsValid: true,
    tlsExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
    isHttps: true,
  };

  it("returns 'up' when status code matches, response fast, TLS valid and not expiring soon", () => {
    expect(determineStatus(base)).toBe('up');
  });

  it("returns 'down' when status code does not match", () => {
    expect(determineStatus({ ...base, statusCodeMatches: false })).toBe('down');
  });

  it("returns 'degraded' when response time > 80% of timeout", () => {
    const result = determineStatus({
      ...base,
      responseTimeMs: 8500,
      timeoutMs: 10000,
    });
    expect(result).toBe('degraded');
  });

  it("returns 'up' when response time is exactly 80% of timeout", () => {
    const result = determineStatus({
      ...base,
      responseTimeMs: 8000,
      timeoutMs: 10000,
    });
    expect(result).toBe('up');
  });

  it("returns 'degraded' when TLS expires within 14 days", () => {
    const soonExpiring = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const result = determineStatus({ ...base, tlsExpiresAt: soonExpiring });
    expect(result).toBe('degraded');
  });

  it("returns 'down' when TLS is invalid (expired)", () => {
    const expired = new Date(Date.now() - 1000);
    const result = determineStatus({
      ...base,
      tlsValid: false,
      tlsExpiresAt: expired,
    });
    expect(result).toBe('down');
  });

  it("returns 'up' for HTTP (non-HTTPS) without TLS checks", () => {
    const result = determineStatus({
      ...base,
      isHttps: false,
      tlsValid: null,
      tlsExpiresAt: null,
    });
    expect(result).toBe('up');
  });

  it("returns 'degraded' for HTTPS with TLS expiring in exactly 13 days", () => {
    const almostExpired = new Date(Date.now() + 13 * 24 * 60 * 60 * 1000);
    const result = determineStatus({ ...base, tlsExpiresAt: almostExpired });
    expect(result).toBe('degraded');
  });

  it("returns 'up' for HTTPS with TLS expiring in exactly 15 days", () => {
    const fifteenDays = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const result = determineStatus({ ...base, tlsExpiresAt: fifteenDays });
    expect(result).toBe('up');
  });
});
