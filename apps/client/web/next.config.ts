import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid inferring a parent directory as the workspace root when another lockfile exists above this app.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
