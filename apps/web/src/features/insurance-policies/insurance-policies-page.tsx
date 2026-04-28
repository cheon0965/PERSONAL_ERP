'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Stack } from '@mui/material';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { sumMoneyWon } from '@personal-erp/money';
import { webRuntime } from '@/shared/config/env';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  deleteInsurancePolicy,
  getInsurancePolicies,
  insurancePoliciesQueryKey,
  removeInsurancePolicyItem
} from './insurance-policies.api';
import {
  buildInsurancePolicyColumns,
  InsuranceDeleteDialog,
  InsurancePoliciesFilterToolbar,
  type InsurancePoliciesTableFilters,
  InsurancePolicyDrawer
} from './insurance-policies-page.sections';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type InsurancePolicyDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; insurancePolicy: InsurancePolicyItem }
  | null;

export function InsurancePoliciesPage() {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<InsurancePolicyDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<InsurancePolicyItem | null>(null);
  const [tableFilters, setTableFilters] =
    React.useState<InsurancePoliciesTableFilters>({
      keyword: '',
      status: '',
      linkStatus: '',
      cycle: '',
      fundingAccountName: '',
      categoryName: ''
    });
  const { data = [], error } = useQuery({
    queryKey: insurancePoliciesQueryKey,
    queryFn: () => getInsurancePolicies({ includeInactive: true })
  });
  const filteredData = React.useMemo(
    () => filterInsurancePolicies(data, tableFilters),
    [data, tableFilters]
  );
  const filterOptions = React.useMemo(
    () => ({
      fundingAccountNames: readUniqueSortedValues(
        data.map((item) => item.fundingAccountName)
      ),
      categoryNames: readUniqueSortedValues(
        data.map((item) => item.categoryName)
      )
    }),
    [data]
  );

  const activePolicies = data.filter((policy) => policy.isActive);
  const totalPremium = sumMoneyWon(
    activePolicies.map((item) => item.monthlyPremiumWon)
  );
  const inactivePolicyCount = data.filter((item) => !item.isActive).length;
  const linkedPolicyCount = data.filter(
    (item) => item.linkedRecurringRuleId
  ).length;
  const unlinkedPolicyCount = data.length - linkedPolicyCount;

  const deleteMutation = useMutation({
    mutationFn: (insurancePolicy: InsurancePolicyItem) =>
      deleteInsurancePolicy(insurancePolicy.id),
    onSuccess: async (_response, insurancePolicy) => {
      setDeleteTarget(null);
      notifySuccess(
        insurancePolicy.linkedRecurringRuleId
          ? `${insurancePolicy.productName} 보험 계약과 연결된 반복 규칙을 함께 삭제했습니다.`
          : `${insurancePolicy.productName} 보험 계약을 삭제했습니다.`
      );

      queryClient.setQueryData<InsurancePolicyItem[]>(
        insurancePoliciesQueryKey,
        (current) => removeInsurancePolicyItem(current, insurancePolicy.id)
      );

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: insurancePoliciesQueryKey
          }),
          queryClient.invalidateQueries({ queryKey: ['recurring-rules'] }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ]);
      }
    },
    onError: (mutationError) => {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '보험 계약을 삭제하지 못했습니다.'
      });
    }
  });

  useDomainHelp({
    title: '보험 계약 사용 가이드',
    description:
      '이 화면은 매월 또는 매년 반복되는 보험료 기준을 정리하는 운영 화면입니다. 보험 계약을 저장하면 이후 계획 항목을 만들 반복 규칙까지 함께 관리됩니다.',
    primaryEntity: '보험 계약 보조 데이터',
    relatedEntities: ['반복 규칙', '계획 항목', '수집 거래', '전표'],
    truthSource:
      '보험 계약은 회계 확정 데이터가 아니며, 여기서 입력한 납부 기준만 연결된 반복 규칙에 반영됩니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '보험 계약 등록을 열고 보험사, 상품명, 월 보험료, 납부일을 입력합니다.',
          '자금수단, 카테고리, 반복 시작일을 채워 연결 반복 규칙이 바로 계획 생성에 쓰이게 합니다.',
          '목록에서 연결 규칙이 연결됨인지 확인합니다.',
          '보험료가 변경되면 보험 계약을 수정해 연결 반복 규칙도 함께 동기화합니다.',
          '더 이상 쓰지 않는 계약은 비활성화하거나 삭제해 이후 계획 생성에서 혼동을 줄입니다.'
        ]
      },
      {
        title: '다음 단계',
        items: [
          '보험 계약을 정리한 뒤 반복 규칙 화면에서 보험 계약 연동 규칙이 보이는지 확인합니다.',
          '월 운영이 열려 있으면 계획 항목 화면에서 보험료 계획을 생성합니다.',
          '실제 납부 거래는 수집 거래 또는 업로드 배치에서 전표로 확정합니다.'
        ],
        links: [
          {
            title: '반복 규칙',
            description:
              '보험 계약 저장 시 생성된 연결 반복 규칙 상태를 함께 확인합니다.',
            href: '/recurring',
            actionLabel: '반복 규칙 보기'
          },
          {
            title: '계획 항목',
            description:
              '현재 운영 월에서 보험료 계획이 실제로 생성됐는지 확인합니다.',
            href: '/plan-items',
            actionLabel: '계획 항목 보기'
          },
          {
            title: '수집 거래',
            description:
              '실제 납부 거래를 확인하고 전표 준비 상태로 이어서 검토합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          }
        ]
      }
    ],
    readModelNote:
      '이 화면에서는 보험료 지출을 전표로 확정하지 않습니다. 실제 회계 확정은 연결된 계획 항목, 수집 거래, 전표 흐름에서 진행합니다.'
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

  const handleDeleteOpen = React.useCallback(
    (insurancePolicy: InsurancePolicyItem) => {
      setFeedback(null);
      setDeleteTarget(insurancePolicy);
    },
    []
  );

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    setFeedback(null);
    void deleteMutation.mutateAsync(deleteTarget);
  }, [deleteMutation, deleteTarget]);

  const handleFormCompleted = React.useCallback(
    (insurancePolicy: InsurancePolicyItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      notifySuccess(
        mode === 'edit'
          ? `${insurancePolicy.productName} 보험 계약과 연결 규칙을 수정했습니다.`
          : `${insurancePolicy.productName} 보험 계약과 연결 규칙을 등록했습니다.`
      );
    },
    [notifySuccess]
  );

  const columns = React.useMemo(
    () =>
      buildInsurancePolicyColumns({
        onDelete: handleDeleteOpen,
        onEdit: handleEditOpen
      }),
    [handleDeleteOpen, handleEditOpen]
  );

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title="보험 계약"
        description="보험 계약은 반복 규칙과 함께 관리하는 기준 목록이며, 이후 계획 생성의 출발점으로 사용됩니다."
        badges={[
          {
            label: linkedPolicyCount
              ? `연결 완료 ${linkedPolicyCount}건`
              : '연결 규칙 점검 필요',
            color: linkedPolicyCount > 0 ? 'success' : 'warning'
          },
          {
            label: inactivePolicyCount
              ? `비활성 ${inactivePolicyCount}건`
              : '활성 계약만 관리 중'
          }
        ]}
        metadata={[
          {
            label: '활성 월 보험료',
            value: formatWon(totalPremium)
          },
          {
            label: '전체 계약',
            value: `${data.length}건`
          },
          {
            label: '미연결 계약',
            value: `${unlinkedPolicyCount}건`
          }
        ]}
        primaryActionLabel="보험 계약 등록"
        primaryActionOnClick={handleCreateOpen}
        secondaryActionLabel="반복 규칙 보기"
        secondaryActionHref="/recurring"
      />

      {feedback?.severity === 'error' ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}
      {unlinkedPolicyCount > 0 ? (
        <Alert severity="warning" variant="outlined">
          반복 규칙 연결 정보가 비어 있는 보험 계약이 {unlinkedPolicyCount}건
          있습니다. 수정 드로어에서 자금수단, 카테고리, 반복 시작일을 입력하면
          연결할 수 있습니다.
        </Alert>
      ) : null}
      {error ? (
        <QueryErrorAlert title="보험 정보 조회에 실패했습니다." error={error} />
      ) : null}

      <DataTableCard
        title="보험 계약 목록"
        description="보험 계약 저장 시 연결된 반복 규칙도 함께 관리합니다. 표에서 바로 수정하거나 삭제해 목록 중심으로 정리할 수 있습니다."
        toolbar={
          <InsurancePoliciesFilterToolbar
            activeCount={activePolicies.length}
            linkedCount={linkedPolicyCount}
            unlinkedCount={unlinkedPolicyCount}
            filters={tableFilters}
            fundingAccountOptions={filterOptions.fundingAccountNames}
            categoryOptions={filterOptions.categoryNames}
            onFiltersChange={setTableFilters}
          />
        }
        rows={filteredData}
        columns={columns}
      />

      <InsurancePolicyDrawer
        drawerState={drawerState}
        onClose={() => setDrawerState(null)}
        onCompleted={handleFormCompleted}
      />

      <InsuranceDeleteDialog
        busy={deleteMutation.isPending}
        deleteTarget={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </Stack>
  );
}

