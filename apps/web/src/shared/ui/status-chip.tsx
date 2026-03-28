'use client';

import { Chip } from '@mui/material';

const colorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'primary'> = {
  POSTED: 'success',
  ACTIVE: 'primary',
  PENDING: 'warning',
  CANCELLED: 'error',
  PAUSED: 'warning'
};

const labelMap: Record<string, string> = {
  POSTED: '확정',
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
