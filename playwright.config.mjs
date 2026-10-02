import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5190', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: process.platform === 'darwin' && existsSync('/Applications/Google Chrome.app') ? 'chrome' : undefined } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'python3 -m http.server 5190 --bind 127.0.0.1',
    url: 'http://127.0.0.1:5190',
    reuseExistingServer: false,
    stderr: 'ignore',
  },
});
