#!/usr/bin/env node

const fs = require('node:fs');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const dockerCommand = 'docker';
const defaultDockerImage = 'mysql:8.4';
const defaultDatabaseName = 'personal_erp_prisma_test';
const defaultDatabaseUser = 'erp_prisma';

class CommandError extends Error {
  constructor(label, status) {
    super(`${label} failed with exit code ${status}.`);
    this.exitCode = status;
  }
}

main().catch((error) => {
  if (error instanceof CommandError) {
    console.error(`[test:prisma] ${error.message}`);
    process.exit(error.exitCode);
  }

  console.error(
    `[test:prisma] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});

async function main() {
  const databaseMode = resolveDatabaseMode();

  if (databaseMode === 'existing') {
    const resolvedDatabaseUrl = resolveExistingDatabaseUrl();

    if (!resolvedDatabaseUrl.value) {
      throw new Error(
        'PRISMA_INTEGRATION_DATABASE_MODE=existing requires PRISMA_INTEGRATION_DATABASE_URL. Outside CI, DATABASE_URL is also accepted.'
      );
    }

    const targetSuffix = resolvedDatabaseUrl.displayTarget
      ? ` (${resolvedDatabaseUrl.displayTarget})`
      : '';

    console.log(
      `[test:prisma] Using existing database from ${resolvedDatabaseUrl.sourceKey}${targetSuffix}.`
    );
    await runPrismaIntegrationSuite(resolvedDatabaseUrl.value);
    return;
  }

  await runWithDisposableMysql();
}

async function runWithDisposableMysql() {
  assertDockerIsAvailable();

  const containerName = createContainerName();
  const hostPort = await findAvailablePort();
  const rootPassword = createDisposablePassword('root');
  const databasePassword = createDisposablePassword('erp');
  const databaseUrl = buildMysqlUrl({
    user: defaultDatabaseUser,
    password: databasePassword,
    host: '127.0.0.1',
    port: hostPort,
    databaseName: defaultDatabaseName
  });

  try {
    startDisposableMysqlContainer({
      containerName,
      hostPort,
      rootPassword,
      databasePassword
    });
    await waitForDisposableMysql({ containerName, rootPassword });
    console.log(
      `[test:prisma] Disposable MySQL is ready at ${summarizeDatabaseUrl(databaseUrl)}.`
    );
    await runPrismaIntegrationSuite(databaseUrl);
  } finally {
    stopDisposableMysqlContainer(containerName);
  }
}

async function runPrismaIntegrationSuite(databaseUrl) {
  const env = createSuiteEnv(databaseUrl);

  console.log('[test:prisma] Generating Prisma Client.');
  runPrisma(['generate'], env);

  console.log('[test:prisma] Applying Prisma migrations.');
  runPrisma(['migrate', 'deploy'], env);

  await seedMinimalFixture(databaseUrl);

  console.log(
    '[test:prisma] Scenario fixtures are seeded by each UUID-scoped integration test.'
  );
  runNpm(['run', 'clean:test-dist'], env);
  runNpm(['run', 'compile:test'], env);

  const prismaIntegrationTests = fs
    .readdirSync(path.join(apiRoot, '.test-dist', 'apps', 'api', 'test'))
    .filter((fileName) => fileName.endsWith('.prisma.integration.test.js'))
    .sort()
    .map((fileName) =>
      path.posix.join('.test-dist', 'apps', 'api', 'test', fileName)
    );

  if (prismaIntegrationTests.length === 0) {
    throw new Error('No Prisma integration test files were found.');
  }

  run(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      '--test-isolation=none',
      ...prismaIntegrationTests
    ],
    {
      env,
      label: 'node --test Prisma integration'
    }
  );
}

async function seedMinimalFixture(databaseUrl) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
  const email = `prisma-runner-fixture-${randomUUID()}@example.com`;
  let created = false;

  console.log('[test:prisma] Seeding minimal writable fixture.');

  try {
    await prisma.user.create({
      data: {
        email,
        name: 'Prisma Runner Fixture',
        passwordHash: 'prisma-runner-fixture-password-hash',
        emailVerifiedAt: new Date()
      }
    });
    created = true;
  } finally {
    if (created) {
      await prisma.user.deleteMany({
        where: {
          email
        }
      });
    }

    await prisma.$disconnect();
  }
}

function resolveDatabaseMode() {
  const explicitArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--database-mode='));
  const rawMode =
    explicitArg?.split('=')[1] ??
    (process.argv.includes('--use-existing-db')
      ? 'existing'
      : process.env.PRISMA_INTEGRATION_DATABASE_MODE);
  const normalizedMode = rawMode?.trim().toLowerCase();

  if (!normalizedMode || normalizedMode === 'docker') {
    return 'docker';
  }

  if (normalizedMode === 'disposable') {
    return 'docker';
  }

  if (normalizedMode === 'existing' || normalizedMode === 'external') {
    return 'existing';
  }

  throw new Error(
    `Unsupported PRISMA_INTEGRATION_DATABASE_MODE value: ${rawMode}`
  );
}

function createSuiteEnv(databaseUrl) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PRISMA_INTEGRATION_DATABASE_URL: databaseUrl,
    RUN_PRISMA_INTEGRATION: '1'
  };
}

function runNpm(args, env) {
  run(npmCommand, args, {
    env,
    label: `npm ${args.join(' ')}`
  });
}

function runPrisma(args, env) {
  run(resolveCommand('prisma'), args, {
    env,
    label: `prisma ${args.join(' ')}`
  });
}

function run(command, args, options = {}) {
  const isWindowsCmd =
    process.platform === 'win32' && command.toLowerCase().endsWith('.cmd');
  const result = spawnSync(
    isWindowsCmd ? 'cmd.exe' : command,
    isWindowsCmd ? ['/d', '/s', '/c', command, ...args] : args,
    {
      stdio: options.stdio ?? 'inherit',
      cwd: options.cwd ?? apiRoot,
      env: options.env ?? process.env,
      encoding: options.encoding,
      shell: false
    }
  );

  if (result.error) {
    throw new Error(
      `${options.label ?? command} failed to start: ${result.error.message}`
    );
  }

  if ((result.status ?? 1) !== 0) {
    throw new CommandError(options.label ?? command, result.status ?? 1);
  }

  return result;
}

function runDocker(args, options = {}) {
  return spawnSync(dockerCommand, args, {
    stdio: options.stdio ?? 'inherit',
    cwd: repoRoot,
    env: options.env ?? process.env,
    encoding: options.encoding,
    shell: false
  });
}

function assertDockerIsAvailable() {
  const result = runDocker(['version', '--format', '{{.Server.Version}}'], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if ((result.status ?? 1) !== 0) {
    throw new Error(
      'Docker is required for the default disposable Prisma integration database. Start Docker, or set PRISMA_INTEGRATION_DATABASE_MODE=existing with PRISMA_INTEGRATION_DATABASE_URL.'
    );
  }

  const version = result.stdout?.toString().trim();
  if (version) {
    console.log(`[test:prisma] Docker server ${version} detected.`);
  }
}

function startDisposableMysqlContainer({
  containerName,
  hostPort,
  rootPassword,
  databasePassword
}) {
  const dockerImage =
    process.env.PRISMA_INTEGRATION_DOCKER_IMAGE?.trim() || defaultDockerImage;

  console.log(
    `[test:prisma] Starting disposable MySQL container ${containerName} from ${dockerImage}.`
  );

  const result = runDocker([
    'run',
    '--detach',
    '--name',
    containerName,
    '--env',
    `MYSQL_ROOT_PASSWORD=${rootPassword}`,
    '--env',
    `MYSQL_DATABASE=${defaultDatabaseName}`,
    '--env',
    `MYSQL_USER=${defaultDatabaseUser}`,
    '--env',
    `MYSQL_PASSWORD=${databasePassword}`,
    '--env',
    'TZ=Asia/Seoul',
    '--publish',
    `127.0.0.1:${hostPort}:3306`,
    dockerImage,
    '--character-set-server=utf8mb4',
    '--collation-server=utf8mb4_0900_ai_ci'
  ]);

  if ((result.status ?? 1) !== 0) {
    throw new CommandError('docker run MySQL', result.status ?? 1);
  }
}

async function waitForDisposableMysql({ containerName, rootPassword }) {
  const startedAt = Date.now();
  const timeoutMs = readPositiveIntegerEnv(
    'PRISMA_INTEGRATION_DOCKER_STARTUP_TIMEOUT_MS',
    90_000
  );

  while (Date.now() - startedAt < timeoutMs) {
    const result = runDocker(
      [
        'exec',
        containerName,
        'mysqladmin',
        'ping',
        '-h127.0.0.1',
        '-uroot',
        `-p${rootPassword}`,
        '--silent'
      ],
      {
        stdio: 'pipe',
        encoding: 'utf8'
      }
    );

    if ((result.status ?? 1) === 0) {
      return;
    }

    await sleep(1000);
  }

  printDockerLogs(containerName);
  throw new Error(
    `Disposable MySQL did not become ready within ${timeoutMs}ms.`
  );
}

function stopDisposableMysqlContainer(containerName) {
  if (process.env.PRISMA_INTEGRATION_KEEP_DOCKER === '1') {
    console.log(
      `[test:prisma] Keeping disposable MySQL container for debugging: ${containerName}`
    );
    return;
  }

  const result = runDocker(['rm', '-f', containerName], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if ((result.status ?? 1) === 0) {
    console.log(`[test:prisma] Removed disposable MySQL container.`);
    return;
  }

  console.error(
    `[test:prisma] Failed to remove disposable MySQL container ${containerName}.`
  );
}

function printDockerLogs(containerName) {
  const result = runDocker(['logs', '--tail', '80', containerName], {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .map((value) => value.toString().trim())
    .filter(Boolean)
    .join('\n');

  if (output) {
    console.error(output);
  }
}

function resolveCommand(commandName) {
  if (
    path.isAbsolute(commandName) ||
    commandName.includes('/') ||
    commandName.includes('\\') ||
    path.extname(commandName)
  ) {
    return commandName;
  }

  const extension = process.platform === 'win32' ? '.cmd' : '';
  const localBinPath = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    `${commandName}${extension}`
  );

  if (fs.existsSync(localBinPath)) {
    return localBinPath;
  }

  return process.platform === 'win32' ? `${commandName}.cmd` : commandName;
}

function resolveExistingDatabaseUrl() {
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

function createContainerName() {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
  return `personal-erp-prisma-${process.pid}-${suffix}`.toLowerCase();
}

function createDisposablePassword(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

function buildMysqlUrl({ user, password, host, port, databaseName }) {
  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${databaseName}`;
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();

      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a TCP port.')));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

function readPositiveIntegerEnv(key, fallbackValue) {
  const value = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallbackValue;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
