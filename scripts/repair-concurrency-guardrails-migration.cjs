#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const mysql = require('mysql2/promise');

const repoRoot = path.resolve(__dirname, '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');
const migrationName = '20260412173000_concurrency_idempotency_guardrails';
const insurancePolicyIndexName = 'InsurancePolicy_ledger_normprov_normprod_key';
const vehicleIndexName = 'Vehicle_ledgerId_normalizedName_key';
const databaseUrl = process.env.DATABASE_URL;

main().catch((error) => {
  console.error('[repair-concurrency-guardrails] Repair failed.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  let shouldResolveAsApplied = false;
  const connection = await mysql.createConnection(databaseUrl);

  try {
    const migrationState = await readMigrationState(connection);

    if (!migrationState) {
      throw new Error(
        [
          `Migration "${migrationName}" was not found in _prisma_migrations.`,
          'Run `npm run db:status` to inspect the current migration history.'
        ].join(' ')
      );
    }

    if (migrationState.finishedAt && !migrationState.rolledBackAt) {
      console.log(
        `[repair-concurrency-guardrails] Migration "${migrationName}" is already marked as applied.`
      );
    } else {
      if (migrationState.rolledBackAt) {
        throw new Error(
          [
            `Migration "${migrationName}" is already marked rolled back.`,
            'Run `npm run db:deploy` to re-apply the fixed migration history.'
          ].join(' ')
        );
      }

      shouldResolveAsApplied = true;
      await assertNoDuplicateNormalizedKeys(connection);
      await repairInsurancePolicy(connection);
      await repairVehicle(connection);
    }
  } finally {
    await connection.end();
  }

  if (shouldResolveAsApplied) {
    runPrisma(['migrate', 'resolve', '--applied', migrationName], {
      stdio: 'inherit'
    });
  }
  runPrisma(['migrate', 'deploy'], {
    stdio: 'inherit'
  });
}

async function readMigrationState(connection) {
  const [rows] = await connection.query(
    `
      SELECT
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        logs
      FROM _prisma_migrations
      WHERE migration_name = ?
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [migrationName]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];

  return {
    name: row.migration_name,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    rolledBackAt: row.rolled_back_at,
    logs: typeof row.logs === 'string' ? row.logs : ''
  };
}

async function assertNoDuplicateNormalizedKeys(connection) {
  const duplicateChecks = [
    {
      label: 'InsurancePolicy',
      sql: `
        SELECT
          ledgerId,
          LOWER(TRIM(provider)) AS normalizedProvider,
          LOWER(TRIM(productName)) AS normalizedProductName,
          COUNT(*) AS duplicateCount
        FROM InsurancePolicy
        GROUP BY
          ledgerId,
          LOWER(TRIM(provider)),
          LOWER(TRIM(productName))
        HAVING COUNT(*) > 1
      `
    },
    {
      label: 'Vehicle',
      sql: `
        SELECT
          ledgerId,
          LOWER(TRIM(name)) AS normalizedName,
          COUNT(*) AS duplicateCount
        FROM Vehicle
        GROUP BY
          ledgerId,
          LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      `
    }
  ];

  for (const check of duplicateChecks) {
    const [rows] = await connection.query(check.sql);

    if (rows.length > 0) {
      const sample = JSON.stringify(rows.slice(0, 5), null, 2);
      throw new Error(
        [
          `${check.label} contains duplicate normalized keys, so the unique index cannot be created safely.`,
          'Resolve the duplicates first and then re-run this repair script.',
          `Sample rows: ${sample}`
        ].join(' ')
      );
    }
  }
}

async function repairInsurancePolicy(connection) {
  const hasNormalizedProvider = await hasColumn(
    connection,
    'InsurancePolicy',
    'normalizedProvider'
  );
  const hasNormalizedProductName = await hasColumn(
    connection,
    'InsurancePolicy',
    'normalizedProductName'
  );

  if (!hasNormalizedProvider) {
    await executeStatement(
      connection,
      'Adding InsurancePolicy.normalizedProvider column',
      `
        ALTER TABLE \`InsurancePolicy\`
          ADD COLUMN \`normalizedProvider\` VARCHAR(191) NOT NULL DEFAULT ''
      `
    );
  }

  if (!hasNormalizedProductName) {
    await executeStatement(
      connection,
      'Adding InsurancePolicy.normalizedProductName column',
      `
        ALTER TABLE \`InsurancePolicy\`
          ADD COLUMN \`normalizedProductName\` VARCHAR(191) NOT NULL DEFAULT ''
      `
    );
  }

  await executeStatement(
    connection,
    'Backfilling InsurancePolicy normalized values',
    `
      UPDATE \`InsurancePolicy\`
      SET
        \`normalizedProvider\` = LOWER(TRIM(\`provider\`)),
        \`normalizedProductName\` = LOWER(TRIM(\`productName\`))
    `
  );

  if (
    !(await hasIndex(connection, 'InsurancePolicy', insurancePolicyIndexName))
  ) {
    await executeStatement(
      connection,
      `Creating ${insurancePolicyIndexName}`,
      `
        CREATE UNIQUE INDEX \`${insurancePolicyIndexName}\`
          ON \`InsurancePolicy\`(
            \`ledgerId\`,
            \`normalizedProvider\`,
            \`normalizedProductName\`
          )
      `
    );
  }
}

async function repairVehicle(connection) {
  if (!(await hasColumn(connection, 'Vehicle', 'normalizedName'))) {
    await executeStatement(
      connection,
      'Adding Vehicle.normalizedName column',
      `
        ALTER TABLE \`Vehicle\`
          ADD COLUMN \`normalizedName\` VARCHAR(191) NOT NULL DEFAULT ''
      `
    );
  }

  await executeStatement(
    connection,
    'Backfilling Vehicle.normalizedName',
    `
      UPDATE \`Vehicle\`
      SET \`normalizedName\` = LOWER(TRIM(\`name\`))
    `
  );

  if (!(await hasIndex(connection, 'Vehicle', vehicleIndexName))) {
    await executeStatement(
      connection,
      `Creating ${vehicleIndexName}`,
      `
        CREATE UNIQUE INDEX \`${vehicleIndexName}\`
          ON \`Vehicle\`(\`ledgerId\`, \`normalizedName\`)
      `
    );
  }
}

async function hasColumn(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function hasIndex(connection, tableName, indexName) {
  const [rows] = await connection.query(
    `
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
      LIMIT 1
    `,
    [tableName, indexName]
  );

  return rows.length > 0;
}

async function executeStatement(connection, label, sql) {
  console.log(`[repair-concurrency-guardrails] ${label}`);
  await connection.query(sql);
}

function runPrisma(args, options) {
  const resolvedPrismaCommand = resolvePrismaCommand();
  const isWindowsCmd =
    process.platform === 'win32' && resolvedPrismaCommand.endsWith('.cmd');
  const result = spawnSync(
    isWindowsCmd ? 'cmd.exe' : resolvedPrismaCommand,
    isWindowsCmd ? ['/c', resolvedPrismaCommand, ...args] : args,
    {
      cwd: apiRoot,
      env: process.env,
      ...options
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr =
      typeof result.stderr === 'string' ? result.stderr.trim() : '';
    throw new Error(
      stderr || `Prisma command failed: prisma ${args.join(' ')}`
    );
  }

  return result;
}

function resolvePrismaCommand() {
  const extension = process.platform === 'win32' ? '.cmd' : '';
  const localBin = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    `prisma${extension}`
  );

  return fs.existsSync(localBin) ? localBin : 'prisma';
}
