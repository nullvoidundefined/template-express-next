import { redisHealthCheck } from 'app/services/redis.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPing, mockOn } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockPing: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(() => ({ on: mockOn, ping: mockPing })),
  default: vi.fn(() => ({ on: mockOn, ping: mockPing })),
}));

describe('redisHealthCheck', () => {
  beforeEach(() => {
    mockPing.mockReset();
  });

  it('returns true when ping succeeds', async () => {
    mockPing.mockResolvedValue('PONG');
    const result = await redisHealthCheck();
    expect(result).toBe(true);
  });

  it('returns false when ping throws', async () => {
    mockPing.mockRejectedValue(new Error('Connection refused'));
    const result = await redisHealthCheck();
    expect(result).toBe(false);
  });
});
