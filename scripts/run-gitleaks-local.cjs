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
    `${repoRoot}:/repo`,
    '-w',
    '/repo',
    'ghcr.io/gitleaks/gitleaks:v8.30.0',
    'detect',
    '--source',
    '.',
    '--redact',
    '--exit-code',
    '1'
  ],
  {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env
  }
);

if (result.error) {
  console.error('[ci:local:gitleaks] Failed to start Docker.');
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
