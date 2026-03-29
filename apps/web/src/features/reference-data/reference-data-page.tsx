'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack, Typography } from '@mui/material';
import type {
  AccountSubjectItem,
  CategoryItem,
  FundingAccountItem,
  LedgerTransactionTypeItem
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountSubjectsQueryKey,
  categoriesQueryKey,
  fundingAccountsQueryKey,
  getAccountSubjects,
  getCategories,
  getFundingAccounts,
  getLedgerTransactionTypes,
  ledgerTransactionTypesQueryKey
} from './reference-data.api';

const fundingAccountColumns: GridColDef<FundingAccountItem>[] = [
  { field: 'name', headerName: '자금수단', flex: 1.2 },
  { field: 'type', headerName: '유형', flex: 0.6 },
  {
    field: 'balanceWon',
    headerName: '현재 잔액',
    flex: 0.8,
    valueFormatter: (value) => formatWon(Number(value ?? 0))
  }
];

const categoryColumns: GridColDef<CategoryItem>[] = [
  { field: 'name', headerName: '카테고리', flex: 1.1 },
  { field: 'kind', headerName: '구분', flex: 0.7 }
];

const accountSubjectColumns: GridColDef<AccountSubjectItem>[] = [
  { field: 'code', headerName: '코드', flex: 0.5 },
  { field: 'name', headerName: '계정과목', flex: 1 },
  { field: 'statementType', headerName: '보고서', flex: 0.8 },
  { field: 'normalSide', headerName: '정상잔액', flex: 0.7 }
];

const ledgerTransactionTypeColumns: GridColDef<LedgerTransactionTypeItem>[] = [
  { field: 'code', headerName: '코드', flex: 0.8 },
  { field: 'name', headerName: '거래유형', flex: 1 },
  { field: 'flowKind', headerName: '흐름', flex: 0.7 },
  { field: 'postingPolicyKey', headerName: '전표 정책', flex: 1.1 }
];

export function ReferenceDataPage() {
  const { user } = useAuthSession();
  const fundingAccountsQuery = useQuery({
    queryKey: fundingAccountsQueryKey,
    queryFn: getFundingAccounts
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey,
    queryFn: getCategories
  });
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const ledgerTransactionTypesQuery = useQuery({
    queryKey: ledgerTransactionTypesQueryKey,
    queryFn: getLedgerTransactionTypes
  });

  useDomainHelp({
    title: '기준 데이터와 참조 입력',
    description:
      'FundingAccount, Category, AccountSubject, LedgerTransactionType는 기간 운영, 수집 거래 입력, 전표 확정, 마감 보고에 공통으로 쓰이는 공식 기준 데이터입니다.',
    primaryEntity: '기준 데이터 (Reference Data)',
    relatedEntities: [
      '자금수단 (FundingAccount)',
      '카테고리 (Category)',
      '계정과목 (AccountSubject)',
      '거래유형 (LedgerTransactionType)'
    ],
    truthSource:
      '현재 작업 Tenant / Ledger 문맥 안의 활성 기준 데이터만 참조 입력에 사용합니다.',
    readModelNote:
      '이번 라운드에서는 읽기와 확인 경로를 먼저 고정하고, 이후 라운드에서 관리 기능을 점진적으로 확장합니다.'
  });

  const currentWorkspace = user?.currentWorkspace ?? null;
  const queryErrors = [
    fundingAccountsQuery.error,
    categoriesQuery.error,
    accountSubjectsQuery.error,
    ledgerTransactionTypesQuery.error
  ].filter(Boolean);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터와 참조 입력"
        description="현재 작업 Ledger 안에서 사용하는 자금수단, 카테고리, 계정과목, 거래유형을 공식 조회 기준으로 고정합니다."
      />

      {queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터 일부를 불러오지 못했습니다."
          error={queryErrors[0]}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            title="현재 작업 문맥"
            description="기준 데이터는 로그인한 사용자의 현재 TenantMembership / Ledger 문맥 안에서만 조회됩니다."
          >
            <Stack spacing={1}>
              <InfoRow
                label="Tenant"
                value={
                  currentWorkspace
                    ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
                    : '-'
                }
              />
              <InfoRow
                label="Ledger"
                value={currentWorkspace?.ledger?.name ?? '-'}
              />
              <InfoRow
                label="권한"
                value={currentWorkspace?.membership.role ?? '-'}
              />
            </Stack>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard
            title="Round 3 기준"
            description="이번 라운드의 목표는 기준 데이터 조회와 참조 입력 기준선을 잠그는 것입니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                수집 거래와 반복 규칙 폼은 이 화면에서 보이는 공식 기준 데이터만 사용합니다.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기준 데이터의 깊은 CRUD는 이후 라운드에서 점진적으로 확장합니다.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="자금수단"
            description="수집 거래와 반복 규칙 입력 시 선택하는 FundingAccount 목록입니다."
            rows={fundingAccountsQuery.data ?? []}
            columns={fundingAccountColumns}
            height={320}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="카테고리"
            description="수입/지출/이체 분류에 사용하는 Category 목록입니다."
            rows={categoriesQuery.data ?? []}
            columns={categoryColumns}
            height={320}
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="계정과목"
            description="JournalLine과 BalanceSnapshotLine이 참조하는 공식 AccountSubject 목록입니다."
            rows={accountSubjectsQuery.data ?? []}
            columns={accountSubjectColumns}
            height={360}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="거래유형"
            description="CollectedTransaction과 PlanItem이 참조하는 LedgerTransactionType 목록입니다."
            rows={ledgerTransactionTypesQuery.data ?? []}
            columns={ledgerTransactionTypeColumns}
            height={360}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}

function InfoRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Stack>
  );
}
