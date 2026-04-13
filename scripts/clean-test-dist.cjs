#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const targetArg = process.argv[2] ?? '.test-dist';
const cwd = process.cwd();
const target = path.resolve(cwd, targetArg);
const relativeTarget = path.relative(cwd, target);

if (
  !relativeTarget ||
  relativeTarget.startsWith('..') ||
  path.isAbsolute(relativeTarget)
) {
  console.error(`[clean-test-dist] Refusing to remove outside cwd: ${target}`);
  process.exit(1);
}

if (process.platform === 'win32') {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$Path = $env:CLEAN_TEST_DIST_TARGET; if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop }'
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        CLEAN_TEST_DIST_TARGET: target
      }
    }
  );

  process.exit(result.status ?? 1);
}

fs.rmSync(target, { recursive: true, force: true });
