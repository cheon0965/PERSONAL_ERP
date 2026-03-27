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

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.NEXT_RUNTIME = 'nodejs';

  fs.rmSync(distDir, { recursive: true, force: true });
  process.chdir(appDir);

  // This environment fails on Next's default prerender worker path.
  // The debug-prerender mode keeps the build on a stable path that completes successfully.
  await build(appDir, false, false, true);
}

main().catch((error) => {
  console.error('[build-web-inproc] Next.js build failed.');
  console.error(error);
  process.exit(1);
});
