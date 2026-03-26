#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const huskyDir = path.join(repoRoot, '.husky');

function runGit(args, options = {}) {
  return spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options
  });
}

const gitRepoCheck = runGit(['rev-parse', '--is-inside-work-tree']);

if (gitRepoCheck.status !== 0 || gitRepoCheck.stdout.trim() !== 'true') {
  console.log(
    '[setup-hooks] Skipping Git hook installation because this directory is not a Git repository.'
  );
  process.exit(0);
}

const hookPathConfig = runGit(['config', 'core.hooksPath', '.husky'], {
  stdio: 'inherit'
});

if (hookPathConfig.status !== 0) {
  process.exit(hookPathConfig.status ?? 1);
}

for (const entry of fs.readdirSync(huskyDir)) {
  const hookPath = path.join(huskyDir, entry);
  const stats = fs.statSync(hookPath);

  if (!stats.isFile()) {
    continue;
  }

  try {
    fs.chmodSync(hookPath, 0o755);
  } catch (error) {
    if (process.platform !== 'win32') {
      console.error(
        `[setup-hooks] Failed to update hook permissions: ${hookPath}`
      );
      console.error(error.message);
      process.exit(1);
    }
  }
}

console.log('[setup-hooks] Git hooks path configured to .husky.');
