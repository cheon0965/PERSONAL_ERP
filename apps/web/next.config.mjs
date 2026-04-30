import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(webRoot, '../..');
const secretDirConfigPath = path.join(repoRoot, '.secret-dir.local');

function parseEnvLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) {
    return null;
  }

  const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex < 1) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = normalized.slice(separatorIndex + 1).trim();
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");
  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');

  if (isSingleQuoted || isDoubleQuoted) {
    value = value.slice(1, -1);
  } else {
    const commentIndex = value.indexOf(' #');
    if (commentIndex >= 0) {
      value = value.slice(0, commentIndex).trim();
    }
  }

  return [
    key,
    value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
  ];
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    const [key, value] = parsed;
    values[key] = value;
  }

  return values;
}

function resolveSecretDir() {
  const explicitSecretDir =
    typeof process.env.PERSONAL_ERP_SECRET_DIR === 'string'
      ? process.env.PERSONAL_ERP_SECRET_DIR.trim()
      : '';

  if (explicitSecretDir) {
    return path.resolve(explicitSecretDir);
  }

  const configuredSecretDir =
    readEnvFile(secretDirConfigPath).PERSONAL_ERP_SECRET_DIR?.trim();
  if (!configuredSecretDir) {
    return null;
  }

  return path.isAbsolute(configuredSecretDir)
    ? configuredSecretDir
    : path.resolve(repoRoot, configuredSecretDir);
}

function readSecretWebEnv() {
  const secretDir = resolveSecretDir();
  if (!secretDir) {
    return {};
  }

  return {
    ...readEnvFile(path.join(secretDir, 'web.env')),
    ...readEnvFile(path.join(secretDir, 'web.env.local'))
  };
}

const secretWebEnv = readSecretWebEnv();
const resolvedPublicEnv = {
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    secretWebEnv.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACK:
    process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK ??
    secretWebEnv.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK
};

for (const [key, value] of Object.entries(resolvedPublicEnv)) {
  if (process.env[key] === undefined && value !== undefined) {
    process.env[key] = value;
  }
}

function readOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const apiOrigin = readOrigin(resolvedPublicEnv.NEXT_PUBLIC_API_BASE_URL);
const webConnectSources = [
  "'self'",
  ...(apiOrigin ? [apiOrigin] : []),
  'http://localhost:4000',
  'http://127.0.0.1:4000'
];

const webContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${Array.from(new Set(webConnectSources)).join(' ')}`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

const webSecurityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: webContentSecurityPolicy
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), geolocation=(), microphone=()'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  env: resolvedPublicEnv,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: webSecurityHeaders
      }
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@personal-erp/money': path.resolve(
        repoRoot,
        'packages/money/dist/index.js'
      )
    };

    return config;
  }
};

export default nextConfig;