function filterInsurancePolicies(
  policies: InsurancePolicyItem[],
  filters: InsurancePoliciesTableFilters
) {
  const keyword = normalizeFilterText(filters.keyword);

  return policies.filter((policy) => {
    if (filters.status === 'ACTIVE' && !policy.isActive) {
      return false;
    }

    if (filters.status === 'INACTIVE' && policy.isActive) {
      return false;
    }

    if (filters.linkStatus === 'LINKED' && !policy.linkedRecurringRuleId) {
      return false;
    }

    if (filters.linkStatus === 'UNLINKED' && policy.linkedRecurringRuleId) {
      return false;
    }

    if (filters.cycle && policy.cycle !== filters.cycle) {
      return false;
    }

    if (
      filters.fundingAccountName &&
      policy.fundingAccountName !== filters.fundingAccountName
    ) {
      return false;
    }

    if (filters.categoryName && policy.categoryName !== filters.categoryName) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    const haystack = normalizeFilterText(
      [
        policy.provider,
        policy.productName,
        policy.cycle,
        policy.fundingAccountName,
        policy.categoryName,
        policy.isActive ? '활성 ACTIVE' : '비활성 INACTIVE',
        policy.linkedRecurringRuleId ? '연결 LINKED' : '미연결 UNLINKED'
      ]
        .filter(Boolean)
        .join(' ')
    );

    return haystack.includes(keyword);
  });
}

function normalizeFilterText(value: string) {
  return value.trim().toLocaleLowerCase('ko-KR');
}

function readUniqueSortedValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, 'ko-KR'));
}
