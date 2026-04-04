import { defineConfig } from '@playwright/test';
import { buildPlaywrightConfig } from './playwright.shared.mjs';

export default defineConfig(
  buildPlaywrightConfig({
    serverMode: 'dev',
    port: 3000,
    reuseExistingServer: !process.env.CI
  })
);
