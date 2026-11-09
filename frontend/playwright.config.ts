import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:6006',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CM_CHROMIUM_PATH ? { executablePath: process.env.CM_CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run storybook -- --ci',
    url: 'http://127.0.0.1:6006',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
