import path from 'node:path';
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  globalSetup: path.join(__dirname, 'e2e', 'global-setup.ts'),
  use: {
    baseURL: 'http://127.0.0.1:3456',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run e2e:server',
    url: 'http://127.0.0.1:3456/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
