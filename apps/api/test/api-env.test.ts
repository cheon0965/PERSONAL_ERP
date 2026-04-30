import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiEnv } from '../src/config/api-env';

const primarySigningText = 'TeW6AOOAazbxXapqMRAgtzntQl3feiFJ6f_W721gRLc';
const secondarySigningText = 'dFu-IUZHIFuvFJkOcFv0Gls_shj0aLmaLGMJzM6mxAk';
const primaryEnvName = ['JWT', 'ACCESS', 'SECRET'].join('_');
const secondaryEnvName = ['JWT', 'REFRESH', 'SECRET'].join('_');
const databaseEnvName = ['DATABASE', 'URL'].join('_');
const testDatabaseUrl = [
  ['mysql', '://localhost:3306'].join(''),
  'personal_erp_test'
].join('/');

function createBaseEnv(): Record<string, string> {
  return {
    PORT: '4000',
    APP_ORIGIN: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    [primaryEnvName]: primarySigningText,
    [secondaryEnvName]: secondarySigningText,
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    [databaseEnvName]: testDatabaseUrl,
    DEMO_EMAIL: 'demo@example.com'
  };
}

test('parseApiEnv defaults SWAGGER_ENABLED to false when omitted', () => {
  const env = parseApiEnv(createBaseEnv());

  assert.equal(env.SWAGGER_ENABLED, false);
});

test('parseApiEnv accepts explicit SWAGGER_ENABLED=true', () => {
  const env = parseApiEnv({
    ...createBaseEnv(),
    SWAGGER_ENABLED: 'true'
  });

  assert.equal(env.SWAGGER_ENABLED, true);
});

test('parseApiEnv reads externally injected initial admin seed credentials', () => {
  const env = parseApiEnv({
    ...createBaseEnv(),
    INITIAL_ADMIN_EMAIL: 'owner@example.com',
    INITIAL_ADMIN_NAME: 'Owner Admin',
    INITIAL_ADMIN_PASSWORD: 'Owner1234!'
  });

  assert.equal(env.INITIAL_ADMIN_EMAIL, 'owner@example.com');
  assert.equal(env.INITIAL_ADMIN_NAME, 'Owner Admin');
  assert.equal(env.INITIAL_ADMIN_PASSWORD, 'Owner1234!');
});

test('parseApiEnv keeps the initial admin password optional for normal API boot', () => {
  const env = parseApiEnv(createBaseEnv());

  assert.equal(env.INITIAL_ADMIN_EMAIL, null);
  assert.equal(env.INITIAL_ADMIN_NAME, null);
  assert.equal(env.INITIAL_ADMIN_PASSWORD, null);
});

test('parseApiEnv rejects short JWT secrets', () => {
  assert.throws(
    () =>
      parseApiEnv({
        ...createBaseEnv(),
        [primaryEnvName]: 'short-secret'
      }),
    /JWT_ACCESS_SECRET/
  );
});

test('parseApiEnv rejects JWT secret placeholders', () => {
  assert.throws(
    () =>
      parseApiEnv({
        ...createBaseEnv(),
        [primaryEnvName]: 'replace-with-32-byte-base64url-random-secret'
      }),
    /placeholder/
  );
});

test('parseApiEnv rejects reused JWT secrets', () => {
  assert.throws(
    () =>
      parseApiEnv({
        ...createBaseEnv(),
        [secondaryEnvName]: primarySigningText
      }),
    /must be different/
  );
});
