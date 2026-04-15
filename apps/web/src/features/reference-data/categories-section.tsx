'use client';

import * as React from 'react';
import { Button, Chip, Stack, Typography } from '@mui/material';
import type { CategoryItem } from '@personal-erp/contracts';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { buildCategoryColumns } from './reference-data.columns';
import { readCategoryKindLabel } from './reference-data.shared';

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
  const activitySummary = React.useMemo(() => {
    const activeCount = rows.filter((row) => row.isActive).length;

    return [
      { label: '활성', count: activeCount, color: 'success' as const },
      {
        label: '비활성',
        count: rows.length - activeCount,
        color: 'default' as const
      }
    ].filter((item) => item.count > 0);
  }, [rows]);
  const kindSummary = React.useMemo(() => {
    const kindOrder: CategoryItem['kind'][] = ['INCOME', 'EXPENSE', 'TRANSFER'];

    return kindOrder
      .map((kind) => ({
        kind,
        count: rows.filter((row) => row.kind === kind).length
      }))
      .filter((item) => item.count > 0);
  }, [rows]);

  return (
    <DataTableCard
      title="카테고리"
      description="수입, 지출, 이체를 분류할 때 사용하는 공식 카테고리 목록입니다."
      actions={
        canManageReferenceData ? (
          <Button variant="contained" size="small" onClick={onCreate}>
            카테고리 추가
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
            {activitySummary.map((item) => (
              <Chip
                key={item.label}
                label={`${item.label} ${item.count}개`}
                size="small"
                color={item.color}
                variant={item.label === '활성' ? 'filled' : 'outlined'}
              />
            ))}
            {kindSummary.map((item) => (
              <Chip
                key={item.kind}
                label={`${readCategoryKindLabel(item.kind)} ${item.count}개`}
                size="small"
                variant="outlined"
              />
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            비활성 카테고리는 기존 기록은 유지하고 새 입력 선택지에서 제외될 수 있습니다.
          </Typography>
        </Stack>
      }
      rows={rows}
      columns={columns}
      height={360}
    />
  );
}
