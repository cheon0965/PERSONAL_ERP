'use client';

import * as React from 'react';
import { Button } from '@mui/material';
import type { FundingAccountItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildFundingAccountColumns } from './reference-data.columns';

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

  return (
    <DataTableCard
      title="자금수단"
      description="거래 입력과 반복 규칙에서 입출금 계정으로 선택하는 기준 목록입니다. 현재 범위에서는 생성, 이름 수정, 비활성화/재활성화, 비활성 자금수단 종료를 지원합니다."
      actions={
        canManageReferenceData ? (
          <Button variant="contained" size="small" onClick={onCreate}>
            자금수단 추가
          </Button>
        ) : null
      }
      rows={rows}
      columns={columns}
      height={360}
    />
  );
}
