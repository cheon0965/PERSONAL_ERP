'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from '@mui/material';
import { webRuntime } from '@/shared/config/env';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import {
  deleteRecurringRule,
  getRecurringRuleDetail,
  getRecurringRules,
  type ManagedRecurringRuleItem,
  recurringRuleDetailQueryKey,
  recurringRulesQueryKey,
  removeRecurringRuleItem
} from './recurring-rules.api';
import {
  createRecurringRulesColumns,
  RecurringRuleDrawerContent,
  RecurringRulesFeedbackAlerts,
  RecurringRulesToolbar
} from './recurring-rules-page.sections';

type SubmitFeedback = {
  severity: 'success' | 'error';
  message: string;
} | null;

type RecurringRuleDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; recurringRuleId: string }
  | null;

export function RecurringRulesPage() {
  const queryClient = useQueryClient();
  const { notifySuccess } = useAppNotification();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<RecurringRuleDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<ManagedRecurringRuleItem | null>(null);
  const { data = [], error } = useQuery({
    queryKey: recurringRulesQueryKey,
    queryFn: getRecurringRules
  });
  const activeRuleCount = data.filter(
    (recurringRule) => recurringRule.isActive
  ).length;
  const insuranceManagedRuleCount = data.filter(
    (recurringRule) => recurringRule.linkedInsurancePolicyId
  ).length;

  const editingRecurringRuleId =
    drawerState?.mode === 'edit' ? drawerState.recurringRuleId : null;
  const editingRecurringRuleQuery = useQuery({
    queryKey: editingRecurringRuleId
      ? recurringRuleDetailQueryKey(editingRecurringRuleId)
      : ['recurring-rules', 'detail-idle'],
    queryFn: () => getRecurringRuleDetail(editingRecurringRuleId ?? ''),
    enabled: Boolean(editingRecurringRuleId)
  });

  const deleteMutation = useMutation({
    mutationFn: (recurringRule: ManagedRecurringRuleItem) =>
      deleteRecurringRule(recurringRule.id),
    onSuccess: async (_response, recurringRule) => {
      setDeleteTarget(null);
      notifySuccess(`${recurringRule.title} 반복 규칙을 삭제했습니다.`);

      queryClient.setQueryData<ManagedRecurringRuleItem[]>(
        recurringRulesQueryKey,
        (current) => removeRecurringRuleItem(current, recurringRule.id)
      );
      queryClient.removeQueries({
        queryKey: recurringRuleDetailQueryKey(recurringRule.id)
      });

      if (!webRuntime.demoFallbackEnabled) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: recurringRulesQueryKey }),
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
        ]);
      }
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '반복 규칙을 삭제하지 못했습니다.'
      });
    }
  });

  useDomainHelp({
    title: '반복 규칙 사용 가이드',
    description:
      '이 화면은 월세, 구독료, 정기 수입, 보험료처럼 반복되는 거래의 계획 기준을 관리하는 곳입니다. 규칙을 만들면 다음 단계에서 해당 월의 계획 항목으로 펼칠 수 있습니다.',
    primaryEntity: '반복 규칙',
    relatedEntities: [
      '계획 항목',
      '거래 유형',
      '입출금 계정',
      '거래 분류',
      '수집 거래'
    ],
    truthSource:
      '반복 규칙은 계획 생성 기준이며, 회계 확정은 이후 생성된 계획 항목의 연결 수집 거래와 전표에서 이뤄집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '반복 규칙 등록을 열고 제목, 금액, 주기, 시작일을 입력합니다.',
          '거래 성격에 맞는 자금수단과 카테고리를 선택해 계획 항목이 바로 전표 준비까지 이어지게 합니다.',
          '보험 계약 연동 규칙은 이 화면에서 직접 수정하지 않고 보험 계약 화면에서 관리합니다.',
          '중지한 규칙은 목록에 남지만 이후 계획 항목 생성 대상에서 빠집니다.',
          '규칙을 정리한 뒤 계획 항목 화면으로 이동해 선택한 운영 월의 계획을 생성합니다.'
        ]
      },
      {
        title: '주의할 점',
        items: [
          '반복 규칙을 삭제해도 이미 생성된 기존 계획 항목은 자동으로 지워지지 않습니다.',
          '규칙은 미래 계획의 기준이며, 실제 납부나 입금 여부는 수집 거래에서 확인합니다.',
          '카테고리나 자금수단 선택지가 부족하면 기준 데이터 관리 화면에서 먼저 보완합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '보험 계약',
            description:
              '보험 계약에서 생성된 연동 규칙은 보험 계약 화면에서 함께 관리합니다.',
            href: '/insurances',
            actionLabel: '보험 계약 보기'
          },
          {
            title: '계획 항목',
            description:
              '현재 운영 월 기준으로 반복 규칙이 실제 계획으로 생성됐는지 확인합니다.',
            href: '/plan-items',
            actionLabel: '계획 항목 보기'
          },
          {
            title: '기준 데이터 준비 상태',
            description:
              '자금수단이나 카테고리 선택지가 부족할 때 먼저 보완합니다.',
            href: '/reference-data',
            actionLabel: '기준 데이터 보기'
          }
        ]
      }
    ],
    readModelNote:
      '현재 목록은 앞으로 생성될 계획 항목의 기준을 보여줍니다. 공식 회계 숫자는 이 화면이 아니라 전표 조회와 재무제표에서 확인합니다.'
  });

  const handleCreateOpen = React.useCallback(() => {
    setFeedback(null);
    setDrawerState({ mode: 'create' });
  }, []);

  const handleEditOpen = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem) => {
      if (recurringRule.linkedInsurancePolicyId) {
        setFeedback({
          severity: 'error',
          message:
            '보험 계약에서 생성된 반복 규칙은 보험 계약 화면에서만 수정할 수 있습니다.'
        });
        return;
      }

      setFeedback(null);
      setDrawerState({ mode: 'edit', recurringRuleId: recurringRule.id });
    },
    []
  );

  const handleDeleteOpen = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem) => {
      if (recurringRule.linkedInsurancePolicyId) {
        setFeedback({
          severity: 'error',
          message:
            '보험 계약에서 생성된 반복 규칙은 보험 계약 화면에서만 삭제할 수 있습니다.'
        });
        return;
      }

      setFeedback(null);
      setDeleteTarget(recurringRule);
    },
    []
  );

  const handleDrawerClose = React.useCallback(() => {
    setDrawerState(null);
  }, []);

  const handleDeleteClose = React.useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    setFeedback(null);
    void deleteMutation.mutateAsync(deleteTarget);
  }, [deleteMutation, deleteTarget]);

  const handleFormCompleted = React.useCallback(
    (recurringRule: ManagedRecurringRuleItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      notifySuccess(
        mode === 'edit'
          ? `${recurringRule.title} 반복 규칙을 수정했습니다.`
          : `${recurringRule.title} 반복 규칙을 등록했습니다.`
      );
    },
    [notifySuccess]
  );

  const columns = React.useMemo(
    () =>
      createRecurringRulesColumns({
        onEdit: handleEditOpen,
        onDelete: handleDeleteOpen
      }),
    [handleDeleteOpen, handleEditOpen]
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '반복 규칙 수정' : '반복 규칙 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? '기존 계획 생성 기준을 수정하고 이후 계획 항목 생성 흐름에 반영합니다.'
      : '계획 생성 기준을 추가하고, 이후 계획 항목과 실제 거래 흐름으로 연결합니다.';

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="계획 기준"
        title="반복 규칙"
        description="반복 규칙은 월별 계획 항목을 만드는 기준 목록이며, 실제 수집 거래와 전표와는 구분되는 계획 정보입니다."
        badges={[
          {
            label: insuranceManagedRuleCount
              ? `보험 연동 ${insuranceManagedRuleCount}건`
              : '직접 관리 중심'
          }
        ]}
        metadata={[
          {
            label: '전체 규칙',
            value: `${data.length}건`
          },
          {
            label: '활성 규칙',
            value: `${activeRuleCount}건`
          }
        ]}
        primaryActionLabel="반복 규칙 등록"
        primaryActionOnClick={handleCreateOpen}
        secondaryActionLabel="계획 항목 보기"
        secondaryActionHref="/plan-items"
      />

      <RecurringRulesFeedbackAlerts
        feedback={feedback}
        insuranceManagedRuleCount={insuranceManagedRuleCount}
        error={error}
      />

      <DataTableCard
        title="계획 생성 규칙"
        description="각 규칙은 앞으로 생성될 계획 항목의 기준입니다. 필요하면 드로어에서 바로 수정하거나 삭제할 수 있습니다."
        toolbar={
          <RecurringRulesToolbar
            totalCount={data.length}
            activeCount={activeRuleCount}
            insuranceManagedRuleCount={insuranceManagedRuleCount}
          />
        }
        rows={data}
        columns={columns}
      />

      <FormDrawer
        open={drawerState !== null}
        onClose={handleDrawerClose}
        title={drawerTitle}
        description={drawerDescription}
      >
        <RecurringRuleDrawerContent
          mode={drawerState?.mode ?? null}
          isPending={editingRecurringRuleQuery.isPending}
          error={editingRecurringRuleQuery.error}
          editingRecurringRule={editingRecurringRuleQuery.data}
          onCompleted={handleFormCompleted}
        />
      </FormDrawer>

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title="반복 규칙 삭제"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" 반복 규칙을 삭제할까요? 기존 계획 항목은 남아 있고 이후 자동 생성 기준만 제거됩니다.`
            : ''
        }
        confirmLabel="삭제"
        pendingLabel="삭제 중..."
        confirmColor="error"
        busy={deleteMutation.isPending}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
      />
    </Stack>
  );
}
