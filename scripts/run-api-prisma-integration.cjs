#!/usr/bin/env node

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const apiRoot = path.resolve(__dirname, '..', 'apps', 'api');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const resolvedDatabaseUrl = resolveDatabaseUrl();
const env = {
  ...process.env,
  RUN_PRISMA_INTEGRATION: '1'
};

if (resolvedDatabaseUrl.value) {
  env.DATABASE_URL = resolvedDatabaseUrl.value;
}

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

function resolveDatabaseUrl() {
  const dedicatedDatabaseUrl = readTrimmedEnvValue(
    'PRISMA_INTEGRATION_DATABASE_URL'
  );

  if (dedicatedDatabaseUrl) {
    return {
      sourceKey: 'PRISMA_INTEGRATION_DATABASE_URL',
      value: dedicatedDatabaseUrl,
      displayTarget: summarizeDatabaseUrl(dedicatedDatabaseUrl)
    };
  }

  if (shouldRequireDedicatedPrismaIntegrationDatabaseUrl()) {
    return {
      sourceKey: null,
      value: null,
      displayTarget: null
    };
  }

  const fallbackDatabaseUrl = readTrimmedEnvValue('DATABASE_URL');

  if (fallbackDatabaseUrl) {
    return {
      sourceKey: 'DATABASE_URL',
      value: fallbackDatabaseUrl,
      displayTarget: summarizeDatabaseUrl(fallbackDatabaseUrl)
    };
  }

  return {
    sourceKey: null,
    value: null,
    displayTarget: null
  };
}

function readTrimmedEnvValue(key) {
  const rawValue = process.env[key];

  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue ? trimmedValue : null;
}

function shouldRequireDedicatedPrismaIntegrationDatabaseUrl() {
  const ciValue = process.env.CI;

  if (typeof ciValue !== 'string') {
    return false;
  }

  const normalizedValue = ciValue.trim().toLowerCase();
  return normalizedValue === '1' || normalizedValue === 'true';
}

function summarizeDatabaseUrl(databaseUrl) {
  try {
    const parsedUrl = new URL(databaseUrl);
    const portSuffix = parsedUrl.port ? `:${parsedUrl.port}` : '';
    const pathname =
      parsedUrl.pathname && parsedUrl.pathname !== '/'
        ? parsedUrl.pathname
        : '';

    return `${parsedUrl.protocol}//${parsedUrl.hostname}${portSuffix}${pathname}`;
  } catch {
    return null;
  }
}

if (resolvedDatabaseUrl.sourceKey) {
  const targetSuffix = resolvedDatabaseUrl.displayTarget
    ? ` (${resolvedDatabaseUrl.displayTarget})`
    : '';

  console.log(
    `[test:prisma] Using ${resolvedDatabaseUrl.sourceKey}${targetSuffix}.`
  );
} else {
  if (shouldRequireDedicatedPrismaIntegrationDatabaseUrl()) {
    console.log(
      '[test:prisma] No PRISMA_INTEGRATION_DATABASE_URL is configured in CI. DATABASE_URL fallback is intentionally disabled, so the integration tests will report the skip reason.'
    );
  } else {
    console.log(
      '[test:prisma] No PRISMA_INTEGRATION_DATABASE_URL or DATABASE_URL is configured. The integration tests will report the skip reason.'
    );
  }
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
