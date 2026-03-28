#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = process.env.npm_package_json
  ? path.resolve(process.env.npm_package_json)
  : path.join(process.cwd(), 'package.json');
const envRoot = fs.existsSync(packageJsonPath)
  ? path.dirname(packageJsonPath)
  : process.cwd();
const workspaceKey = path.basename(envRoot);
const secretDirConfigPath = path.join(repoRoot, '.secret-dir.local');

function resolveCommand(commandName) {
  if (commandName === 'node') {
    return process.execPath;
  }

  if (
    path.isAbsolute(commandName) ||
    commandName.includes('/') ||
    commandName.includes('\\') ||
    path.extname(commandName)
  ) {
    return commandName;
  }

  const extension = process.platform === 'win32' ? '.cmd' : '';
  const localBinPath = path.join(
    repoRoot,
    'node_modules',
    '.bin',
    `${commandName}${extension}`
  );

  if (fs.existsSync(localBinPath)) {
    return localBinPath;
  }

  return commandName;
}

function parseEnvLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) return null;

  const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex < 1) return null;

  const key = normalized.slice(0, separatorIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

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

  value = value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');

  return [key, value];
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, 'utf8');
  const values = {};

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    values[key] = value;
  }

  return values;
}

function resolvePathFromRepoRoot(rawPath) {
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(repoRoot, rawPath);
}

function resolveConfiguredSecretDir(baseEnv) {
  const explicitSecretDir =
    typeof baseEnv.PERSONAL_ERP_SECRET_DIR === 'string'
      ? baseEnv.PERSONAL_ERP_SECRET_DIR.trim()
      : '';

  if (explicitSecretDir) {
    return path.resolve(explicitSecretDir);
  }

  const configValues = readEnvFile(secretDirConfigPath);
  const configuredSecretDir =
    typeof configValues.PERSONAL_ERP_SECRET_DIR === 'string'
      ? configValues.PERSONAL_ERP_SECRET_DIR.trim()
      : '';

  if (!configuredSecretDir) {
    return null;
  }

  return resolvePathFromRepoRoot(configuredSecretDir);
}

function getEnvFileCandidates(secretDir) {
  const localFiles = [
    path.join(envRoot, '.env'),
    path.join(envRoot, '.env.local')
  ];

  if (!secretDir) {
    return localFiles;
  }

  return [
    ...localFiles,
    path.join(secretDir, `${workspaceKey}.env`),
    path.join(secretDir, `${workspaceKey}.env.local`),
    path.join(secretDir, workspaceKey, '.env'),
    path.join(secretDir, workspaceKey, '.env.local'),
    path.join(secretDir, 'apps', workspaceKey, '.env'),
    path.join(secretDir, 'apps', workspaceKey, '.env.local')
  ];
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    'Usage: node scripts/run-with-root-env.cjs <command> [args...]'
  );
  process.exit(1);
}

const command = args[0];
const commandArgs = args.slice(1);
const resolvedCommand = resolveCommand(command);

const baseEnv = { ...process.env };
const configuredSecretDir = resolveConfiguredSecretDir(baseEnv);

if (configuredSecretDir) {
  const secretDirStat = fs.existsSync(configuredSecretDir)
    ? fs.statSync(configuredSecretDir)
    : null;

  if (!secretDirStat || !secretDirStat.isDirectory()) {
    console.error(
      `[run-with-root-env] PERSONAL_ERP_SECRET_DIR does not point to a readable directory: ${configuredSecretDir}`
    );
    process.exit(1);
  }
}

const envFileCandidates = getEnvFileCandidates(configuredSecretDir);
const loadedEnv = {};

for (const filePath of envFileCandidates) {
  Object.assign(loadedEnv, readEnvFile(filePath));
}

if (configuredSecretDir && baseEnv.PERSONAL_ERP_SECRET_DIR === undefined) {
  process.env.PERSONAL_ERP_SECRET_DIR = configuredSecretDir;
}

for (const [key, value] of Object.entries(loadedEnv)) {
  if (baseEnv[key] === undefined) {
    process.env[key] = value;
  }
}

const isWindowsCmd =
  process.platform === 'win32' && resolvedCommand.endsWith('.cmd');

const spawnCmd = isWindowsCmd ? 'cmd.exe' : resolvedCommand;
const spawnArgs = isWindowsCmd
  ? ['/c', resolvedCommand, ...commandArgs]
  : commandArgs;

const child = spawn(spawnCmd, spawnArgs, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  const prefix = '[run-with-root-env] Failed to run "' + command + '":';
  console.error(prefix, error.message);
  process.exit(1);
});
