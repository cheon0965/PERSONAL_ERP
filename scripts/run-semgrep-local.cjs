#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${repoRoot}:/src`,
    '-w',
    '/src',
    'semgrep/semgrep',
    'semgrep',
    'scan',
    '--config',
    'auto',
    '--error',
    '--exclude',
    'node_modules',
    '--exclude',
    '.next',
    '--exclude',
    'dist',
    '--exclude',
    '.test-dist',
    '--exclude',
    'apps/api/prisma/migrations',
    '--exclude',
    'scripts'
  ],
  {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env
  }
);

if (result.error) {
  console.error('[ci:local:semgrep] Failed to start Docker.');
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
