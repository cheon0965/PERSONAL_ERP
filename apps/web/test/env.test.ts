import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000/api';
process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK = 'false';

test('readWebEnv defaults demo fallback to false when the flag is omitted', async () => {
  const { readWebEnv } = await import('../src/shared/config/env');
  const env = readWebEnv({
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api'
  } as unknown as NodeJS.ProcessEnv);

  assert.equal(env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK, false);
});

test('createWebRuntime enables demo fallback only outside production', async () => {
  const { createWebRuntime, readWebEnv } =
    await import('../src/shared/config/env');
  const env = readWebEnv({
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000/api',
    NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: 'true'
  } as unknown as NodeJS.ProcessEnv);

  assert.equal(
    createWebRuntime({ NODE_ENV: 'development' } as NodeJS.ProcessEnv, env)
      .demoFallbackEnabled,
    true
  );
  assert.equal(
    createWebRuntime({ NODE_ENV: 'production' } as NodeJS.ProcessEnv, env)
      .demoFallbackEnabled,
    false
  );
});

test('readBooleanFlag rejects invalid boolean strings', async () => {
  const { readBooleanFlag } = await import('../src/shared/config/env');
  assert.throws(
    () => readBooleanFlag('maybe', false),
    /NEXT_PUBLIC_ENABLE_DEMO_FALLBACK must be a boolean value/
  );
});
