'use client';

import { useQuery } from '@tanstack/react-query';
import { Grid, Stack } from '@mui/material';
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
  const currentWorkspace = user?.currentWorkspace ?? null;

  useDomainHelp({
    title: '기준 데이터와 참조 입력',
    description:
      '입출금 계정, 거래 분류, 계정과목, 거래 유형은 월 운영, 거래 입력, 전표 확정, 마감 보고에 공통으로 쓰이는 공식 기준 데이터입니다.',
    primaryEntity: '기준 데이터',
    relatedEntities: [
      '입출금 계정',
      '거래 분류',
      '계정과목',
      '거래 유형'
    ],
    truthSource:
      '현재 작업 문맥의 활성 기준 데이터만 각 입력 화면의 공식 선택지로 사용합니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '기준 데이터는 로그인한 사용자의 현재 사업 장부 문맥 안에서만 조회됩니다.',
        facts: [
          {
            label: '사업장',
            value: currentWorkspace
              ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
              : '-'
          },
          {
            label: '장부',
            value: currentWorkspace?.ledger?.name ?? '-'
          },
          {
            label: '권한',
            value: currentWorkspace?.membership.role ?? '-'
          }
        ]
      },
      {
        title: '참조 입력 원칙',
        description:
          '화면별 입력 폼은 여기서 조회되는 활성 기준 데이터만 선택지로 사용합니다.',
        items: [
          '수집 거래와 반복 규칙 폼은 이 화면에서 보이는 공식 기준 데이터만 사용합니다.',
          '입력 화면은 기준 데이터의 식별자와 정책 키를 참조하며, 임의 텍스트를 기준값으로 확정하지 않습니다.',
          '이 화면은 입력 기준을 검토하고 운영 문맥을 확인하기 위한 읽기 중심 화면입니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 각 입력 폼에서 참조하는 활성 기준 데이터를 확인하는 읽기 화면입니다.'
  });

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
        description="현재 사업 장부에서 사용하는 활성 기준 데이터를 한 번에 확인합니다."
      />

      {queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터 일부를 불러오지 못했습니다."
          error={queryErrors[0]}
        />
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="자금수단"
            description="거래 입력과 반복 규칙에서 입출금 계정으로 선택하는 기준 목록입니다."
            rows={fundingAccountsQuery.data ?? []}
            columns={fundingAccountColumns}
            height={320}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="카테고리"
            description="수입, 지출, 이체를 분류할 때 사용하는 기준 목록입니다."
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
            description="전표 라인과 마감 잔액 계산에서 공통으로 쓰는 공식 계정과목입니다."
            rows={accountSubjectsQuery.data ?? []}
            columns={accountSubjectColumns}
            height={360}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="거래유형"
            description="계획 항목과 수집 거래가 공통으로 참조하는 사업 거래 유형입니다."
            rows={ledgerTransactionTypesQuery.data ?? []}
            columns={ledgerTransactionTypeColumns}
            height={360}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
