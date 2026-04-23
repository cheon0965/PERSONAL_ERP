'use client';

import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';
import { StatusChip } from '@/shared/ui/status-chip';
import type { ImportedRowTableItem } from './imports.shared';

export function ImportedRowStatusCell({
  row,
  selectedRowId,
  onPrepare
}: {
  row: ImportedRowTableItem;
  selectedRowId: string | null;
  onPrepare: (row: ImportedRowTableItem) => void;
}) {
  if (row.collectionSummary) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <StatusChip
          label={row.collectionSummary.createdCollectedTransactionStatus}
        />
        <Button
          size="small"
          component={Link}
          href={`/transactions?transactionId=${row.collectionSummary.createdCollectedTransactionId}`}
        >
          보기
        </Button>
      </Stack>
    );
  }

  if (row.parseStatus !== 'PARSED') {
    return (
      <Typography variant="body2" color="error.main">
        오류 보류
      </Typography>
    );
  }

  if (!row.isCurrentPeriodRow) {
    return (
      <Typography variant="body2" color="text.secondary">
        운영월 밖
      </Typography>
    );
  }

  return (
    <Button
      size="small"
      variant={selectedRowId === row.id ? 'contained' : 'text'}
      onClick={() => onPrepare(row)}
    >
      거래 등록
    </Button>
  );
}
