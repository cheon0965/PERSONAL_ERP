#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const apiDocPath = path.join(repoRoot, 'docs', 'API.md');
const currentCapabilitiesPath = path.join(
  repoRoot,
  'docs',
  'CURRENT_CAPABILITIES.md'
);
const operationsChecklistPath = path.join(
  repoRoot,
  'docs',
  'OPERATIONS_CHECKLIST.md'
);
const validationNotesPath = path.join(repoRoot, 'docs', 'VALIDATION_NOTES.md');
const webAppRoot = path.join(repoRoot, 'apps', 'web', 'app');
const apiModulesRoot = path.join(repoRoot, 'apps', 'api', 'src', 'modules');

const ignoredWebRoutes = new Set(['/', '/login', '/settings']);

const apiDocContent = readUtf8(apiDocPath);
const currentCapabilitiesContent = readUtf8(currentCapabilitiesPath);
const operationsChecklistContent = readUtf8(operationsChecklistPath);
const validationNotesContent = readUtf8(validationNotesPath);

const actualWebRoutes = collectWebRoutes(webAppRoot);
const actualDocumentedWebRoutes = new Set(
  [...actualWebRoutes].filter((routePath) => !ignoredWebRoutes.has(routePath))
);
const actualApiOperations = collectApiOperations(apiModulesRoot);
const actualApiOperationSet = new Set(
  actualApiOperations.map((operation) => formatOperation(operation))
);
const actualApiPathSet = new Set(
  actualApiOperations.map((operation) => operation.path)
);

const documentedApiOperations = extractDocumentedApiOperations(apiDocContent);
const documentedValidationOperations = extractDocumentedApiOperations(
  validationNotesContent
);
const documentedApiRouteMap = extractDocumentedWebToApiRouteMap(apiDocContent);
const documentedCurrentCapabilityRoutes = extractDocumentedSectionRoutes(
  currentCapabilitiesContent,
  '## Web 화면 그룹'
);
const documentedOperationsChecklistRoutes =
  extractDocumentedNestedSectionRoutes(
    operationsChecklistContent,
    '## 수동 스모크 체크',
    '### Web'
  );
const documentedRouteCheckRoutes = extractValidationNotesWebRoutes(
  validationNotesContent
);

const findings = [];

checkMissingEntries({
  actualEntries: actualDocumentedWebRoutes,
  documentedEntries: new Set(
    documentedApiRouteMap.map((entry) => entry.webRoute).sort()
  ),
  actualOnlyMessage: (routePath) =>
    `docs/API.md의 Web route map에 "${routePath}" 경로가 없습니다.`,
  documentedOnlyMessage: (routePath) =>
    `문서에 적힌 Web 경로 "${routePath}"가 apps/web/app 라우트에 없습니다.`
});

for (const documentedRoute of documentedRouteCheckRoutes) {
  if (!actualWebRoutes.has(documentedRoute.value)) {
    findings.push({
      filePath: validationNotesPath,
      lineNumber: documentedRoute.lineNumber,
      message: `문서에 적힌 Web 경로 "${documentedRoute.value}"가 apps/web/app 라우트에 없습니다.`
    });
  }
}

for (const documentedRoute of documentedCurrentCapabilityRoutes) {
  if (!actualWebRoutes.has(documentedRoute.value)) {
    findings.push({
      filePath: currentCapabilitiesPath,
      lineNumber: documentedRoute.lineNumber,
      message: `문서에 적힌 Web 경로 "${documentedRoute.value}"가 apps/web/app 라우트에 없습니다.`
    });
  }
}

for (const documentedRoute of documentedOperationsChecklistRoutes) {
  if (!actualWebRoutes.has(documentedRoute.value)) {
    findings.push({
      filePath: operationsChecklistPath,
      lineNumber: documentedRoute.lineNumber,
      message: `문서에 적힌 Web 경로 "${documentedRoute.value}"가 apps/web/app 라우트에 없습니다.`
    });
  }
}

