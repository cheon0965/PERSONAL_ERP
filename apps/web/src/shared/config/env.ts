type WebEnv = {
  NEXT_PUBLIC_API_BASE_URL: string;
  NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: boolean;
};

type WebRuntime = {
  nodeEnv: string;
  demoFallbackEnabled: boolean;
};

function readRequiredUrl(source: NodeJS.ProcessEnv, key: keyof WebEnv): string {
  const value = source[key]?.trim();
  if (!value) {
    throw new Error(`[web env] ${key} is required.`);
  }

  try {
    const url = new URL(value);
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error(`[web env] ${key} must be a valid URL.`);
  }
}

export function readWebEnv(source: NodeJS.ProcessEnv): WebEnv {
  return {
    NEXT_PUBLIC_API_BASE_URL: readRequiredUrl(source, 'NEXT_PUBLIC_API_BASE_URL'),
    NEXT_PUBLIC_ENABLE_DEMO_FALLBACK: readBooleanFlag(source.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK, false)
  };
}

export const webEnv = Object.freeze(readWebEnv(process.env));
export function createWebRuntime(source: NodeJS.ProcessEnv, env: WebEnv): WebRuntime {
  const nodeEnv = source.NODE_ENV ?? 'development';

  return {
    nodeEnv,
    demoFallbackEnabled: nodeEnv !== 'production' && env.NEXT_PUBLIC_ENABLE_DEMO_FALLBACK
  };
}

export const webRuntime = Object.freeze(createWebRuntime(process.env, webEnv));

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
