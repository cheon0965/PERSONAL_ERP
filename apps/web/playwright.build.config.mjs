import { defineConfig } from '@playwright/test';
import { buildPlaywrightConfig } from './playwright.shared.mjs';

export default defineConfig(
  buildPlaywrightConfig({
    serverMode: 'start',
    port: 3100,
    reuseExistingServer: false
  })
);
