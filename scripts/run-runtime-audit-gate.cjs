#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const allowlistPath = path.join(
  repoRoot,
  'security',
  'runtime-audit-allowlist.json'
);
const gateSeverity = 'high';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const auditArgs = [
  'audit',
  '--omit=dev',
  '--workspace',
  '@personal-erp/api',
  '--workspace',
  '@personal-erp/web',
  '--json'
];
const auditCommand =
  process.platform === 'win32'
    ? {
        command: process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', ['npm.cmd', ...auditArgs].join(' ')]
      }
    : {
        command: npmCommand,
        args: auditArgs
      };
const severityRank = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4
};

const allowlist = loadAllowlist(allowlistPath);
const auditResult = spawnSync(auditCommand.command, auditCommand.args, {
  cwd: repoRoot,
  env: process.env,
  encoding: 'utf8'
});

if (auditResult.error) {
  console.error('[audit:runtime] Failed to start npm audit.');
  console.error(auditResult.error);
  process.exit(1);
}

const stdout = (auditResult.stdout ?? '').trim();
const stderr = (auditResult.stderr ?? '').trim();
let report;

try {
  report = JSON.parse(stdout);
} catch (error) {
  console.error('[audit:runtime] Failed to parse npm audit JSON output.');
  if (stdout) {
    console.error(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }
  console.error(error);
  process.exit(auditResult.status ?? 1);
}

if (report.error) {
  console.error('[audit:runtime] npm audit returned an error report.');
  console.error(JSON.stringify(report.error, null, 2));
  process.exit(1);
}

const summary = report.metadata?.vulnerabilities ?? {};
const relevantFindings = collectRelevantFindings(report, gateSeverity);
const evaluation = evaluateFindings(relevantFindings, allowlist.entries);

if (
  evaluation.unallowlisted.length > 0 ||
  evaluation.expired.length > 0 ||
  evaluation.unused.length > 0
) {
  console.error(`[audit:runtime] ${gateSeverity} gate failed.`);
  console.error(
    `[audit:runtime] npm summary: high=${summary.high ?? 0}, critical=${summary.critical ?? 0}, total=${summary.total ?? 0}`
  );

  if (evaluation.unallowlisted.length > 0) {
    console.error(
      '[audit:runtime] Unallowlisted high/critical advisories detected:'
    );
    for (const finding of evaluation.unallowlisted) {
      console.error(`- ${formatFinding(finding)}`);
    }
  }

  if (evaluation.expired.length > 0) {
    console.error(
      '[audit:runtime] Expired allowlist entries must be removed or renewed:'
    );
    for (const { finding, entry } of evaluation.expired) {
      console.error(
        `- ${formatFinding(finding)} | expiresOn=${entry.expiresOn}`
      );
    }
  }

  if (evaluation.unused.length > 0) {
    console.error(
      '[audit:runtime] Stale allowlist entries are no longer needed and must be removed:'
    );
    for (const entry of evaluation.unused) {
      console.error(`- ${formatAllowlistEntry(entry)}`);
    }
  }

  if (stderr) {
    console.error(stderr);
  }

  process.exit(1);
}

console.log(`[audit:runtime] ${gateSeverity} gate passed.`);
console.log(
  `[audit:runtime] npm summary: high=${summary.high ?? 0}, critical=${summary.critical ?? 0}, total=${summary.total ?? 0}`
);

if (evaluation.allowed.length > 0) {
  console.log('[audit:runtime] Active allowlist matches:');
  for (const { finding, entry } of evaluation.allowed) {
    console.log(`- ${formatFinding(finding)} | expiresOn=${entry.expiresOn}`);
  }
} else {
  console.log('[audit:runtime] Active allowlist matches: 0');
}

if (allowlist.entries.length === 0) {
  console.log('[audit:runtime] Allowlist entries: 0');
}

if (stderr) {
  console.error(stderr);
}

process.exit(0);

function loadAllowlist(filePath) {
  let rawText;

  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(
      `[audit:runtime] Failed to read allowlist file at ${path.relative(repoRoot, filePath)}.`
    );
    console.error(error);
    process.exit(1);
  }

  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    console.error('[audit:runtime] Allowlist file is not valid JSON.');
    console.error(error);
    process.exit(1);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('[audit:runtime] Allowlist root must be an object.');
    process.exit(1);
  }

  if (parsed.version !== 1) {
    console.error('[audit:runtime] Allowlist version must be 1.');
    process.exit(1);
  }

  if (!Array.isArray(parsed.entries)) {
    console.error('[audit:runtime] Allowlist entries must be an array.');
    process.exit(1);
  }

  const seenKeys = new Set();
  const entries = parsed.entries.map((entry, index) => {
    const normalized = normalizeAllowlistEntry(entry, index);
    const key = allowlistEntryKey(normalized);

    if (seenKeys.has(key)) {
      console.error(
        `[audit:runtime] Duplicate allowlist entry detected: ${formatAllowlistEntry(normalized)}`
      );
      process.exit(1);
    }

    seenKeys.add(key);
    return normalized;
  });

  return {
    version: parsed.version,
    entries
  };
}

function normalizeAllowlistEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    console.error(
      `[audit:runtime] Allowlist entry #${index + 1} must be an object.`
    );
    process.exit(1);
  }

  const normalized = {
    id: readRequiredString(entry, 'id', index),
    package: readRequiredString(entry, 'package', index),
    severity: normalizeSeverity(
      readRequiredString(entry, 'severity', index),
      index,
      'severity'
    ),
    expiresOn: readRequiredDate(entry, 'expiresOn', index),
    trackedAt: readRequiredDate(entry, 'trackedAt', index),
    reason: readRequiredString(entry, 'reason', index)
  };

  if (severityRank[normalized.severity] < severityRank[gateSeverity]) {
    console.error(
      `[audit:runtime] Allowlist entry #${index + 1} severity must be ${gateSeverity} or higher.`
    );
    process.exit(1);
  }

  return normalized;
}