checkMissingEntries({
  actualEntries: actualApiOperationSet,
  documentedEntries: new Set(
    documentedApiOperations.map((operation) => formatOperation(operation))
  ),
  actualOnlyMessage: (operation) =>
    `docs/API.md에 "${operation}" 엔드포인트가 누락되어 있습니다.`,
  documentedOnlyMessage: (operation) =>
    `docs/API.md에 적힌 "${operation}" 엔드포인트가 현재 controller/Swagger surface에 없습니다.`
});

for (const documentedOperation of documentedValidationOperations) {
  const operationKey = formatOperation(documentedOperation);

  if (!actualApiOperationSet.has(operationKey)) {
    findings.push({
      filePath: validationNotesPath,
      lineNumber: documentedOperation.lineNumber,
      message: `docs/VALIDATION_NOTES.md에 적힌 "${operationKey}" 엔드포인트가 현재 controller/Swagger surface에 없습니다.`
    });
  }
}

for (const documentedEntry of documentedApiRouteMap) {
  for (const apiReference of documentedEntry.apiReferences) {
    if (apiReference.kind === 'operation') {
      const operationKey = formatOperation(apiReference);

      if (!actualApiOperationSet.has(operationKey)) {
        findings.push({
          filePath: apiDocPath,
          lineNumber: documentedEntry.lineNumber,
          message: `Web route map이 가리키는 "${operationKey}" 엔드포인트가 현재 controller/Swagger surface에 없습니다.`
        });
      }

      continue;
    }

    if (!actualApiPathSet.has(apiReference.path)) {
      findings.push({
        filePath: apiDocPath,
        lineNumber: documentedEntry.lineNumber,
        message: `Web route map이 가리키는 API 경로 "${apiReference.path}"가 현재 controller/Swagger surface에 없습니다.`
      });
    }
  }
}

if (findings.length > 0) {
  console.error(
    `[docs:check:surface] ${findings.length}개의 문서·Swagger·라우트 정합성 오류를 찾았습니다.`
  );

  for (const finding of findings.sort(compareFindings)) {
    console.error(
      `- ${formatRepoPath(finding.filePath)}:${finding.lineNumber} -> ${finding.message}`
    );
  }

  process.exit(1);
}

console.log(
  `[docs:check:surface] Web routes ${actualDocumentedWebRoutes.size}개, API operations ${actualApiOperationSet.size}개, docs/API route map ${documentedApiRouteMap.length}개, docs/API operations ${documentedApiOperations.length}개, docs/CURRENT_CAPABILITIES web routes ${documentedCurrentCapabilityRoutes.length}개, docs/OPERATIONS_CHECKLIST web routes ${documentedOperationsChecklistRoutes.length}개, docs/VALIDATION_NOTES web routes ${documentedRouteCheckRoutes.length}개를 확인했습니다.`
);

function collectWebRoutes(appRootDirectory) {
  const routes = new Set();

  for (const filePath of walkFiles(appRootDirectory, 'page.tsx')) {
    routes.add(resolveWebRouteFromPage(filePath));
  }

  return routes;
}

function collectApiOperations(modulesRootDirectory) {
  const operations = [];

  for (const filePath of walkFiles(modulesRootDirectory, '.controller.ts')) {
    const fileContent = readUtf8(filePath);
    const controllerMatch = fileContent.match(
      /@Controller\((?:'([^']*)'|"([^"]*)")?\)/
    );
    const controllerPath = normalizeRoutePath(
      controllerMatch?.[1] ?? controllerMatch?.[2] ?? ''
    );
    const operationPattern =
      /@(Get|Post|Patch|Delete)\((?:'([^']*)'|"([^"]*)")?\)/g;

    for (const match of fileContent.matchAll(operationPattern)) {
      const method = match[1]?.toUpperCase() ?? '';
      const methodPath = normalizeRoutePath(match[2] ?? match[3] ?? '');
      const routePath = joinRoutePath(controllerPath, methodPath);

      operations.push({
        method,
        path: routePath
      });
    }
  }

  return operations.sort((left, right) =>
    formatOperation(left).localeCompare(formatOperation(right))
  );
}

