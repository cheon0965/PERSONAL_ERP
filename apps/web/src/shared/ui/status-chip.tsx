'use client';

import { Chip, type ChipProps } from '@mui/material';

const colorMap: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'primary' | 'info'
> = {
  COLLECTED: 'warning',
  REVIEWED: 'info',
  READY_TO_POST: 'primary',
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
  PAUSED: 'warning',
  PAID_OFF: 'success',
  ARCHIVED: 'default',
  SCHEDULED: 'info',
  PLANNED: 'primary',
  MATCHED: 'primary',
  SKIPPED: 'warning'
};

const labelMap: Record<string, string> = {
  COLLECTED: '수집됨',
  REVIEWED: '검토됨',
  READY_TO_POST: '전표 준비',
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
  PAUSED: '일시중지',
  PAID_OFF: '완납',
  ARCHIVED: '보관',
  SCHEDULED: '예정',
  PLANNED: '계획',
  MATCHED: '거래 연결',
  SKIPPED: '건너뜀'
};

const filledStatuses = new Set([
  'ACTIVE',
  'OPEN',
  'POSTED',
  'READY_TO_POST',
  'MATCHED',
  'PAID_OFF',
  'CANCELLED'
]);

export function resolveStatusLabel(label: string): string {
  return labelMap[label] ?? label;
}

export function StatusChip({ label }: { label: string }) {
  const color = colorMap[label] ?? 'default';
  const variant: ChipProps['variant'] = filledStatuses.has(label)
    ? 'filled'
    : 'outlined';

  return (
    <Chip
      label={resolveStatusLabel(label)}
      color={color}
      variant={variant}
      size="small"
      sx={{ minWidth: 68 }}
    />
  );
}
