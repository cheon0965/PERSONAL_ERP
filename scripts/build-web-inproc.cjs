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

  // Run a standard production build. Debug-prerender mode is intentionally
  // disabled to avoid triggering the legacy _error page prerender path.
  await build(appDir, false, false, false);
}

main().catch((error) => {
  console.error('[build-web-inproc] Next.js build failed.');
  console.error(error);
  process.exit(1);
});
