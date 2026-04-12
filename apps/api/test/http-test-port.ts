import type { INestApplication } from '@nestjs/common';

const SAFE_PORT_MIN = 30_000;
const SAFE_PORT_MAX = 59_999;
const MAX_LISTEN_ATTEMPTS = 20;

function pickSafePort() {
  return (
    Math.floor(Math.random() * (SAFE_PORT_MAX - SAFE_PORT_MIN + 1)) +
    SAFE_PORT_MIN
  );
}

function isRetryableListenError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  return (
    error.code === 'EADDRINUSE' ||
    error.code === 'EACCES' ||
    error.code === 'ERR_SERVER_ALREADY_LISTEN'
  );
}

export async function listenOnSafeTestPort(
  app: INestApplication
): Promise<number> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_LISTEN_ATTEMPTS; attempt += 1) {
    const port = pickSafePort();

    try {
      await app.listen(port, '127.0.0.1');
      return port;
    } catch (error) {
      lastError = error;

      if (isRetryableListenError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not bind the test app to a safe localhost port after ${MAX_LISTEN_ATTEMPTS} attempts.${lastError instanceof Error ? ` Last error: ${lastError.message}` : ''}`
  );
}
