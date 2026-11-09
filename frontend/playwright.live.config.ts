import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './live-tests',
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:18195',
    viewport: { width: 1440, height: 1000 },
    launchOptions: process.env.CM_CHROMIUM_PATH ? { executablePath: process.env.CM_CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  outputDir: './test-results-live',
  webServer: {
    command: 'env -u CM_URL -u CM_TOKEN -u ELASTIC_URL -u ELASTIC_API_KEY -u ANTHROPIC_API_KEY PORT=18195 INCIDENT_ID=INC-LOCAL-VERIFY INCIDENT_TITLE="Local verification" CM_SUSPECT_AFTER=60s CM_OFFLINE_AFTER=120s ROSTER=../roster.yaml WEB_DIR=../frontend/dist go run .',
    cwd: '../service',
    url: 'http://127.0.0.1:18195/healthz',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
