import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/testdb');
    vi.stubEnv('SESSION_SECRET', 'test-secret-value');
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports a frozen env object with typed properties', async () => {
    const { env } = await import('../../config/envConfig.js');
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.PORT).toBeTypeOf('number');
    expect(() => {
      (env as any).PORT = 9999;
    }).toThrow();
  });

  it('leaves STRIPE_PRICE_ID undefined when it is unset (B-5)', async () => {
    const { env } = await import('../../config/envConfig.js');
    expect(env.STRIPE_PRICE_ID).toBeUndefined();
  });

  it('exposes a STRIPE_PRICE_ID that matches the price pattern (B-5)', async () => {
    vi.stubEnv('STRIPE_PRICE_ID', 'price_1AbC23dEf');
    const { env } = await import('../../config/envConfig.js');
    expect(env.STRIPE_PRICE_ID).toBe('price_1AbC23dEf');
  });

  it.each(['prod_1AbC23', 'price_', 'price_abc-def', 'price_abc def'])(
    'refuses to load with STRIPE_PRICE_ID %j (B-5)',
    async (invalidPriceId) => {
      vi.stubEnv('STRIPE_PRICE_ID', invalidPriceId);
      await expect(import('../../config/envConfig.js')).rejects.toThrow();
    },
  );

  it('exports isDev, isProd, isDeployed helpers', async () => {
    const { isDev, isDeployed, isProd } =
      await import('../../config/envConfig.js');
    expect(typeof isDev).toBe('boolean');
    expect(typeof isProd).toBe('boolean');
    expect(typeof isDeployed).toBe('function');
  });
});
