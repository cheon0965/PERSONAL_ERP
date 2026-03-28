'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, MenuItem, Stack, TextField } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { DomainContextCard } from '@/shared/ui/domain-context-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import { TransactionForm } from './transaction-form';
import {
  collectedTransactionsQueryKey,
  getCollectedTransactions
} from './transactions.api';

const originLabelMap: Record<string, string> = {
  MANUAL: '직접 입력',
  RECURRING: '반복 규칙 생성',
  IMPORT: '파일 업로드'
};

const columns: GridColDef<CollectedTransactionItem>[] = [
  { field: 'businessDate', headerName: '거래일', flex: 0.8 },
  { field: 'title', headerName: '원천 설명', flex: 1.4 },
  { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
  { field: 'categoryName', headerName: '카테고리', flex: 1 },
  {
    field: 'sourceKind',
    headerName: '수집 원천',
    flex: 0.8,
    valueFormatter: (value) => originLabelMap[String(value)] ?? String(value)
  },
  {
    field: 'postingStatus',
    headerName: '전표 반영 상태',
    flex: 0.8,
    renderCell: (params) => <StatusChip label={String(params.value)} />
  },
  {
    field: 'amountWon',
    headerName: '금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  }
];

export function TransactionsPage() {
  const { data = [], error } = useQuery({
    queryKey: collectedTransactionsQueryKey,
    queryFn: getCollectedTransactions
  });
  const [keyword, setKeyword] = React.useState('');
  const [fundingAccountName, setFundingAccountName] = React.useState('');
  const [categoryName, setCategoryName] = React.useState('');

  const fundingAccountOptions = React.useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.fundingAccountName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [data]
  );
  const categoryOptions = React.useMemo(
    () =>
      Array.from(new Set(data.map((item) => item.categoryName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [data]
  );
  const filteredTransactions = React.useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return data.filter((item) => {
      const matchesKeyword =
        normalizedKeyword.length === 0 ||
        [item.title, item.categoryName, item.fundingAccountName]
          .join(' ')
          .toLowerCase()
          .includes(normalizedKeyword);
      const matchesFundingAccount =
        fundingAccountName.length === 0 || item.fundingAccountName === fundingAccountName;
      const matchesCategory =
        categoryName.length === 0 || item.categoryName === categoryName;

      return matchesKeyword && matchesFundingAccount && matchesCategory;
    });
  }, [categoryName, data, fundingAccountName, keyword]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="수집/확정"
        title="수집 거래"
        description="이 화면은 CollectedTransaction 읽기 모델입니다. 직접 입력이나 업로드로 들어온 원천 거래를 검토하고, 확정 후 JournalEntry로 이어지는 흐름을 다룹니다."
        primaryActionLabel="수집 거래 등록"
        primaryActionHref="#collected-transaction-form"
      />
      {error ? <QueryErrorAlert title="수집 거래 조회에 실패했습니다." error={error} /> : null}

      <DomainContextCard
        description="원천 거래는 회계 확정 데이터가 되기 전까지 관리하기 위해, 이 화면은 수집 단계의 흐름을 중점으로 해석합니다."
        primaryEntity="수집 거래 (CollectedTransaction)"
        relatedEntities={[
          '가져오기 배치 (ImportBatch / ImportedRow)',
          '거래 유형 (TransactionType)',
          '자금수단 (FundingAccount)',
          '카테고리 (Category)',
          '계획 항목 (PlanItem)',
          '전표 (JournalEntry)'
        ]}
        truthSource="회계의 단일 원천은 전표이며, 수집 거래는 확정 전 원천과 검토 상태를 보존합니다."
        readModelNote="현재 목록은 운영 화면으로 원천 설명과 전표 반영 상태를 함께 보여줍니다."
      />

      <SectionCard
        title="필터"
        description="검색어, 자금수단, 카테고리 기준으로 수집 거래를 좁혀볼 수 있는 영역입니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="검색어"
              size="small"
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="자금수단"
              size="small"
              value={fundingAccountName}
              onChange={(event) => {
                setFundingAccountName(event.target.value);
              }}
            >
              <MenuItem value="">전체</MenuItem>
              {fundingAccountOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="카테고리"
              size="small"
              value={categoryName}
              onChange={(event) => {
                setCategoryName(event.target.value);
              }}
            >
              <MenuItem value="">전체</MenuItem>
              {categoryOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <DataTableCard
            title="수집 거래 목록"
            description="원천 거래와 전표 반영 상태를 함께 보는 운영 목록입니다. 공식 회계 기준은 별도의 전표 엔티티에 있습니다."
            rows={filteredTransactions}
            columns={columns}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <div id="collected-transaction-form">
            <SectionCard
              title="수집 거래 등록"
              description="직접 입력으로 원천 거래를 등록하고, 이후 검토와 확정 흐름으로 이어집니다."
            >
              <TransactionForm />
            </SectionCard>
          </div>
        </Grid>
      </Grid>
    </Stack>
  );
}