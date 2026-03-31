'use client';

import { Chip } from '@mui/material';

const colorMap: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'primary' | 'info'
> = {
  POSTED: 'success',
  CORRECTED: 'info',
  REVERSED: 'warning',
  SUPERSEDED: 'warning',
  OPEN: 'success',
  IN_REVIEW: 'info',
  CLOSING: 'warning',
  LOCKED: 'default',
  ACTIVE: 'primary',
  PENDING: 'warning',
  CANCELLED: 'error',
  PAUSED: 'warning'
};

const labelMap: Record<string, string> = {
  POSTED: '확정',
  CORRECTED: '정정됨',
  REVERSED: '반전됨',
  SUPERSEDED: '대체됨',
  OPEN: '운영 중',
  IN_REVIEW: '검토 중',
  CLOSING: '마감 중',
  LOCKED: '잠금',
  ACTIVE: '활성',
  PENDING: '대기',
  CANCELLED: '중지',
  PAUSED: '일시중지'
};

export function StatusChip({ label }: { label: string }) {
  return (
    <Chip
      label={labelMap[label] ?? label}
      color={colorMap[label] ?? 'default'}
      size="small"
    />
  );
}
