import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const webAppRoot = path.resolve(repoRoot, 'apps/web');
const e2eHost = '127.0.0.1';

const e2eWebEnv = {
  NEXT_PUBLIC_API_BASE_URL: `http://${e2eHost}:4000/api`,
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: 'false'
};

export function buildPlaywrightConfig(input) {
  const isCi = process.env.CI === 'true';
  const port = String(input.port);
  const baseURL = `http://${e2eHost}:${port}`;
  const command =
    input.serverMode === 'start-inproc'
      ? `node ../../scripts/run-with-root-env.cjs node ../../scripts/start-web-prod-inproc.cjs --port ${port} --hostname ${e2eHost}`
      : input.serverMode === 'start'
        ? `node ../../scripts/run-with-root-env.cjs next start --port ${port} --hostname ${e2eHost}`
        : `node ../../scripts/run-with-root-env.cjs next dev --port ${port} --hostname ${e2eHost}`;

  return {
    testDir: './e2e',
    fullyParallel: false,
    workers: 1,
    retries: isCi ? 2 : 0,
    timeout: isCi ? 90_000 : 60_000,
    expect: {
      timeout: isCi ? 15_000 : 10_000
    },
    outputDir: './test-results',
    reporter: [['list']],
    use: {
      baseURL,
      headless: true,
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure'
    },
    webServer: {
      command,
      cwd: webAppRoot,
      env: {
        ...process.env,
        ...e2eWebEnv
      },
      url: `${baseURL}/login`,
      reuseExistingServer: input.reuseExistingServer,
      timeout: 180_000
    }
  };
}
