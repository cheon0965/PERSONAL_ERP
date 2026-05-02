#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  applyNextInProcessWorkerPatch
} = require('./patch-next-inprocess-worker.cjs');

applyNextInProcessWorkerPatch();

require('next/dist/server/require-hook');

const build = require('next/dist/build').default;

const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'apps', 'web');
const distDir = path.join(appDir, '.next');
const smokeApiBaseUrl = 'http://127.0.0.1:3100/api';

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.NEXT_RUNTIME = 'nodejs';
  // This in-process build is only used by web smoke checks. Standard production
  // builds still run through `next build` and keep the app's env validation strict.
  process.env.NEXT_PUBLIC_API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || smokeApiBaseUrl;

  fs.rmSync(distDir, { recursive: true, force: true });
  process.chdir(appDir);

  // 표준 프로덕션 빌드를 실행한다. 레거시 _error 페이지 프리렌더 경로를
  // 트리거하지 않도록 debug-prerender 모드는 의도적으로 끈다.
  await build(appDir, false, false, false);
}

main().catch((error) => {
  console.error('[build-web-inproc] Next.js build failed.');
  console.error(error);
  process.exit(1);
});
