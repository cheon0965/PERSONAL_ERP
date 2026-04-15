'use client';

import * as React from 'react';
import { Button, Chip, Stack, Typography } from '@mui/material';
import type { FundingAccountItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildFundingAccountColumns } from './reference-data.columns';
import { readFundingAccountStatusLabel } from './reference-data.shared';

export function FundingAccountsSection({
  rows,
  canManageReferenceData,
  onCreate,
  onEdit,
  onTransition
}: {
  rows: FundingAccountItem[];
  canManageReferenceData: boolean;
  onCreate: () => void;
  onEdit: (fundingAccount: FundingAccountItem) => void;
  onTransition: (
    fundingAccount: FundingAccountItem,
    nextStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  ) => void;
}) {
  const columns = React.useMemo(
    () =>
      buildFundingAccountColumns({
        canManageReferenceData,
        onEdit,
        onTransition
      }),
    [canManageReferenceData, onEdit, onTransition]
  );
  const statusSummary = React.useMemo(() => {
    const counts: Record<FundingAccountItem['status'], number> = {
      ACTIVE: 0,
      INACTIVE: 0,
      CLOSED: 0
    };

    rows.forEach((row) => {
      counts[row.status] += 1;
    });

    const statusOrder: FundingAccountItem['status'][] = [
      'ACTIVE',
      'INACTIVE',
      'CLOSED'
    ];

    return statusOrder
      .map((status) => ({ status, count: counts[status] }))
      .filter((item) => item.count > 0);
  }, [rows]);

  return (
    <DataTableCard
      title="자금수단"
      description="거래 입력과 반복 규칙에서 사용하는 입출금 계정 목록입니다."
      actions={
        canManageReferenceData ? (
          <Button variant="contained" size="small" onClick={onCreate}>
            자금수단 추가
          </Button>
        ) : null
      }
      toolbar={
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {statusSummary.map((item) => (
              <Chip
                key={item.status}
                label={`${readFundingAccountStatusLabel(item.status)} ${item.count}개`}
                size="small"
                color={
                  item.status === 'ACTIVE'
                    ? 'success'
                    : item.status === 'CLOSED'
                      ? 'error'
                      : 'default'
                }
                variant={item.status === 'ACTIVE' ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            활성 자금수단만 입력 화면의 기본 선택지로 노출됩니다.
          </Typography>
        </Stack>
      }
      rows={rows}
      columns={columns}
      height={360}
    />
  );
}
