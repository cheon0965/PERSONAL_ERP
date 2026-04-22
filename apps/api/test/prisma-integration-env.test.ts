import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPrismaIntegrationMissingDatabaseMessage,
  getPrismaIntegrationUnreachableMessage,
  resolvePrismaIntegrationDatabaseEnv,
  shouldRequireDedicatedPrismaIntegrationDatabaseUrl
} from './prisma-integration-env';

test('resolvePrismaIntegrationDatabaseEnv prefers the dedicated Prisma integration env key', () => {
  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      PRISMA_INTEGRATION_DATABASE_URL:
        'mysql://erp_user:secret-value@localhost:3306/personal_erp_prisma',
      DATABASE_URL: 'mysql://erp_user:other-secret@localhost:3306/personal_erp'
    }),
    {
      databaseUrl:
        'mysql://erp_user:secret-value@localhost:3306/personal_erp_prisma',
      sourceKey: 'PRISMA_INTEGRATION_DATABASE_URL',
      displayTarget: 'mysql://localhost:3306/personal_erp_prisma'
    }
  );
});

test('resolvePrismaIntegrationDatabaseEnv falls back to DATABASE_URL when the dedicated key is absent', () => {
  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      DATABASE_URL: 'mysql://erp_user:shared-secret@localhost:3306/personal_erp'
    }),
    {
      databaseUrl: 'mysql://erp_user:shared-secret@localhost:3306/personal_erp',
      sourceKey: 'DATABASE_URL',
      displayTarget: 'mysql://localhost:3306/personal_erp'
    }
  );
});

test('resolvePrismaIntegrationDatabaseEnv does not fall back to DATABASE_URL in CI', () => {
  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      CI: 'true',
      DATABASE_URL: 'mysql://erp_user:shared-secret@localhost:3306/personal_erp'
    }),
    {
      databaseUrl: null,
      sourceKey: null,
      displayTarget: null
    }
  );
});

test('getPrismaIntegrationMissingDatabaseMessage names both supported env keys', () => {
  assert.equal(
    getPrismaIntegrationMissingDatabaseMessage({}),
    'Skipping Prisma integration test because neither PRISMA_INTEGRATION_DATABASE_URL nor DATABASE_URL is configured. Run npm run test:prisma so the disposable MySQL database is provisioned automatically, or set PRISMA_INTEGRATION_DATABASE_MODE=existing with PRISMA_INTEGRATION_DATABASE_URL.'
  );
});

test('getPrismaIntegrationMissingDatabaseMessage requires the dedicated key in CI', () => {
  assert.equal(
    getPrismaIntegrationMissingDatabaseMessage({ CI: 'true' }),
    'Skipping Prisma integration test because the Prisma integration runner did not provide PRISMA_INTEGRATION_DATABASE_URL in CI. Run npm run test:prisma so the disposable MySQL database is provisioned automatically.'
  );
});

test('getPrismaIntegrationUnreachableMessage keeps the source key and redacts credentials', () => {
  const message = getPrismaIntegrationUnreachableMessage({
    databaseUrl:
      'mysql://erp_user:secret-value@localhost:3306/personal_erp_prisma',
    sourceKey: 'PRISMA_INTEGRATION_DATABASE_URL',
    displayTarget: 'mysql://localhost:3306/personal_erp_prisma'
  });

  assert.match(message, /PRISMA_INTEGRATION_DATABASE_URL/);
  assert.match(message, /mysql:\/\/localhost:3306\/personal_erp_prisma/);
  assert.doesNotMatch(message, /secret-value/);
});

test('shouldRequireDedicatedPrismaIntegrationDatabaseUrl only enables the CI guard for truthy CI values', () => {
  assert.equal(
    shouldRequireDedicatedPrismaIntegrationDatabaseUrl({ CI: 'true' }),
    true
  );
  assert.equal(
    shouldRequireDedicatedPrismaIntegrationDatabaseUrl({ CI: '1' }),
    true
  );
  assert.equal(
    shouldRequireDedicatedPrismaIntegrationDatabaseUrl({ CI: 'false' }),
    false
  );
  assert.equal(shouldRequireDedicatedPrismaIntegrationDatabaseUrl({}), false);
});
