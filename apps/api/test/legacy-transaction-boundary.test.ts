import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(process.cwd(), '..', '..');

function listTypeScriptFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.ts')) {
      files.push(absolutePath);
    }
  }

  return files;
}

test('legacy transaction Prisma delegate stays confined to explicit bridge code', () => {
  const allowedFiles = new Set(['apps/api/prisma/phase1-backbone.ts']);
  const files = [
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/src')),
    ...listTypeScriptFiles(path.join(repoRoot, 'apps/api/prisma'))
  ];
  const matches = files
    .filter((file) => {
      const content = fs.readFileSync(file, 'utf8');
      return /\bprisma\.(transaction|legacyTransaction)\b/.test(content);
    })
    .map((file) => path.relative(repoRoot, file).replaceAll('\\', '/'))
    .sort();

  assert.deepEqual(matches, [...allowedFiles].sort());
});

test('schema exposes the legacy table explicitly as LegacyTransaction', () => {
  const schema = fs.readFileSync(
    path.join(repoRoot, 'apps/api/prisma/schema.prisma'),
    'utf8'
  );

  assert.match(schema, /\bmodel LegacyTransaction\b/);
  assert.match(schema, /@@map\("Transaction"\)/);
  assert.doesNotMatch(schema, /\bmodel Transaction\s*\{/);
  assert.match(schema, /legacyTransactions\s+LegacyTransaction\[\]/);
});
