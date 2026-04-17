import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://localhost',
    ignoreHTTPSErrors: true,
    headless: true
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
