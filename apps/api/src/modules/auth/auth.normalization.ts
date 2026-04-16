import { BadRequestException } from '@nestjs/common';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDisplayName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new BadRequestException('이름을 입력해 주세요.');
  }

  return normalized;
}
