#!/usr/bin/env node

const net = require('node:net');

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_MYSQL_PORT = '3306';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function readPositiveIntegerEnv(name, defaultValue) {
  const rawValue = process.env[name];
  if (!rawValue) {
    return defaultValue;
  }

  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : defaultValue;
}

function readTimeoutMs() {
  return readPositiveIntegerEnv(
    'PERSONAL_ERP_DB_CHECK_TIMEOUT_MS',
    DEFAULT_TIMEOUT_MS
  );
}

function readRetries() {
  return readPositiveIntegerEnv(
    'PERSONAL_ERP_DB_CHECK_RETRIES',
    DEFAULT_RETRIES
  );
}

function readRetryDelayMs() {
  return readPositiveIntegerEnv(
    'PERSONAL_ERP_DB_CHECK_RETRY_DELAY_MS',
    DEFAULT_RETRY_DELAY_MS
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseDatabaseUrl(rawValue) {
  if (!rawValue || rawValue.trim() === '') {
    throw new Error('DATABASE_URL is not set.');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  if (!parsedUrl.hostname) {
    throw new Error('DATABASE_URL must include a database host.');
  }

  return parsedUrl;
}

function getDatabasePort(databaseUrl) {
  return databaseUrl.port || DEFAULT_MYSQL_PORT;
}

function redactDatabaseUrl(databaseUrl) {
  const redactedUrl = new URL(databaseUrl.toString());

  if (redactedUrl.password) {
    redactedUrl.password = '***';
  }

  return redactedUrl.toString();
}

function checkTcpReachable(host, port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({
      host,
      port: Number(port)
    });

    const cleanup = () => {
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      cleanup();
      resolve();
    });
    socket.on('timeout', () => {
      cleanup();
      const error = new Error(
        `Timed out after ${timeoutMs}ms while connecting to ${host}:${port}.`
      );
      error.code = 'ETIMEDOUT';
      reject(error);
    });
    socket.on('error', (error) => {
      cleanup();
      reject(error);
    });
  });
}

function printFailureHints(databaseUrl, error) {
  const host = databaseUrl.hostname;
  const port = getDatabasePort(databaseUrl);
  const redactedUrl = redactDatabaseUrl(databaseUrl);
  const isLocalHost = LOCAL_HOSTS.has(host.toLowerCase());

  console.error(`[ERROR] Cannot reach DATABASE_URL endpoint: ${redactedUrl}`);
  console.error(
    `        ${error.code ? `${error.code}: ` : ''}${error.message}`
  );
  console.error('');
  console.error(
    '[HINT] The launcher checks the DB before migrations, backfill, seed, and API startup.'
  );

  if (isLocalHost) {
    console.error('       This DATABASE_URL points to local MySQL.');
    console.error('       Start the local Docker database with: npm run db:up');
    console.error('       Then retry: dev.bat');
  } else {
    console.error(
      `       This DATABASE_URL points to a remote DB at ${host}:${port}.`
    );
    console.error(
      '       Check that the DB server is running and reachable from this PC.'
    );
    console.error(
      '       If VPN/firewall/port-forwarding is required, connect it first.'
    );
    console.error('       For local development, switch DATABASE_URL to:');
    console.error(
      '       mysql://erp_user:local_erp_not_for_prod@localhost:3306/personal_erp'
    );
  }

  console.error('');
  console.error(
    '       If the DB schema/data are already prepared and you only want to skip setup:'
  );
  console.error(
    '       run-server.bat dev --skip-migrate --skip-backfill --skip-seed'
  );
}

async function main() {
  let databaseUrl;
  try {
    databaseUrl = parseDatabaseUrl(process.env.DATABASE_URL);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    console.error('[HINT] Add DATABASE_URL to the API env file, for example:');
    console.error(
      '       mysql://erp_user:local_erp_not_for_prod@localhost:3306/personal_erp'
    );
    process.exit(1);
  }

  const host = databaseUrl.hostname;
  const port = getDatabasePort(databaseUrl);
  const timeoutMs = readTimeoutMs();
  const retries = readRetries();
  const retryDelayMs = readRetryDelayMs();

  console.log(
    `[INFO] Checking database endpoint ${host}:${port} before server startup...`
  );

  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await checkTcpReachable(host, port, timeoutMs);
      console.log('[OK] Database endpoint is reachable.');
      return;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        console.log(
          `[INFO] Database endpoint is not reachable yet. Retrying ${attempt + 1}/${retries} in ${retryDelayMs}ms...`
        );
        await delay(retryDelayMs);
      }
    }
  }

  printFailureHints(databaseUrl, lastError);
  process.exit(1);
}

main().catch((error) => {
  console.error(`[ERROR] Database connectivity check failed: ${error.message}`);
  process.exit(1);
});
