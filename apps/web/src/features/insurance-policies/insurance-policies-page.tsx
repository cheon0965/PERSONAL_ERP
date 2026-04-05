'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Grid, Stack } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { StatusChip } from '@/shared/ui/status-chip';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  getInsurancePolicies,
  insurancePoliciesQueryKey
} from './insurance-policies.api';
import { InsurancePolicyForm } from './insurance-policy-form';

const cycleLabelMap: Record<string, string> = {
  MONTHLY: '매월',
  YEARLY: '매년'
};

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type InsurancePolicyDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; insurancePolicy: InsurancePolicyItem }
  | null;

export function InsurancePoliciesPage() {
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<InsurancePolicyDrawerState>(null);
  const { data = [], error } = useQuery({
    queryKey: insurancePoliciesQueryKey,
    queryFn: () => getInsurancePolicies({ includeInactive: true })
  });

  const activePolicies = data.filter((policy) => policy.isActive);
  const totalPremium = activePolicies.reduce(
    (acc, item) => acc + item.monthlyPremiumWon,
    0
  );
  const inactivePolicyCount = data.filter((item) => !item.isActive).length;
  const upcomingRenewalCount = activePolicies.filter((item) => {
    if (!item.renewalDate) {
      return false;
    }

    const diffDays =
      (new Date(item.renewalDate).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);

    return diffDays >= 0 && diffDays <= 60;
  }).length;

  useDomainHelp({
    title: '보험 계약 개요',
    description:
      '보험 화면은 공식 장부가 아니라 추후 계획 지출과 실제 지급 흐름을 잇는 보조 화면입니다.',
    primaryEntity: '보험 계약 보조 데이터',
    relatedEntities: ['반복 규칙', '계획 항목', '수집 거래', '전표'],
    truthSource:
      '보험 계약 자체는 회계 저장이 아니며 실제 회계 확정은 수집 거래와 전표에서 이뤄집니다.',
    readModelNote: '월 보험료와 갱신일은 운영 판단을 위한 보조 지표입니다.'
  });

  const handleCreateOpen = React.useCallback(() => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }, []);

  const handleEditOpen = React.useCallback(
    (insurancePolicy: InsurancePolicyItem) => {
      setFeedback(null);
      setDrawerState({ mode: 'edit', insurancePolicy });
    },
    []
  );

  const handleDrawerClose = React.useCallback(() => {
    setDrawerState(null);
  }, []);

  const handleFormCompleted = React.useCallback(
    (insurancePolicy: InsurancePolicyItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      setFeedback({
        severity: 'success',
        message:
          mode === 'edit'
            ? `${insurancePolicy.productName} 보험 계약을 수정했습니다.`
            : `${insurancePolicy.productName} 보험 계약을 등록했습니다.`
      });
    },
    []
  );

  const columns = React.useMemo<GridColDef<InsurancePolicyItem>[]>(
    () => [
      { field: 'provider', headerName: '보험사', flex: 1 },
      { field: 'productName', headerName: '상품명', flex: 1.4 },
      {
        field: 'monthlyPremiumWon',
        headerName: '월 보험료',
        flex: 1,
        valueFormatter: (value) => formatWon(Number(value))
      },
      { field: 'paymentDay', headerName: '납부일', flex: 0.7 },
      {
        field: 'cycle',
        headerName: '주기',
        flex: 0.8,
        valueFormatter: (value) => cycleLabelMap[String(value)] ?? String(value)
      },
      {
        field: 'renewalDate',
        headerName: '갱신일',
        flex: 1,
        valueFormatter: (value) => (value ? formatDate(String(value)) : '-')
      },
      {
        field: 'isActive',
        headerName: '상태',
        flex: 0.8,
        renderCell: (params) => (
          <StatusChip label={params.value ? '활성' : '비활성'} />
        )
      },
      {
        field: 'actions',
        headerName: '동작',
        flex: 1,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              handleEditOpen(params.row);
            }}
          >
            수정
          </Button>
        )
      }
    ],
    [handleEditOpen]
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '보험 계약 수정' : '보험 계약 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? '보험 계약의 상태와 기준 필드를 조정해 운영 판단 흐름에 반영합니다.'
      : '보험 계약 보조 데이터를 추가하고 반복 지출 검토 흐름의 기준을 보강합니다.';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title="보험 계약"
        description="보험 계약은 핵심 회계 데이터 자체가 아니라 반복 규칙과 실제 지급 흐름을 설명하는 운영 보조 데이터로 관리합니다."
        primaryActionLabel="보험 계약 등록"
        primaryActionOnClick={handleCreateOpen}
      />
      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {error ? (
        <QueryErrorAlert title="보험 정보 조회에 실패했습니다." error={error} />
      ) : null}
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="활성 월 보험 계획액"
            value={formatWon(totalPremium)}
            subtitle="현재 활성 보험 계약 기준 월 계획액 합계"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="관리 중 계약 수"
            value={String(data.length)}
            subtitle="활성/비활성 포함 전체 보험 계약"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SummaryCard
            title="가까운 갱신 / 비활성"
            value={`${upcomingRenewalCount} / ${inactivePolicyCount}`}
            subtitle="60일 이내 갱신 예정 계약 수와 비활성 계약 수"
          />
        </Grid>
      </Grid>
      <DataTableCard
        title="보험 계약 목록"
        description="계약 자체를 회계 저장으로 취급하지 않고, 계획과 검토에 필요한 필드와 활성 상태를 함께 보여줍니다."
        rows={data}
        columns={columns}
      />

      <FormDrawer
        open={drawerState !== null}
        onClose={handleDrawerClose}
        title={drawerTitle}
        description={drawerDescription}
      >
        {drawerState?.mode === 'edit' ? (
          <InsurancePolicyForm
            mode="edit"
            initialPolicy={drawerState.insurancePolicy}
            onCompleted={handleFormCompleted}
          />
        ) : (
          <InsurancePolicyForm
            mode="create"
            onCompleted={handleFormCompleted}
          />
        )}
      </FormDrawer>
    </Stack>
  );
}
