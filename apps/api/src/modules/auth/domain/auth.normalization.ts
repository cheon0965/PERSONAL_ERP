import { validationError } from '../../../common/application/errors/app-error';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw validationError('이름을 입력해 주세요.');
  }

  return normalized;
}
