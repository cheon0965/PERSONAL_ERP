import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiEnv } from '../src/config/api-env';

function createBaseEnv(): Record<string, string> {
  return {
    PORT: '4000',
    APP_ORIGIN: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret-2',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    DATABASE_URL: 'mysql://test:test@localhost:3306/personal_erp_test',
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
