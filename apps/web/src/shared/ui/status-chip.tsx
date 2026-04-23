'use client';

import { Chip } from '@mui/material';

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

export function resolveStatusLabel(label: string): string {
  return labelMap[label] ?? label;
}

export function StatusChip({ label }: { label: string }) {
  return (
    <Chip
      label={resolveStatusLabel(label)}
      color={colorMap[label] ?? 'default'}
      size="small"
    />
  );
}
