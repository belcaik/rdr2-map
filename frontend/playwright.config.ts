import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests', workers: 1, timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5177', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure',
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {} },
  webServer: [
    { command: 'node tests/start-api.mjs', url: 'http://127.0.0.1:3903/api/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'npm run dev -- --host 127.0.0.1 --port 5177 --strictPort', url: 'http://127.0.0.1:5177', reuseExistingServer: false,
      env: { VITE_API_BASE: 'http://127.0.0.1:3903/api', VITE_TILE_SOURCE: 'none' } },
  ],
});
