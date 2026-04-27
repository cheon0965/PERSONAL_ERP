'use client';

import * as React from 'react';

export type AccountAvatarOption = {
  key: string;
  label: string;
  glyph: string;
  backgroundColor: string;
  color: string;
};

export const accountAvatarOptions: readonly AccountAvatarOption[] = [
  {
    key: 'default',
    label: '기본',
    glyph: '',
    backgroundColor: '#e2e8f0',
    color: '#0f172a'
  },
  {
    key: 'briefcase',
    label: '서류가방',
    glyph: '💼',
    backgroundColor: '#dbeafe',
    color: '#1d4ed8'
  },
  {
    key: 'ledger',
    label: '장부',
    glyph: '📘',
    backgroundColor: '#dcfce7',
    color: '#166534'
  },
  {
    key: 'receipt',
    label: '영수증',
    glyph: '🧾',
    backgroundColor: '#fef3c7',
    color: '#92400e'
  },
  {
    key: 'rocket',
    label: '로켓',
    glyph: '🚀',
    backgroundColor: '#ede9fe',
    color: '#6d28d9'
  },
  {
    key: 'tools',
    label: '도구',
    glyph: '🛠',
    backgroundColor: '#fee2e2',
    color: '#b91c1c'
  }
] as const;

const avatarStorageKeyPrefix = 'personal-erp.account-avatar';

export function useAccountAvatar(
  userId: string | null | undefined,
  fallbackName: string | null | undefined
) {
  const [avatarKey, setAvatarKeyState] = React.useState<string>('default');

  React.useEffect(() => {
    if (!userId) {
      setAvatarKeyState('default');
      return;
    }

    try {
      const storedAvatarKey = window.localStorage.getItem(
        readAvatarStorageKey(userId)
      );
      setAvatarKeyState(
        storedAvatarKey && hasAvatarOption(storedAvatarKey)
          ? storedAvatarKey
          : 'default'
      );
    } catch {
      setAvatarKeyState('default');
    }
  }, [userId]);

  const selectedAvatar =
    accountAvatarOptions.find((option) => option.key === avatarKey) ??
    accountAvatarOptions[0];
  const fallbackInitial =
    fallbackName?.trim().slice(0, 1).toUpperCase() ?? 'U';

  const setAvatarKey = React.useCallback(
    (nextAvatarKey: string) => {
      const normalizedKey = hasAvatarOption(nextAvatarKey)
        ? nextAvatarKey
        : 'default';
      setAvatarKeyState(normalizedKey);

      if (!userId) {
        return;
      }

      try {
        if (normalizedKey === 'default') {
          window.localStorage.removeItem(readAvatarStorageKey(userId));
          return;
        }

        window.localStorage.setItem(
          readAvatarStorageKey(userId),
          normalizedKey
        );
      } catch {
        // 저장소 오류는 무시하고 현재 UI 상태를 유지한다.
      }
    },
    [userId]
  );

  return {
    avatarKey,
    avatarContent: selectedAvatar?.glyph || fallbackInitial,
    avatarLabel: selectedAvatar?.label ?? '기본',
    avatarSx: {
      bgcolor: selectedAvatar?.backgroundColor ?? '#e2e8f0',
      color: selectedAvatar?.glyph ? selectedAvatar.color : '#0f172a'
    },
    selectedAvatar,
    setAvatarKey
  };
}

function readAvatarStorageKey(userId: string) {
  return `${avatarStorageKeyPrefix}:${userId}`;
}

function hasAvatarOption(candidate: string) {
  return accountAvatarOptions.some((option) => option.key === candidate);
}
