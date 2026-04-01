'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { RecurringRuleItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { StatusChip } from '@/shared/ui/status-chip';
import { RecurringRuleForm } from './recurring-rule-form';
import { getRecurringRules, recurringRulesQueryKey } from './recurring-rules.api';

const frequencyLabelMap: Record<string, string> = {
  WEEKLY: '매주',
  MONTHLY: '매월',
  QUARTERLY: '분기',
  YEARLY: '매년'
};

const columns: GridColDef<RecurringRuleItem>[] = [
  { field: 'title', headerName: '제목', flex: 1.2 },
  {
    field: 'amountWon',
    headerName: '금액',
    flex: 1,
    valueFormatter: (value) => formatWon(Number(value))
  },
  {
    field: 'frequency',
    headerName: '주기',
    flex: 0.8,
    valueFormatter: (value) => frequencyLabelMap[String(value)] ?? String(value)
  },
  {
    field: 'nextRunDate',
    headerName: '다음 실행일',
    flex: 1,
    valueFormatter: (value) => formatDate(String(value))
  },
  { field: 'fundingAccountName', headerName: '자금수단', flex: 1 },
  { field: 'categoryName', headerName: '카테고리', flex: 1 },
  {
    field: 'isActive',
    headerName: '규칙 상태',
    flex: 0.7,
    renderCell: (params) => <StatusChip label={params.value ? '활성' : '중지'} />
  }
];

export function RecurringRulesPage() {
  const [isCreateDrawerOpen, setCreateDrawerOpen] = React.useState(false);
  const { data = [], error } = useQuery({
    queryKey: recurringRulesQueryKey,
    queryFn: getRecurringRules
  });

  useDomainHelp({
    title: '반복 규칙 개요',
    description:
      '반복 규칙 화면은 계획 데이터의 입력 영역입니다. 미래 일정과 금액 기준을 정의하지만, 이 화면 자체가 공식 회계 대상을 만들지는 않습니다.',
    primaryEntity: '반복 규칙 (RecurringRule)',
    relatedEntities: [
      '계획 항목 (PlanItem)',
      '거래 유형 (TransactionType)',
      '자금수단 (FundingAccount)',
      '카테고리 (Category)',
      '수집 거래 (CollectedTransaction)'
    ],
    truthSource:
      'RecurringRule과 PlanItem은 계획 기준이며, 회계 확정은 이후 수집 거래와 전표에서 이뤄집니다.',
    readModelNote:
      '현재 목록은 앞으로 생성될 계획 항목의 기준을 보여주는 운영 화면입니다.'
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 기준"
        title="반복 규칙"
        description="RecurringRule은 PlanItem 생성 기준이며, 실제 수집 거래와 전표와는 분리된 계획 엔티티입니다."
        primaryActionLabel="반복 규칙 등록"
        primaryActionOnClick={() => setCreateDrawerOpen(true)}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button component={Link} href="/plan-items" variant="outlined">
          계획 항목 보기
        </Button>
      </Stack>

      {error ? (
        <QueryErrorAlert
          title="반복 규칙 조회에 실패했습니다."
          error={error}
        />
      ) : null}

      <DataTableCard
        title="계획 생성 규칙"
        description="각 규칙은 미래 PlanItem을 만드는 기준입니다. 실제 거래와 전표는 별도 흐름에서 확정됩니다."
        rows={data}
        columns={columns}
      />

      <FormDrawer
        open={isCreateDrawerOpen}
        onClose={() => setCreateDrawerOpen(false)}
        title="반복 규칙 등록"
        description="계획 생성 기준을 추가하고, 이후 PlanItem과 실제 확정 흐름으로 연결합니다."
      >
        <RecurringRuleForm />
      </FormDrawer>
    </Stack>
  );
}