function extractDocumentedApiOperations(fileContent) {
  const operations = [];
  const operationPattern = /`(GET|POST|PATCH|DELETE)\s+([^`]+)`/g;

  for (const match of fileContent.matchAll(operationPattern)) {
    operations.push({
      method: match[1],
      path: normalizeDocumentedApiPath(match[2]),
      lineNumber: countLineNumber(fileContent, match.index ?? 0)
    });
  }

  return dedupeOperations(operations);
}

function extractDocumentedWebToApiRouteMap(fileContent) {
  const entries = [];
  const lines = fileContent.split(/\r?\n/);
  const sectionState = createSectionState(lines);

  for (let index = 0; index < lines.length; index += 1) {
    if (!sectionState.isInside(index, '## Web 화면 경로와 API 모듈 대응')) {
      continue;
    }

    const line = lines[index];
    const match = line.match(/^- Web `([^`]+)` -> API (.+)$/);

    if (!match) {
      continue;
    }

    const apiReferences = [];
    for (const apiTokenMatch of match[2].matchAll(/`([^`]+)`/g)) {
      const token = apiTokenMatch[1]?.trim() ?? '';
      const operationMatch = token.match(/^(GET|POST|PATCH|DELETE)\s+(.+)$/);

      if (operationMatch) {
        apiReferences.push({
          kind: 'operation',
          method: operationMatch[1],
          path: normalizeDocumentedApiPath(operationMatch[2])
        });
        continue;
      }

      if (token.startsWith('/')) {
        apiReferences.push({
          kind: 'path',
          path: normalizeDocumentedApiPath(token)
        });
      }
    }

    entries.push({
      webRoute: normalizeRoutePath(match[1]),
      apiReferences,
      lineNumber: index + 1
    });
  }

  return entries;
}

function extractValidationNotesWebRoutes(fileContent) {
  return extractDocumentedSectionRoutes(fileContent, '### Web');
}

function extractDocumentedSectionRoutes(fileContent, headingText) {
  const routes = [];
  const lines = fileContent.split(/\r?\n/);
  const sectionState = createSectionState(lines);

  for (let index = 0; index < lines.length; index += 1) {
    if (!sectionState.isInside(index, headingText)) {
      continue;
    }

    for (const routeMatch of lines[index].matchAll(/`(\/[^`\s]+)`/g)) {
      routes.push({
        value: normalizeRoutePath(routeMatch[1]),
        lineNumber: index + 1
      });
    }
  }

  return dedupeByValue(routes);
}

