#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const {
  applyNextInProcessWorkerPatch
} = require('./patch-next-inprocess-worker.cjs');

applyNextInProcessWorkerPatch();

require('next/dist/server/require-hook');

const { startServer } = require('next/dist/server/lib/start-server.js');

const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'apps', 'web');
const distDir = path.join(appDir, '.next');

function printHelp() {
  console.log(
    'Usage: node scripts/start-web-prod-inproc.cjs [--port <port>] [--hostname <hostname>]'
  );
}

function parseArgs(argv) {
  let port = process.env.PORT ? Number(process.env.PORT) : 3000;
  let hostname;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--port' || arg === '-p') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --port.');
      }

      port = Number(nextValue);
      index += 1;
      continue;
    }

    if (arg === '--hostname' || arg === '-H') {
      const nextValue = argv[index + 1];
      if (!nextValue) {
        throw new Error('Missing value for --hostname.');
      }

      hostname = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid port: ${port}`);
  }

  return { port, hostname };
}

async function main() {
  process.env.NODE_ENV = process.env.NODE_ENV || 'production';
  process.env.NEXT_RUNTIME = 'nodejs';

  if (!fs.existsSync(distDir)) {
    throw new Error(
      `Production build output was not found at ${distDir}. Run the smoke build before starting the server.`
    );
  }

  const { port, hostname } = parseArgs(process.argv.slice(2));
  process.chdir(appDir);

  await startServer({
    dir: appDir,
    isDev: false,
    allowRetry: false,
    port,
    hostname
  });
}

main().catch((error) => {
  console.error(
    '[start-web-prod-inproc] Failed to start Next.js production server.'
  );
  console.error(error);
  process.exit(1);
});
