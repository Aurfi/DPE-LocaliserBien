import { defineConfig, devices } from '@playwright/test'

// Dedicated, isolated Chromium contexts. The normal UI suite still blocks SWs.
// No external browser endpoint, production URL, or browser executable override.
export default defineConfig({
  testDir: './e2e-pwa',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/pwa',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/pwa', open: 'never' }],
    ['json', { outputFile: 'reports/pwa/results.json' }],
    ['junit', { outputFile: 'reports/pwa/junit.xml' }]
  ],
  use: {
    ...devices['Desktop Chrome'],
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'pwa-chromium', use: { browserName: 'chromium' } }]
})
