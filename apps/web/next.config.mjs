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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  env: resolvedPublicEnv,
  webpack: (config) => config
};

export default nextConfig;
