import type { AccountProfileItem } from '@personal-erp/contracts';

export type AuthAccountProfileRecord = {
  id: string;
  email: string;
  name: string;
  emailVerifiedAt: Date | null;
  settings: { timezone?: string } | null;
};

export function mapAccountProfileItem(
  user: AuthAccountProfileRecord,
  fallbackTimezone: string
): AccountProfileItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    preferredTimezone: user.settings?.timezone ?? fallbackTimezone
  };
}

export function normalizeAccountEventMetadata(
  value: unknown
): Record<string, string | number | boolean | null> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, candidate]) => {
      if (
        typeof candidate === 'string' ||
        typeof candidate === 'number' ||
        typeof candidate === 'boolean' ||
        candidate === null
      ) {
        return [[key, candidate]];
      }

      return [];
    })
  );
}
