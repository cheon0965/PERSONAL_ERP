'use client';

import * as React from 'react';
import { Button } from '@mui/material';
import type { CategoryItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildCategoryColumns } from './reference-data.columns';

export function CategoriesSection({
  rows,
  canManageReferenceData,
  onCreate,
  onEdit,
  onToggle
}: {
  rows: CategoryItem[];
  canManageReferenceData: boolean;
  onCreate: () => void;
  onEdit: (category: CategoryItem) => void;
  onToggle: (category: CategoryItem) => void;
}) {
  const columns = React.useMemo(
    () =>
      buildCategoryColumns({
        canManageReferenceData,
        onEdit,
        onToggle
      }),
    [canManageReferenceData, onEdit, onToggle]
  );

  return (
    <DataTableCard
      title="카테고리"
      description="수입, 지출, 이체를 분류할 때 사용하는 기준 목록입니다. 현재 범위에서는 생성, 이름 수정, 비활성화/재활성화를 지원합니다."
      actions={
        canManageReferenceData ? (
          <Button variant="contained" size="small" onClick={onCreate}>
            카테고리 추가
          </Button>
        ) : null
      }
      rows={rows}
      columns={columns}
      height={360}
    />
  );
}
