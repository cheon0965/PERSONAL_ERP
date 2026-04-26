'use client';

import * as React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import type {
  AccountingPeriodItem,
  ImportBatchItem
} from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildImportBatchColumns } from './imports.columns';
import { readImportBatchParseStatusLabel } from './imports.shared';

export function ImportBatchesGrid({
  batches,
  currentPeriod,
  selectedBatchId,
  onSelectBatch,
  helperText = '선택한 배치 기준으로 업로드 행 작업대로 바로 이동합니다.',
  actionLabel = '작업대 열기'
}: {
  batches: ImportBatchItem[];
  currentPeriod: AccountingPeriodItem | null;
  selectedBatchId: string | null;
  onSelectBatch: (batch: ImportBatchItem) => void;
  helperText?: string;
  actionLabel?: string;
}) {
  const statusSummary = React.useMemo(() => {
    const counts: Record<ImportBatchItem['parseStatus'], number> = {
      COMPLETED: 0,
      PARTIAL: 0,
      FAILED: 0,
      PENDING: 0
    };

    batches.forEach((batch) => {
      counts[batch.parseStatus] += 1;
    });

    const order: ImportBatchItem['parseStatus'][] = [
      'COMPLETED',
      'PARTIAL',
      'FAILED',
      'PENDING'
    ];

    return order
      .map((status) => ({ status, count: counts[status] }))
      .filter((item) => item.count > 0);
  }, [batches]);

  return (
    <DataTableCard
      title="업로드 배치"
      description="최근 배치를 확인하고, 선택한 배치의 업로드 행을 바로 검토합니다."
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip
              label={`전체 ${batches.length}건`}
              size="small"
              variant="outlined"
            />
            {statusSummary.map((item) => (
              <Chip
                key={item.status}
                label={`${readImportBatchParseStatusLabel(item.status)} ${item.count}건`}
                size="small"
                color={
                  item.status === 'COMPLETED'
                    ? 'success'
                    : item.status === 'PARTIAL'
                      ? 'warning'
                      : item.status === 'FAILED'
                        ? 'error'
                        : 'default'
                }
                variant={item.status === 'COMPLETED' ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {helperText}
          </Typography>
        </Stack>
      }
      rows={batches}
      columns={buildImportBatchColumns({
        currentPeriod,
        selectedBatchId,
        onSelectBatch,
        actionLabel
      })}
      height={360}
    />
  );
}
