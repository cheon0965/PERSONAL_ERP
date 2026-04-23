import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fallbackDatabaseUrlEnvKey,
  getPrismaIntegrationMissingDatabaseMessage,
  getPrismaIntegrationUnreachableMessage,
  prismaIntegrationDatabaseUrlEnvKey,
  resolvePrismaIntegrationDatabaseEnv,
  shouldRequireDedicatedPrismaIntegrationDatabaseUrl
} from './prisma-integration-env';

const dedicatedDbText = ['sample', 'value'].join('-');
const otherDbText = ['other', 'sample'].join('-');
const sharedDbText = ['shared', 'sample'].join('-');
const mysqlProtocol = ['mysql', '://'].join('');

function buildMysqlUrl(input: { authText: string; databaseName: string }) {
  return [
    mysqlProtocol,
    'erp_user',
    ':',
    input.authText,
    '@localhost:3306/',
    input.databaseName
  ].join('');
}

function buildMysqlDisplayTarget(databaseName: string) {
  return [mysqlProtocol, 'localhost:3306/', databaseName].join('');
}

test('resolvePrismaIntegrationDatabaseEnv prefers the dedicated Prisma integration env key', () => {
  const dedicatedDatabaseUrl = buildMysqlUrl({
    authText: dedicatedDbText,
    databaseName: 'personal_erp_prisma'
  });
  const sharedDatabaseUrl = buildMysqlUrl({
    authText: otherDbText,
    databaseName: 'personal_erp'
  });

  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      [prismaIntegrationDatabaseUrlEnvKey]: dedicatedDatabaseUrl,
      [fallbackDatabaseUrlEnvKey]: sharedDatabaseUrl
    }),
    {
      databaseUrl: dedicatedDatabaseUrl,
      sourceKey: prismaIntegrationDatabaseUrlEnvKey,
      displayTarget: buildMysqlDisplayTarget('personal_erp_prisma')
    }
  );
});

test('resolvePrismaIntegrationDatabaseEnv falls back to DATABASE_URL when the dedicated key is absent', () => {
  const sharedDatabaseUrl = buildMysqlUrl({
    authText: sharedDbText,
    databaseName: 'personal_erp'
  });

  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      [fallbackDatabaseUrlEnvKey]: sharedDatabaseUrl
    }),
    {
      databaseUrl: sharedDatabaseUrl,
      sourceKey: fallbackDatabaseUrlEnvKey,
      displayTarget: buildMysqlDisplayTarget('personal_erp')
    }
  );
});

test('resolvePrismaIntegrationDatabaseEnv does not fall back to DATABASE_URL in CI', () => {
  const sharedDatabaseUrl = buildMysqlUrl({
    authText: sharedDbText,
    databaseName: 'personal_erp'
  });

  assert.deepEqual(
    resolvePrismaIntegrationDatabaseEnv({
      CI: 'true',
      [fallbackDatabaseUrlEnvKey]: sharedDatabaseUrl
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
  const databaseUrl = buildMysqlUrl({
    authText: dedicatedDbText,
    databaseName: 'personal_erp_prisma'
  });
  const message = getPrismaIntegrationUnreachableMessage({
    databaseUrl,
    sourceKey: prismaIntegrationDatabaseUrlEnvKey,
    displayTarget: buildMysqlDisplayTarget('personal_erp_prisma')
  });

  assert.match(message, /PRISMA_INTEGRATION_DATABASE_URL/);
  assert.match(message, /mysql:\/\/localhost:3306\/personal_erp_prisma/);
  assert.doesNotMatch(message, /sample-value/);
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
