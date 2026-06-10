import { describe, expect, it, vi } from 'vitest';

// Mock Redis to null (no Redis available)
vi.mock('app/clients/redisClient.js', () => ({
  redis: null,
}));

describe('circuit-breaker (no Redis)', () => {
  it('isCircuitOpen returns false when Redis is absent', async () => {
    const { isCircuitOpen } =
      await import('../../services/circuitBreakerService.js');
    expect(await isCircuitOpen()).toBe(false);
  });

  it('tripCircuit is a no-op when Redis is absent', async () => {
    const { tripCircuit } =
      await import('../../services/circuitBreakerService.js');
    await expect(tripCircuit()).resolves.toBeUndefined();
  });

  it('closeCircuit is a no-op when Redis is absent', async () => {
    const { closeCircuit } =
      await import('../../services/circuitBreakerService.js');
    await expect(closeCircuit()).resolves.toBeUndefined();
  });
});
