import { execSync } from 'node:child_process';

const isCI = !!process.env.CI;

export default function globalSetup(): void {
  if (isCI) {
    console.log('[global-setup] CI: seeding test database...');
    execSync('pnpm --filter server run seed:test', { stdio: 'inherit' });
  } else {
    console.log('[global-setup] Ensuring test database...');
    execSync('bash scripts/ensure-test-db.sh', { stdio: 'inherit' });
  }
  console.log('[global-setup] Done.');
}