function readRequiredString(entry, fieldName, index) {
  const value = entry[fieldName];

  if (typeof value !== 'string' || value.trim().length === 0) {
    console.error(
      `[audit:runtime] Allowlist entry #${index + 1} field "${fieldName}" must be a non-empty string.`
    );
    process.exit(1);
  }

  return value.trim();
}

function readRequiredDate(entry, fieldName, index) {
  const value = readRequiredString(entry, fieldName, index);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(
      `[audit:runtime] Allowlist entry #${index + 1} field "${fieldName}" must use YYYY-MM-DD.`
    );
    process.exit(1);
  }

  return value;
}

function normalizeSeverity(value, index, fieldName) {
  const normalized = String(value).trim().toLowerCase();

  if (!(normalized in severityRank)) {
    console.error(
      `[audit:runtime] Allowlist entry #${index + 1} field "${fieldName}" has unsupported severity "${value}".`
    );
    process.exit(1);
  }

  return normalized;
}

function collectRelevantFindings(report, minimumSeverity) {
  const vulnerabilities = report?.vulnerabilities;

  if (!vulnerabilities || typeof vulnerabilities !== 'object') {
    return [];
  }

  const minimumRank = severityRank[minimumSeverity];
  const findingsByKey = new Map();

  for (const [packageName, vulnerability] of Object.entries(vulnerabilities)) {
    for (const finding of collectFindingsForPackage(
      packageName,
      vulnerability
    )) {
      if (severityRank[finding.severity] < minimumRank) {
        continue;
      }

      findingsByKey.set(findingKey(finding), finding);
    }
  }

  return Array.from(findingsByKey.values()).sort((left, right) =>
    formatFinding(left).localeCompare(formatFinding(right))
  );
}

function collectFindingsForPackage(packageName, vulnerability) {
  const via = Array.isArray(vulnerability?.via) ? vulnerability.via : [];
  const advisoryObjects = via.filter(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  );

  if (advisoryObjects.length === 0) {
    return [normalizeFinding(packageName, vulnerability, null)];
  }

  return advisoryObjects.map((advisory) =>
    normalizeFinding(packageName, vulnerability, advisory)
  );
}

function normalizeFinding(packageName, vulnerability, advisory) {
  const source = advisory ?? vulnerability;
  const packageId =
    source.name ?? source.dependency ?? vulnerability?.name ?? packageName;

  return {
    id: readFindingId(source, packageId),
    package: packageId,
    severity: normalizeFindingSeverity(
      source.severity ?? vulnerability?.severity
    ),
    title:
      typeof source.title === 'string' && source.title.trim().length > 0
        ? source.title.trim()
        : `${packageId} vulnerability`,
    url: typeof source.url === 'string' ? source.url : '',
    range:
      typeof source.range === 'string'
        ? source.range
        : typeof vulnerability?.range === 'string'
          ? vulnerability.range
          : ''
  };
}

function readFindingId(source, packageName) {
  if (typeof source.url === 'string') {
    const ghsaMatch = source.url.match(/GHSA-[A-Za-z0-9-]+/);

    if (ghsaMatch) {
      return ghsaMatch[0];
    }
  }

  if (source.source !== undefined && source.source !== null) {
    return String(source.source);
  }

  const title =
    typeof source.title === 'string' && source.title.trim().length > 0
      ? source.title.trim()
      : packageName;

  return `${packageName}:${title}`;
}

function normalizeFindingSeverity(value) {
  const normalized = String(value ?? 'info')
    .trim()
    .toLowerCase();
  return normalized in severityRank ? normalized : 'info';
}

function evaluateFindings(findings, allowlistEntries) {
  const matchedKeys = new Set();
  const today = new Date().toISOString().slice(0, 10);
  const allowed = [];
  const expired = [];
  const unallowlisted = [];

  for (const finding of findings) {
    const entry = allowlistEntries.find((candidate) =>
      doesAllowlistEntryMatchFinding(candidate, finding)
    );

    if (!entry) {
      unallowlisted.push(finding);
      continue;
    }

    matchedKeys.add(allowlistEntryKey(entry));

    if (entry.expiresOn < today) {
      expired.push({ finding, entry });
      continue;
    }

    allowed.push({ finding, entry });
  }

  const unused = allowlistEntries.filter(
    (entry) => !matchedKeys.has(allowlistEntryKey(entry))
  );

  return {
    allowed,
    expired,
    unallowlisted,
    unused
  };
}

function doesAllowlistEntryMatchFinding(entry, finding) {
  return (
    entry.id === finding.id &&
    entry.package === finding.package &&
    entry.severity === finding.severity
  );
}

function allowlistEntryKey(entry) {
  return `${entry.id}::${entry.package}::${entry.severity}`;
}

function findingKey(finding) {
  return `${finding.id}::${finding.package}::${finding.severity}::${finding.range}`;
}

function formatFinding(finding) {
  const parts = [
    `${finding.severity.toUpperCase()} ${finding.id}`,
    `package=${finding.package}`
  ];

  if (finding.range) {
    parts.push(`range=${finding.range}`);
  }

  if (finding.url) {
    parts.push(`url=${finding.url}`);
  }

  return parts.join(' | ');
}

function formatAllowlistEntry(entry) {
  return `${entry.severity.toUpperCase()} ${entry.id} | package=${entry.package} | expiresOn=${entry.expiresOn}`;
}
