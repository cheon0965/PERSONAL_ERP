#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const scannedRoots = ['apps/api/src', 'apps/web/src', 'packages/contracts/src'];
const scannedExtensions = new Set(['.ts', '.tsx']);
const ignoredDirectoryNames = new Set([
  '.next',
  'coverage',
  'dist',
  'node_modules'
]);

const moneyToken =
  '(?:amount|Amount|Won|won|balance|Balance|premium|Premium|expense|Expense|income|Income|reserve|Reserve|sinkingFund|SinkingFund|cash|Cash|asset|Asset|liability|Liability|equity|Equity|pnl|PnL|planned|Planned|debit|Debit|credit|Credit)';
const checks = [
  {
    code: 'money-number-conversion',
    pattern: new RegExp(`\\bNumber\\s*\\([^)]*${moneyToken}[^)]*\\)`),
    message:
      'Use parseMoneyWon/asMoneyWon or a mapper-specific money bridge instead of Number(...) for money fields.'
  },
  {
    code: 'money-compound-assignment',
    pattern: new RegExp(
      `\\b[A-Za-z_$][\\w$]*${moneyToken}[A-Za-z0-9_$]*\\s*[+-]=`
    ),
    message:
      'Use addMoneyWon/subtractMoneyWon/sumMoneyWon instead of compound assignment for money fields.'
  },
  {
    code: 'money-binary-arithmetic',
    pattern: new RegExp(`${moneyToken}[^\\n;]*\\s[+-]\\s[^\\n;]*${moneyToken}`),
    message:
      'Use shared money helpers instead of raw + or - between money fields.'
  }
];

const findings = [];

for (const relativeRoot of scannedRoots) {
  const absoluteRoot = path.join(repoRoot, relativeRoot);

  if (!fs.existsSync(absoluteRoot)) {
    continue;
  }

  for (const filePath of collectSourceFiles(absoluteRoot)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, lineIndex) => {
      if (shouldIgnoreLine(line)) {
        return;
      }

      for (const check of checks) {
        if (check.pattern.test(line)) {
          findings.push({
            filePath,
            lineNumber: lineIndex + 1,
            code: check.code,
            message: check.message,
            line: line.trim()
          });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error(
    `[money:check] Found ${findings.length} possible raw money operation(s).`
  );
  console.error(
    '[money:check] Prefer @personal-erp/money helpers, or add money-ops-allow with a short reason for intentional exceptions.'
  );

  for (const finding of findings) {
    console.error(
      `- ${formatRepoPath(finding.filePath)}:${finding.lineNumber} ${finding.code}`
    );
    console.error(`  ${finding.message}`);
    console.error(`  ${finding.line}`);
  }

  process.exit(1);
}

console.log(
  `[money:check] Checked ${scannedRoots.join(', ')} for raw money arithmetic.`
);

function collectSourceFiles(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectoryNames.has(entry.name)) {
        files.push(...collectSourceFiles(entryPath));
      }

      continue;
    }

    if (entry.isFile() && scannedExtensions.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function shouldIgnoreLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    line.includes('money-ops-allow')
  );
}

function formatRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}
