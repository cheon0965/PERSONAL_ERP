#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const markdownRoots = [
  'README.md',
  'CONTRIBUTING.md',
  'ENVIRONMENT_SETUP.md',
  'PORTFOLIO_ARCHITECTURE_GUIDE.md',
  'docs'
];
const ignoredMarkdownDirectories = new Set([
  path.join(repoRoot, 'docs', 'archive')
]);

const rootPackage = readJson(path.join(repoRoot, 'package.json'));
const rootScriptNames = new Set(Object.keys(rootPackage.scripts ?? {}));
const workspacePackages = resolveWorkspacePackages(
  rootPackage.workspaces ?? []
);
const markdownFiles = collectMarkdownFiles();

const findings = [];
let checkedCommandCount = 0;

for (const filePath of markdownFiles) {
  const fileContent = fs.readFileSync(filePath, 'utf8');

  for (const match of findNpmRunCommands(fileContent)) {
    if (shouldIgnoreCommand(match.scriptName)) {
      continue;
    }

    checkedCommandCount += 1;

    const targetWorkspace = resolveWorkspaceFromTail(match.tail);

    if (targetWorkspace) {
      const workspacePackage =
        workspacePackages.byName.get(targetWorkspace) ??
        workspacePackages.byRelativePath.get(normalizePath(targetWorkspace)) ??
        null;

      if (!workspacePackage) {
        findings.push({
          filePath,
          lineNumber: match.lineNumber,
          command: match.command,
          message: `workspace "${targetWorkspace}"를 찾을 수 없습니다.`
        });
        continue;
      }

      if (!workspacePackage.scriptNames.has(match.scriptName)) {
        findings.push({
          filePath,
          lineNumber: match.lineNumber,
          command: match.command,
          message: `workspace "${workspacePackage.name}"에 "${match.scriptName}" 스크립트가 없습니다.`
        });
      }

      continue;
    }

    if (!rootScriptNames.has(match.scriptName)) {
      findings.push({
        filePath,
        lineNumber: match.lineNumber,
        command: match.command,
        message: `루트 package.json에 "${match.scriptName}" 스크립트가 없습니다.`
      });
    }
  }
}

if (findings.length > 0) {
  console.error(
    `[docs:check:npm-run] ${findings.length}개의 문서 명령 정합성 오류를 찾았습니다.`
  );

  for (const finding of findings) {
    console.error(
      `- ${formatRepoPath(finding.filePath)}:${finding.lineNumber} -> ${finding.command}`
    );
    console.error(`  ${finding.message}`);
  }

  process.exit(1);
}

console.log(
  `[docs:check:npm-run] ${markdownFiles.length}개 Markdown 파일에서 ${checkedCommandCount}개의 npm run 명령 참조를 확인했습니다.`
);

function collectMarkdownFiles() {
  const files = [];

  for (const relativeTarget of markdownRoots) {
    const absoluteTarget = path.join(repoRoot, relativeTarget);

    if (!fs.existsSync(absoluteTarget)) {
      continue;
    }

    const stats = fs.statSync(absoluteTarget);

    if (stats.isDirectory()) {
      walkMarkdownFiles(absoluteTarget, files);
      continue;
    }

    if (absoluteTarget.endsWith('.md')) {
      files.push(absoluteTarget);
    }
  }

  return [...new Set(files)].sort((left, right) =>
    formatRepoPath(left).localeCompare(formatRepoPath(right))
  );
}

function walkMarkdownFiles(currentDirectory, files) {
  if (ignoredMarkdownDirectories.has(currentDirectory)) {
    return;
  }

  for (const entry of fs.readdirSync(currentDirectory, {
    withFileTypes: true
  })) {
    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      walkMarkdownFiles(absolutePath, files);
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith('.md')) {
      files.push(absolutePath);
    }
  }
}

function readJson(filePath) {
  return JSON.parse(stripBom(fs.readFileSync(filePath, 'utf8')));
}

function resolveWorkspacePackages(workspacePatterns) {
  const byName = new Map();
  const byRelativePath = new Map();

  for (const pattern of workspacePatterns) {
    for (const workspaceDirectory of expandWorkspacePattern(pattern)) {
      const packageJsonPath = path.join(workspaceDirectory, 'package.json');

      if (!fs.existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJson(packageJsonPath);
      const relativeDirectory = normalizePath(
        path.relative(repoRoot, workspaceDirectory)
      );
      const workspacePackage = {
        name: packageJson.name,
        relativeDirectory,
        scriptNames: new Set(Object.keys(packageJson.scripts ?? {}))
      };

      if (workspacePackage.name) {
        byName.set(workspacePackage.name, workspacePackage);
      }

      byRelativePath.set(relativeDirectory, workspacePackage);
    }
  }

  return {
    byName,
    byRelativePath
  };
}

function expandWorkspacePattern(pattern) {
  const absolutePattern = path.join(repoRoot, pattern);

  if (!pattern.endsWith('/*')) {
    return [absolutePattern];
  }

  const baseDirectory = absolutePattern.slice(0, -2);

  if (!fs.existsSync(baseDirectory)) {
    return [];
  }

  return fs
    .readdirSync(baseDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(baseDirectory, entry.name));
}

function* findNpmRunCommands(fileContent) {
  const commandPattern = /npm run\s+([^\s`]+)([^`\r\n]*)/g;

  for (const match of fileContent.matchAll(commandPattern)) {
    const scriptName = match[1]?.trim() ?? '';
    const tail = match[2] ?? '';
    const command = `npm run ${scriptName}${tail}`.trim();
    const lineNumber = countLineNumber(fileContent, match.index ?? 0);

    yield {
      scriptName,
      tail,
      command,
      lineNumber
    };
  }
}

function shouldIgnoreCommand(scriptName) {
  if (!scriptName) {
    return true;
  }

  return scriptName.includes('<') || scriptName.includes('>');
}

function resolveWorkspaceFromTail(commandTail) {
  const tokens = tokenizeCommandTail(commandTail);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '--workspace' || token === '-w') {
      return tokens[index + 1] ?? null;
    }

    if (token.startsWith('--workspace=')) {
      return token.slice('--workspace='.length) || null;
    }

    if (token.startsWith('-w=')) {
      return token.slice('-w='.length) || null;
    }
  }

  return null;
}

function tokenizeCommandTail(commandTail) {
  const tokens = [];
  const tokenPattern = /"([^"]*)"|'([^']*)'|([^\s]+)/g;

  for (const match of commandTail.matchAll(tokenPattern)) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }

  return tokens;
}

function countLineNumber(fileContent, characterIndex) {
  return fileContent.slice(0, characterIndex).split(/\r?\n/).length;
}

function formatRepoPath(filePath) {
  return normalizePath(path.relative(repoRoot, filePath));
}

function normalizePath(filePath) {
  return filePath.replaceAll(path.sep, '/');
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
