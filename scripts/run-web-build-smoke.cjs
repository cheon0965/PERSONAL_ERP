#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const webAppRoot = path.join(repoRoot, 'apps', 'web');
const host = '127.0.0.1';
const port = 3100;
const baseUrl = `http://${host}:${port}`;
const readinessUrl = `${baseUrl}/api/health`;
const buildTimeoutMs = 5 * 60 * 1000;
const readinessTimeoutMs = 90 * 1000;

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false,
      ...options
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `[run-web-build-smoke] Process exited with code ${code}: ${command} ${args.join(' ')}`
        )
      );
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForChildExit(child, timeoutMs) {
  return Promise.race([
    new Promise((resolve) => {
      child.once('exit', () => resolve());
    }),
    delay(timeoutMs)
  ]);
}

async function terminateProcessTree(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn(
        'taskkill',
        ['/pid', String(child.pid), '/T', '/F'],
        {
          cwd: repoRoot,
          env: process.env,
          stdio: 'ignore',
          shell: false
        }
      );

      killer.on('error', () => resolve());
      killer.on('exit', () => resolve());
    });
    return;
  }

  child.kill('SIGTERM');
  await waitForChildExit(child, 2_000);

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForChildExit(child, 2_000);
  }
}

async function waitForHealth(url, timeoutMs) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.status === 'ok') {
          return;
        }

        lastError = new Error(
          `[run-web-build-smoke] Unexpected health payload: ${JSON.stringify(payload)}`
        );
      } else {
        lastError = new Error(
          `[run-web-build-smoke] Health probe returned ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      lastError = error;
    }

    await delay(1_000);
  }

  throw new Error(
    `[run-web-build-smoke] Timed out waiting for ${url}. ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

async function assertResponse(url, assertion) {
  const response = await fetch(url, { redirect: 'manual' });
  const body = await response.text();
  await assertion(response, body);
}

async function main() {
  await runProcess(process.execPath, [
    path.join(repoRoot, 'scripts', 'run-with-root-env.cjs'),
    process.execPath,
    path.join(repoRoot, 'scripts', 'build-web-inproc.cjs')
  ]);

  const server = spawn(
    process.execPath,
    [
      path.join(repoRoot, 'scripts', 'run-with-root-env.cjs'),
      process.execPath,
      path.join(repoRoot, 'scripts', 'start-web-prod-inproc.cjs'),
      '--port',
      String(port),
      '--hostname',
      host
    ],
    {
      cwd: webAppRoot,
      env: process.env,
      stdio: 'inherit',
      shell: false
    }
  );

  server.on('error', (error) => {
    console.error('[run-web-build-smoke] Failed to start production server.');
    console.error(error);
  });

  const cleanup = async () => {
    await terminateProcessTree(server);
  };

  process.on('exit', () => {
    if (server.exitCode === null) {
      server.kill();
    }
  });
  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(143);
  });

  const serverExitPromise = new Promise((_, reject) => {
    server.on('exit', (code, signal) => {
      reject(
        new Error(
          `[run-web-build-smoke] Production server exited before smoke checks completed (code=${code}, signal=${signal}).`
        )
      );
    });
  });

  try {
    await Promise.race([
      waitForHealth(readinessUrl, readinessTimeoutMs),
      serverExitPromise
    ]);

    await assertResponse(`${baseUrl}/`, (response) => {
      const location = response.headers.get('location') ?? '';
      if (
        (response.status === 307 || response.status === 308) &&
        location.includes('/login')
      ) {
        return;
      }

      throw new Error(
        `[run-web-build-smoke] Expected / to redirect to /login but received ${response.status} with location "${location}".`
      );
    });

    await assertResponse(`${baseUrl}/login`, (response) => {
      if (response.status !== 200) {
        throw new Error(
          `[run-web-build-smoke] Expected /login to return 200 but received ${response.status}.`
        );
      }
    });

    await assertResponse(`${baseUrl}/transactions`, (response) => {
      if (response.status !== 200) {
        throw new Error(
          `[run-web-build-smoke] Expected /transactions to return 200 but received ${response.status}.`
        );
      }
    });
  } finally {
    await cleanup();
    await serverExitPromise.catch(() => undefined);
  }
}

Promise.race([
  main(),
  delay(buildTimeoutMs).then(() => {
    throw new Error(
      '[run-web-build-smoke] Timed out waiting for the smoke script to finish.'
    );
  })
]).catch((error) => {
  console.error(error);
  process.exit(1);
});
