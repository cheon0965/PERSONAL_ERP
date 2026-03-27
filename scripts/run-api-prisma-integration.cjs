#!/usr/bin/env node

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
run(process.execPath, [
  '--test',
  '--test-concurrency=1',
  '--test-isolation=none',
  '.test-dist/apps/api/test/transactions.prisma.integration.test.js'
]);
