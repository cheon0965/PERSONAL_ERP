'use client';

import { Chip } from '@mui/material';

const colorMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'primary'> = {
  POSTED: 'success',
  ACTIVE: 'primary',
  PENDING: 'warning',
  CANCELLED: 'error'
};

export function StatusChip({ label }: { label: string }) {
  return <Chip label={label} color={colorMap[label] ?? 'default'} size="small" />;
}
