import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const boundaryTestFile = path.join(
  repoRoot,
  'apps/api/test/legacy-transaction-boundary.test.ts'
);

function listFiles(
  dir: string,
  options?: {
    includeFile?: (absolutePath: string) => boolean;
    skipDir?: (absolutePath: string) => boolean;
  }
): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (options?.skipDir?.(absolutePath)) {
        continue;
      }

      files.push(...listFiles(absolutePath, options));
      continue;
    }

    if (entry.isFile() && (options?.includeFile?.(absolutePath) ?? true)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function listTypeScriptFiles(dir: string): string[] {
  return listFiles(dir, {
    includeFile: (absolutePath) => absolutePath.endsWith('.ts')
  });
}

function toRepoRelativePath(file: string) {
  return path.relative(repoRoot, file).replaceAll('\\', '/');
}

test('legacy transaction Prisma delegate stays confined to explicit bridge code', () => {
  const files = [
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/src')),
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/prisma')),
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/test')).filter(
      (file) => file !== boundaryTestFile
    )
  ];
  const matches = files
    .filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /\bprisma\.(transaction|legacyTransaction)\b/.test(content);
    })
    .map(toRepoRelativePath)
    .sort();

  assert.deepEqual(matches, []);
});

test('active legacy transaction mentions are removed from current schema, active docs, and runtime-adjacent tests', () => {
  const files = [
    ...listFiles(path.join(repoRoot, 'apps/api/prisma'), {
      includeFile: (absolutePath) =>
        absolutePath.endsWith('.ts') || absolutePath.endsWith('.prisma'),
      skipDir: (absolutePath) => path.basename(absolutePath) === 'migrations'
    }),
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/test')).filter(
      (file) => file !== boundaryTestFile
    ),
    ...listFiles(path.join(repoRoot, 'docs'), {
      includeFile: (absolutePath) => absolutePath.endsWith('.md'),
      skipDir: (absolutePath) => path.basename(absolutePath) === 'completed'
    })
  ];
  const matches = files
    .filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /LegacyTransaction|legacyTransaction/.test(content);
    })
    .map(toRepoRelativePath)
    .sort();

  assert.deepEqual(matches, []);
});

test('phase1 backbone import surface stays confined to explicit seed, backfill, and integration bootstrap files', () => {
  const allowedFiles = [
    'apps/api/prisma/backfill-phase1-backbone.ts',
    'apps/api/prisma/seed.ts',
    'apps/api/test/collected-transactions.prisma.integration.test.ts',
    'apps/api/test/prisma-integration.test-support.ts'
  ].sort();
  const files = [
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/prisma')),
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/test'))
  ];
  const matches = files
    .filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /from ['"]\.\.?\/.*phase1-backbone['"]/.test(content);
    })
    .map(toRepoRelativePath)
    .sort();

  assert.deepEqual(matches, allowedFiles);
});

test('seed keeps legacy bridge access indirect through phase1 backbone only', () => {
  const seed = fs.readFileSync(
    path.join(repoRoot, 'apps/api/prisma/seed.ts'),
    'utf8'
  );

  assert.match(seed, /ensurePhase1BackboneForUser/);
  assert.doesNotMatch(seed, /\blegacy Transaction rows\b/);
  assert.doesNotMatch(seed, /\bprisma\.legacyTransaction\b/);
});

test('legacy transaction removal prep docs are kept in the completed docs folder after the physical removal lands', () => {
  const archivedPrepDoc = fs.readFileSync(
    path.join(repoRoot, 'docs/completed/LEGACY_TRANSACTION_REMOVAL_PREP.md'),
    'utf8'
  );
  const archivedChecklist = fs.readFileSync(
    path.join(
      repoRoot,
      'docs/completed/LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md'
    ),
    'utf8'
  );

  assert.match(archivedPrepDoc, /## 현재 인벤토리/);
  assert.match(archivedChecklist, /## 스키마 삭제 대상/);
});

test('schema no longer exposes the removed legacy transaction model or relations', () => {
  const schema = fs.readFileSync(
    path.join(repoRoot, 'apps/api/prisma/schema.prisma'),
    'utf8'
  );

  assert.doesNotMatch(schema, /\bmodel LegacyTransaction\b/);
  assert.doesNotMatch(schema, /\bmodel Transaction\s*\{/);
  assert.doesNotMatch(schema, /\blegacyTransactions\s+/);
  assert.doesNotMatch(schema, /\bTransactionOrigin\b/);
  assert.doesNotMatch(schema, /\bTransactionStatus\b/);
});
