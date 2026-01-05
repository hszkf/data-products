import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  // Increase timeout for slow network operations
  timeout: 60000,
  expect: {
    timeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security', '--allow-running-insecure-content']
        }
      },
    },
  ],

  // Run local dev server before starting the tests
  // Commented out since we'll run servers manually
  // webServer: [
  //   {
  //     command: 'cd ../backend && bun run src/index.ts',
  //     url: 'http://localhost:8080/health',
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'npm run dev',
  //     url: 'http://localhost:3000',
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});