function extractDocumentedNestedSectionRoutes(
  fileContent,
  parentHeadingText,
  childHeadingText
) {
  const lines = fileContent.split(/\r?\n/);
  const headings = collectHeadings(lines);
  const parentHeading = headings.find(
    (heading) => heading.text === parentHeadingText
  );

  if (!parentHeading) {
    return [];
  }

  const parentEndIndex =
    headings.find(
      (heading) =>
        heading.index > parentHeading.index &&
        heading.level <= parentHeading.level
    )?.index ?? lines.length;

  const childHeading = headings.find(
    (heading) =>
      heading.text === childHeadingText &&
      heading.index > parentHeading.index &&
      heading.index < parentEndIndex
  );

  if (!childHeading) {
    return [];
  }

  const childEndIndex =
    headings.find(
      (heading) =>
        heading.index > childHeading.index &&
        heading.index < parentEndIndex &&
        heading.level <= childHeading.level
    )?.index ?? parentEndIndex;

  const routes = [];

  for (let index = childHeading.index + 1; index < childEndIndex; index += 1) {
    for (const routeMatch of lines[index].matchAll(/`(\/[^`\s]+)`/g)) {
      routes.push({
        value: normalizeRoutePath(routeMatch[1]),
        lineNumber: index + 1
      });
    }
  }

  return dedupeByValue(routes);
}

function createSectionState(lines) {
  const headings = collectHeadings(lines);

  return {
    isInside(lineIndex, headingText) {
      const startHeading = headings.find(
        (heading) => heading.text === headingText
      );

      if (!startHeading) {
        return false;
      }

      const nextHeading = headings.find(
        (heading) =>
          heading.index > startHeading.index &&
          heading.level <= startHeading.level
      );
      const endIndex = nextHeading?.index ?? lines.length;

      return lineIndex > startHeading.index && lineIndex < endIndex;
    }
  };
}

function collectHeadings(lines) {
  return lines
    .map((line, index) => ({
      index,
      level: countHeadingLevel(line),
      text: line.trim()
    }))
    .filter((heading) => heading.level > 0);
}

function countHeadingLevel(line) {
  const match = line.match(/^(#{1,6})\s+/);
  return match ? match[1].length : 0;
}

function checkMissingEntries({
  actualEntries,
  documentedEntries,
  actualOnlyMessage,
  documentedOnlyMessage
}) {
  for (const actualEntry of [...actualEntries].sort()) {
    if (!documentedEntries.has(actualEntry)) {
      findings.push({
        filePath: apiDocPath,
        lineNumber: 1,
        message: actualOnlyMessage(actualEntry)
      });
    }
  }

  for (const documentedEntry of [...documentedEntries].sort()) {
    if (!actualEntries.has(documentedEntry)) {
      findings.push({
        filePath: apiDocPath,
        lineNumber: 1,
        message: documentedOnlyMessage(documentedEntry)
      });
    }
  }
}

function walkFiles(rootDirectory, fileSuffix) {
  const files = [];

  for (const entry of fs.readdirSync(rootDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(absolutePath, fileSuffix));
      continue;
    }

    if (entry.isFile() && absolutePath.endsWith(fileSuffix)) {
      files.push(absolutePath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function resolveWebRouteFromPage(filePath) {
  const relativePath = normalizePath(path.relative(webAppRoot, filePath));
  const segments = relativePath
    .replace(/(^|\/)page\.tsx$/, '')
    .split('/')
    .filter(Boolean)
    .filter((segment) => !segment.startsWith('('));

  if (segments.length === 0) {
    return '/';
  }

  return `/${segments.join('/')}`;
}

function normalizeDocumentedApiPath(documentedPath) {
  const [pathWithoutQuery] = documentedPath.split('?');
  return normalizeRoutePath(pathWithoutQuery);
}

function normalizeRoutePath(routePath) {
  const normalized = routePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '/';
}

function joinRoutePath(basePath, methodPath) {
  const segments = [basePath, methodPath]
    .flatMap((routePath) =>
      normalizeRoutePath(routePath).split('/').filter(Boolean)
    )
    .filter(Boolean);

  return normalizeRoutePath(segments.join('/'));
}

function dedupeOperations(operations) {
  const seen = new Set();
  const deduped = [];

  for (const operation of operations) {
    const key = formatOperation(operation);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(operation);
  }

  return deduped.sort((left, right) =>
    formatOperation(left).localeCompare(formatOperation(right))
  );
}

function dedupeByValue(entries) {
  const seen = new Set();
  const deduped = [];

  for (const entry of entries) {
    if (seen.has(entry.value)) {
      continue;
    }

    seen.add(entry.value);
    deduped.push(entry);
  }

  return deduped.sort((left, right) => left.value.localeCompare(right.value));
}

function formatOperation(operation) {
  return `${operation.method} ${operation.path}`;
}

function countLineNumber(fileContent, characterIndex) {
  return fileContent.slice(0, characterIndex).split(/\r?\n/).length;
}

function compareFindings(left, right) {
  const fileComparison = formatRepoPath(left.filePath).localeCompare(
    formatRepoPath(right.filePath)
  );

  if (fileComparison !== 0) {
    return fileComparison;
  }

  return left.lineNumber - right.lineNumber;
}

function readUtf8(filePath) {
  return stripBom(fs.readFileSync(filePath, 'utf8'));
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
