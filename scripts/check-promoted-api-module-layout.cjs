#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const apiRoot = path.join(repoRoot, 'apps', 'api');
const apiSourceRoot = path.join(repoRoot, 'apps', 'api', 'src');
const apiPrismaRoot = path.join(apiRoot, 'prisma');
const modulesRoot = path.join(apiSourceRoot, 'modules');
const promotedModules = new Set([
  'accounting-periods',
  'admin',
  'auth',
  'carry-forwards',
  'collected-transactions',
  'financial-statements',
  'import-batches',
  'insurance-policies',
  'journal-entries',
  'plan-items',
  'recurring-rules'
]);
const findings = [];

checkPromotedModuleRoots();
checkPromotedModulePublicImports();
checkPromotedModuleLayerBoundaries();
checkPromotedModulePublicExports();

if (findings.length > 0) {
  console.error(
    `[structure:check:promoted-api-modules] ${findings.length}개의 구조 오류를 찾았습니다.`
  );

  for (const finding of findings.sort()) {
    console.error(`- ${finding}`);
  }

  process.exit(1);
}

console.log(
  `[structure:check:promoted-api-modules] 승격 모듈 ${promotedModules.size}개의 루트 파일과 public.ts 경계를 확인했습니다.`
);

function checkPromotedModuleRoots() {
  for (const moduleName of promotedModules) {
    const moduleDirectory = path.join(modulesRoot, moduleName);
    const allowedRootFiles = new Set([
      `${moduleName}.controller.ts`,
      `${moduleName}.module.ts`,
      'public.ts'
    ]);

    for (const entry of fs.readdirSync(moduleDirectory, {
      withFileTypes: true
    })) {
      if (
        entry.isFile() &&
        entry.name.endsWith('.ts') &&
        !allowedRootFiles.has(entry.name)
      ) {
        findings.push(
          `${formatRepoPath(path.join(moduleDirectory, entry.name))}: 승격 모듈 루트에는 controller, module, public 파일만 둘 수 있습니다.`
        );
      }
    }

    if (!fs.existsSync(path.join(moduleDirectory, 'public.ts'))) {
      findings.push(
        `${formatRepoPath(moduleDirectory)}: public.ts 공개 진입점이 없습니다.`
      );
    }

    const supportDirectory = path.join(moduleDirectory, 'support');
    if (fs.existsSync(supportDirectory)) {
      findings.push(
        `${formatRepoPath(supportDirectory)}: 승격 모듈에는 support 디렉터리를 둘 수 없습니다.`
      );
    }
  }
}

function checkPromotedModuleLayerBoundaries() {
  for (const moduleName of promotedModules) {
    const moduleDirectory = path.join(modulesRoot, moduleName);
    checkLayerImports(path.join(moduleDirectory, 'domain'), [
      '@nestjs/',
      '@prisma/client',
      '@personal-erp/contracts',
      '/infrastructure/',
      '/dto/',
      'common/infrastructure',
      'common/prisma',
      'common/auth/jwt-config',
      'common/money/prisma-money',
      'node:crypto',
      'argon2'
    ]);
    checkLayerImports(path.join(moduleDirectory, 'application'), [
      '@nestjs/',
      '@prisma/client',
      '/infrastructure/',
      '/dto/',
      'common/infrastructure',
      'common/prisma',
      'common/auth/jwt-config',
      'common/money/prisma-money',
      'node:crypto',
      'argon2'
    ]);
  }
}

function checkPromotedModulePublicExports() {
  for (const moduleName of promotedModules) {
    const publicFile = path.join(modulesRoot, moduleName, 'public.ts');
    const source = readUtf8(publicFile);

    for (const forbiddenFragment of [
      '@prisma/client',
      '/infrastructure/models/',
      '/support/'
    ]) {
      if (source.includes(forbiddenFragment)) {
        findings.push(
          `${formatRepoPath(publicFile)}: public.ts에서 ${forbiddenFragment} 구현 타입을 export할 수 없습니다.`
        );
      }
    }

    if (
      source
        .split(';')
        .some(
          (statement) =>
            statement.includes('export type') &&
            statement.includes('/infrastructure/')
        )
    ) {
      findings.push(
        `${formatRepoPath(publicFile)}: public.ts에서 infrastructure record 타입을 export할 수 없습니다.`
      );
    }
  }
}

function checkLayerImports(layerDirectory, forbiddenFragments) {
  if (!fs.existsSync(layerDirectory)) {
    return;
  }

  for (const sourceFile of walkTypeScriptFiles(layerDirectory)) {
    const source = readUtf8(sourceFile);
    const importPattern =
      /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g;

    for (const match of source.matchAll(importPattern)) {
      const forbiddenFragment = forbiddenFragments.find((fragment) =>
        match[1].includes(fragment)
      );
      if (forbiddenFragment) {
        findings.push(
          `${formatRepoPath(sourceFile)}: ${path.basename(layerDirectory)} 계층에서 ${forbiddenFragment} 의존을 사용할 수 없습니다.`
        );
      }
    }
  }
}

function checkPromotedModulePublicImports() {
  const sourceFiles = [
    ...walkTypeScriptFiles(apiSourceRoot),
    ...walkTypeScriptFiles(apiPrismaRoot)
  ];

  for (const sourceFile of sourceFiles) {
    const sourceModule = readModuleName(sourceFile);
    const source = readUtf8(sourceFile);
    const importPattern =
      /(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g;

    for (const match of source.matchAll(importPattern)) {
      const targetFile = resolveTypeScriptImport(sourceFile, match[1]);

      if (!targetFile) {
        continue;
      }

      const targetModule = readModuleName(targetFile);

      if (
        !targetModule ||
        !promotedModules.has(targetModule) ||
        targetModule === sourceModule ||
        path.basename(targetFile) === 'public.ts'
      ) {
        continue;
      }

      findings.push(
        `${formatRepoPath(sourceFile)}: ${targetModule} 모듈 내부 파일 대신 ${targetModule}/public.ts를 import해야 합니다.`
      );
    }
  }
}

function walkTypeScriptFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkTypeScriptFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function resolveTypeScriptImport(sourceFile, importPath) {
  const basePath = path.resolve(path.dirname(sourceFile), importPath);
  const candidates = [`${basePath}.ts`, path.join(basePath, 'index.ts')];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function readModuleName(filePath) {
  const relativePath = path.relative(modulesRoot, filePath);

  if (relativePath.startsWith('..')) {
    return null;
  }

  return relativePath.split(path.sep)[0] ?? null;
}

function readUtf8(filePath) {
  const value = fs.readFileSync(filePath, 'utf8');
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function formatRepoPath(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}
