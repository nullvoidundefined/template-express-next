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
    const { env } = await import('../../config/env.js');
    expect(env).toBeDefined();
    expect(env.DATABASE_URL).toBeDefined();
    expect(env.PORT).toBeTypeOf('number');
    expect(() => {
      (env as any).PORT = 9999;
    }).toThrow();
  });

  it('exports isDev, isProd, isDeployed helpers', async () => {
    const { isDev, isDeployed, isProd } = await import('../../config/env.js');
    expect(typeof isDev).toBe('boolean');
    expect(typeof isProd).toBe('boolean');
    expect(typeof isDeployed).toBe('function');
  });
});
