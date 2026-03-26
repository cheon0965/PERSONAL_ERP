import { webEnv, webRuntime } from '../config/env';

const API_BASE_URL = webEnv.NEXT_PUBLIC_API_BASE_URL;

export async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  return fetchJsonWithConfig(path, fallback, {
    apiBaseUrl: API_BASE_URL,
    demoFallbackEnabled: webRuntime.demoFallbackEnabled,
    fetchImpl: fetch
  });
}

type FetchJsonConfig = {
  apiBaseUrl: string;
  demoFallbackEnabled: boolean;
  fetchImpl: typeof fetch;
};

export async function fetchJsonWithConfig<T>(
  path: string,
  fallback: T,
  config: FetchJsonConfig
): Promise<T> {
  try {
    const response = await config.fetchImpl(`${config.apiBaseUrl}${path}`, {
      next: { revalidate: 0 },
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (config.demoFallbackEnabled) {
      console.warn(`[personal-erp] demo fallback data used for ${path}`, error);
      return fallback;
    }

    throw new Error(buildRequestFailureMessage(path, error));
  }
}

export function buildRequestFailureMessage(path: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : 'Unknown request error';
  return [
    `[personal-erp] Request failed for ${path}.`,
    detail,
    'Demo fallback is disabled.',
    'Start the API server or set NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true in <PERSONAL_ERP_SECRET_DIR>/web.env (or apps/web/.env.local) during local development.'
  ].join(' ');
}
