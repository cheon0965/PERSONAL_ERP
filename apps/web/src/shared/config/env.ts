type WebEnv = {
  NEXT_PUBLIC_API_BASE_URL: string;
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: boolean;
};

type WebRuntime = {
  nodeEnv: string;
  demoFallbackEnabled: boolean;
};

type RawWebProcessEnv = Pick<
  NodeJS.ProcessEnv,
  'NEXT_PUBLIC_API_BASE_URL' | 'NEXT_PUBLIC_ENABLE_DEMO_FALLBACK' | 'NODE_ENV'
>;

const defaultRawWebProcessEnv: RawWebProcessEnv = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: process.env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK,
  NODE_ENV: process.env.NODE_ENV
};

function readRequiredUrl(
  value: string | undefined,
  key: 'NEXT_PUBLIC_API_BASE_URL'
): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new Error(`[web env] ${key} is required.`);
  }

  try {
    const url = new URL(normalizedValue);
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`[web env] ${key} must be a valid URL.`);
  }
}

export function readWebEnv(source: RawWebProcessEnv): WebEnv {
  return {
    NEXT_PUBLIC_API_BASE_URL: readRequiredUrl(
      source.NEXT_PUBLIC_API_BASE_URL,
      'NEXT_PUBLIC_API_BASE_URL'
    ),
    NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: readBooleanFlag(source.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK, false)
  };
}

export function createWebRuntime(
  source: Pick<RawWebProcessEnv, 'NODE_ENV'>,
  env: WebEnv
): WebRuntime {
  const nodeEnv = source.NODE_ENV ?? 'development';

  return {
    nodeEnv,
    demoFallbackEnabled: nodeEnv !== 'production' && env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK
  };
}

export const webEnv: WebEnv = readWebEnv(defaultRawWebProcessEnv);

export const webRuntime: WebRuntime = createWebRuntime(defaultRawWebProcessEnv, webEnv);

export function readBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new Error('[web env] NEXT_PUBLIC_ENABLE_DEMO_FALLBACK must be a boolean value.');
}
