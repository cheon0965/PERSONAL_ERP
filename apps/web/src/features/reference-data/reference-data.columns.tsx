'use client';

import { Button, Chip, Stack, Typography } from '@mui/material';
import type {
  AccountSubjectItem,
  CategoryItem,
  FundingAccountItem,
  LedgerTransactionTypeItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { formatWon } from '@/shared/lib/format';
import {
  readCategoryKindLabel,
  readFundingAccountStatusColor,
  readFundingAccountStatusLabel,
  readFundingAccountTypeLabel
} from './reference-data.shared';

export const accountSubjectColumns: GridColDef<AccountSubjectItem>[] = [
  { field: 'code', headerName: '코드', flex: 0.5 },
  { field: 'name', headerName: '계정과목', flex: 1 },
  { field: 'statementType', headerName: '보고서', flex: 0.8 },
  { field: 'normalSide', headerName: '정상잔액', flex: 0.7 }
];

export const ledgerTransactionTypeColumns: GridColDef<LedgerTransactionTypeItem>[] =
  [
    { field: 'code', headerName: '코드', flex: 0.8 },
    { field: 'name', headerName: '거래유형', flex: 1 },
    { field: 'flowKind', headerName: '흐름', flex: 0.7 },
    { field: 'postingPolicyKey', headerName: '전표 정책', flex: 1.1 }
  ];

export function buildFundingAccountColumns(input: {
  canManageReferenceData: boolean;
  onEdit: (fundingAccount: FundingAccountItem) => void;
  onTransition: (
    fundingAccount: FundingAccountItem,
    nextStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  ) => void;
}): GridColDef<FundingAccountItem>[] {
  return [
    { field: 'name', headerName: '자금수단', flex: 1.2 },
    {
      field: 'type',
      headerName: '유형',
      flex: 0.7,
      valueFormatter: (value) => readFundingAccountTypeLabel(String(value))
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          label={readFundingAccountStatusLabel(params.row.status)}
          size="small"
          color={readFundingAccountStatusColor(params.row.status)}
          variant={params.row.status === 'ACTIVE' ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'balanceWon',
      headerName: '현재 잔액',
      flex: 0.8,
      valueFormatter: (value) => formatWon(Number(value ?? 0))
    },
    {
      field: 'actions',
      headerName: '관리',
      flex: 1.8,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        if (!input.canManageReferenceData) {
          return (
            <Typography variant="caption" color="text.secondary">
              소유자/관리자 전용
            </Typography>
          );
        }

        if (params.row.status === 'CLOSED') {
          return (
            <Typography variant="caption" color="text.secondary">
              종료 계정은 읽기 전용
            </Typography>
          );
        }

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              onClick={() => {
                input.onEdit(params.row);
              }}
            >
              수정
            </Button>
            <Button
              size="small"
              color={params.row.status === 'ACTIVE' ? 'warning' : 'success'}
              onClick={() => {
                input.onTransition(
                  params.row,
                  params.row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                );
              }}
            >
              {params.row.status === 'ACTIVE' ? '비활성화' : '재활성화'}
            </Button>
            {params.row.status === 'INACTIVE' ? (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  input.onTransition(params.row, 'CLOSED');
                }}
              >
                종료
              </Button>
            ) : null}
          </Stack>
        );
      }
    }
  ];
}

export function buildCategoryColumns(input: {
  canManageReferenceData: boolean;
  onEdit: (category: CategoryItem) => void;
  onToggle: (category: CategoryItem) => void;
}): GridColDef<CategoryItem>[] {
  return [
    { field: 'name', headerName: '카테고리', flex: 1.2 },
    {
      field: 'kind',
      headerName: '구분',
      flex: 0.8,
      valueFormatter: (value) => readCategoryKindLabel(String(value))
    },
    {
      field: 'isActive',
      headerName: '상태',
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          label={params.row.isActive ? '활성' : '비활성'}
          size="small"
          color={params.row.isActive ? 'success' : 'default'}
          variant={params.row.isActive ? 'filled' : 'outlined'}
        />
      )
    },
    {
      field: 'actions',
      headerName: '관리',
      flex: 1.3,
      sortable: false,
      filterable: false,
      renderCell: (params) =>
        input.canManageReferenceData ? (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              onClick={() => {
                input.onEdit(params.row);
              }}
            >
              수정
            </Button>
            <Button
              size="small"
              color={params.row.isActive ? 'warning' : 'success'}
              onClick={() => {
                input.onToggle(params.row);
              }}
            >
              {params.row.isActive ? '비활성화' : '재활성화'}
            </Button>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            소유자/관리자 전용
          </Typography>
        )
    }
  ];
}
