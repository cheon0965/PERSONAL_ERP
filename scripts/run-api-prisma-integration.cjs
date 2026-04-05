#!/usr/bin/env node

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const apiRoot = path.resolve(__dirname, '..', 'apps', 'api');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const env = {
  ...process.env,
  RUN_PRISMA_INTEGRATION: '1'
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: apiRoot,
    env,
    shell: options.shell ?? false
  });

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNpm(args) {
  if (process.platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', [npmCommand, ...args].join(' ')]);
    return;
  }

  run(npmCommand, args);
}

runNpm(['run', 'clean:test-dist']);
runNpm(['run', 'compile:test']);

const prismaIntegrationTests = fs
  .readdirSync(path.join(apiRoot, '.test-dist', 'apps', 'api', 'test'))
  .filter((fileName) => fileName.endsWith('.prisma.integration.test.js'))
  .sort()
  .map((fileName) =>
    path.posix.join('.test-dist', 'apps', 'api', 'test', fileName)
  );

if (prismaIntegrationTests.length === 0) {
  console.error('No Prisma integration test files were found.');
  process.exit(1);
}

run(process.execPath, [
  '--test',
  '--test-concurrency=1',
  '--test-isolation=none',
  ...prismaIntegrationTests
]);
