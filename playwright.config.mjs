// FROZEN (covered by eval.lock). Test runner for the whole eval suite.
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT) || 4173;

export default defineConfig({
  testDir: 'eval',
  outputDir: 'eval/artifacts/test-results',
  snapshotPathTemplate: '{testDir}/golden/{arg}{ext}',
  timeout: 15_000,
  expect: { timeout: 2_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    actionTimeout: 2_000,
  },
  projects: [
    { name: 'unit', testMatch: /unit\/.*\.spec\.mjs$/ },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
    },
    {
      name: 'capture',
      testMatch: /capture\.spec\.mjs$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
  webServer: {
    command: 'node server.mjs',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 10_000,
  },
});
