export const prismaIntegrationDatabaseUrlEnvKey =
  'PRISMA_INTEGRATION_DATABASE_URL' as const;
export const fallbackDatabaseUrlEnvKey = 'DATABASE_URL' as const;

export const shouldRunPrismaIntegration =
  process.env.RUN_PRISMA_INTEGRATION === '1';

export type PrismaIntegrationDatabaseSourceKey =
  | typeof prismaIntegrationDatabaseUrlEnvKey
  | typeof fallbackDatabaseUrlEnvKey;

export type ResolvedPrismaIntegrationDatabaseEnv = {
  databaseUrl: string | null;
  sourceKey: PrismaIntegrationDatabaseSourceKey | null;
  displayTarget: string | null;
};

export function resolvePrismaIntegrationDatabaseEnv(
  env: NodeJS.ProcessEnv = process.env
): ResolvedPrismaIntegrationDatabaseEnv {
  const dedicatedDatabaseUrl = readTrimmedEnvValue(
    env,
    prismaIntegrationDatabaseUrlEnvKey
  );

  if (dedicatedDatabaseUrl) {
    return {
      databaseUrl: dedicatedDatabaseUrl,
      sourceKey: prismaIntegrationDatabaseUrlEnvKey,
      displayTarget: summarizeDatabaseUrl(dedicatedDatabaseUrl)
    };
  }

  if (shouldRequireDedicatedPrismaIntegrationDatabaseUrl(env)) {
    return {
      databaseUrl: null,
      sourceKey: null,
      displayTarget: null
    };
  }

  const fallbackDatabaseUrl = readTrimmedEnvValue(
    env,
    fallbackDatabaseUrlEnvKey
  );

  if (fallbackDatabaseUrl) {
    return {
      databaseUrl: fallbackDatabaseUrl,
      sourceKey: fallbackDatabaseUrlEnvKey,
      displayTarget: summarizeDatabaseUrl(fallbackDatabaseUrl)
    };
  }

  return {
    databaseUrl: null,
    sourceKey: null,
    displayTarget: null
  };
}

export function getPrismaIntegrationMissingDatabaseMessage(
  env: NodeJS.ProcessEnv = process.env
) {
  if (shouldRequireDedicatedPrismaIntegrationDatabaseUrl(env)) {
    return `Skipping Prisma integration test because the Prisma integration runner did not provide ${prismaIntegrationDatabaseUrlEnvKey} in CI. Run npm run test:prisma so the disposable MySQL database is provisioned automatically.`;
  }

  return `Skipping Prisma integration test because neither ${prismaIntegrationDatabaseUrlEnvKey} nor ${fallbackDatabaseUrlEnvKey} is configured. Run npm run test:prisma so the disposable MySQL database is provisioned automatically, or set PRISMA_INTEGRATION_DATABASE_MODE=existing with ${prismaIntegrationDatabaseUrlEnvKey}.`;
}

export function getPrismaIntegrationUnreachableMessage(
  resolvedDatabaseEnv: ResolvedPrismaIntegrationDatabaseEnv,
  env: NodeJS.ProcessEnv = process.env
) {
  const targetSuffix = resolvedDatabaseEnv.displayTarget
    ? ` (${resolvedDatabaseEnv.displayTarget})`
    : '';

  if (!resolvedDatabaseEnv.sourceKey) {
    return getPrismaIntegrationMissingDatabaseMessage(env);
  }

  return `Skipping Prisma integration test because ${resolvedDatabaseEnv.sourceKey}${targetSuffix} is not reachable from this environment.`;
}

export function shouldRequireDedicatedPrismaIntegrationDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  const ciValue = env.CI;

  if (typeof ciValue !== 'string') {
    return false;
  }

  const normalizedValue = ciValue.trim().toLowerCase();
  return normalizedValue === '1' || normalizedValue === 'true';
}

function readTrimmedEnvValue(
  env: NodeJS.ProcessEnv,
  key: string
): string | null {
  const rawValue = env[key];

  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue ? trimmedValue : null;
}

function summarizeDatabaseUrl(databaseUrl: string): string | null {
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
