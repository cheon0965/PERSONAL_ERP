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
