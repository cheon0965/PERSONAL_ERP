'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type { InsurancePolicyItem } from '@personal-erp/contracts';
import { sumMoneyWon } from '@personal-erp/money';
import { webRuntime } from '@/shared/config/env';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  deleteInsurancePolicy,
  getInsurancePolicies,
  insurancePoliciesQueryKey,
  removeInsurancePolicyItem
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
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [drawerState, setDrawerState] =
    React.useState<InsurancePolicyDrawerState>(null);
  const [deleteTarget, setDeleteTarget] =
    React.useState<InsurancePolicyItem | null>(null);
  const { data = [], error } = useQuery({
    queryKey: insurancePoliciesQueryKey,
    queryFn: () => getInsurancePolicies({ includeInactive: true })
  });

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
      setFeedback({
        severity: 'success',
        message: insurancePolicy.linkedRecurringRuleId
          ? `${insurancePolicy.productName} 보험 계약과 연결된 반복 규칙을 함께 삭제했습니다.`
          : `${insurancePolicy.productName} 보험 계약을 삭제했습니다.`
      });

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
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
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

  const handleDrawerClose = React.useCallback(() => {
    setDrawerState(null);
  }, []);

  const handleDeleteOpen = React.useCallback(
    (insurancePolicy: InsurancePolicyItem) => {
      setFeedback(null);
      setDeleteTarget(insurancePolicy);
    },
    []
  );

  const handleDeleteClose = React.useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleDeleteConfirm = React.useCallback(() => {
    if (!deleteTarget) {
      return;
    }

    void deleteMutation.mutateAsync(deleteTarget);
  }, [deleteMutation, deleteTarget]);

  const handleFormCompleted = React.useCallback(
    (insurancePolicy: InsurancePolicyItem, mode: 'create' | 'edit') => {
      setDrawerState(null);
      setFeedback({
        severity: 'success',
        message:
          mode === 'edit'
            ? `${insurancePolicy.productName} 보험 계약과 연결 규칙을 수정했습니다.`
            : `${insurancePolicy.productName} 보험 계약과 연결 규칙을 등록했습니다.`
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
        field: 'fundingAccountName',
        headerName: '자금수단',
        flex: 1.1,
        valueFormatter: (value) => (value ? String(value) : '미설정')
      },
      {
        field: 'categoryName',
        headerName: '카테고리',
        flex: 1,
        valueFormatter: (value) => (value ? String(value) : '미설정')
      },
      {
        field: 'recurringStartDate',
        headerName: '반복 시작',
        flex: 1,
        valueFormatter: (value) => (value ? formatDate(String(value)) : '-')
      },
      {
        field: 'linkedRecurringRuleId',
        headerName: '연결 규칙',
        flex: 0.9,
        sortable: false,
        renderCell: (params) => (
          <StatusChip label={params.value ? '연결됨' : '미연결'} />
        )
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
        flex: 1.5,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                handleEditOpen(params.row);
              }}
            >
              수정
            </Button>
            <Button
              size="small"
              color="error"
              onClick={() => {
                handleDeleteOpen(params.row);
              }}
            >
              삭제
            </Button>
          </Stack>
        )
      }
    ],
    [handleDeleteOpen, handleEditOpen]
  );

  const drawerTitle =
    drawerState?.mode === 'edit' ? '보험 계약 수정' : '보험 계약 등록';
  const drawerDescription =
    drawerState?.mode === 'edit'
      ? '보험 계약 기준을 조정하면 연결된 반복 규칙도 함께 동기화합니다.'
      : '보험 계약과 연결된 반복 규칙 기준을 함께 추가합니다.';

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
      {feedback ? (
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
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                label={`활성 ${activePolicies.length}건`}
                size="small"
                color="success"
                variant="filled"
              />
              <Chip
                label={`연결 완료 ${linkedPolicyCount}건`}
                size="small"
                color={linkedPolicyCount > 0 ? 'primary' : 'default'}
                variant="outlined"
              />
              <Chip
                label={`미연결 ${unlinkedPolicyCount}건`}
                size="small"
                color={unlinkedPolicyCount > 0 ? 'warning' : 'default'}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              보험 계약은 표에서 먼저 확인하고, 생성과 수정은 드로어에서 이어서 처리합니다.
            </Typography>
          </Stack>
        }
        rows={data}
        columns={columns}
      />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <InsuranceInfoCard
            totalPremium={formatWon(totalPremium)}
            totalCount={data.length}
            linkedCount={linkedPolicyCount}
            unlinkedCount={unlinkedPolicyCount}
            inactiveCount={inactivePolicyCount}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <InsuranceSupportCard />
        </Grid>
      </Grid>

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

      <ConfirmActionDialog
        open={deleteTarget !== null}
        title="보험 계약 삭제"
        description={
          deleteTarget
            ? deleteTarget.linkedRecurringRuleId
              ? `"${deleteTarget.productName}" 보험 계약을 삭제할까요? 연결된 반복 규칙도 함께 삭제됩니다.`
              : `"${deleteTarget.productName}" 보험 계약을 삭제할까요?`
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

function InsuranceInfoCard({
  totalPremium,
  totalCount,
  linkedCount,
  unlinkedCount,
  inactiveCount
}: {
  totalPremium: string;
  totalCount: number;
  linkedCount: number;
  unlinkedCount: number;
  inactiveCount: number;
}) {
  return (
    <Stack
      spacing={appLayout.cardGap}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}
    >
      <Typography variant="h6">목록 읽는 기준</Typography>
      <Grid container spacing={appLayout.fieldGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <InfoItem label="활성 월 보험료" value={totalPremium} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <InfoItem label="전체 계약" value={`${totalCount}건`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <InfoItem label="비활성" value={`${inactiveCount}건`} />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={`연결 완료 ${linkedCount}건`} size="small" color="success" />
        <Chip
          label={`미연결 ${unlinkedCount}건`}
          size="small"
          color={unlinkedCount > 0 ? 'warning' : 'default'}
          variant="outlined"
        />
      </Stack>
    </Stack>
  );
}

function InsuranceSupportCard() {
  return (
    <Stack
      spacing={1.25}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper'
      }}
    >
      <Typography variant="h6">연결 규칙과 후속 화면</Typography>
      <SupportLink
        title="반복 규칙"
        description="보험 계약 저장 시 생성되는 연결 반복 규칙 상태를 함께 확인합니다."
        href="/recurring"
        actionLabel="반복 규칙 보기"
      />
      <SupportLink
        title="계획 항목"
        description="현재 운영 월에서 보험료 계획이 실제 생성됐는지 확인합니다."
        href="/plan-items"
        actionLabel="계획 항목 보기"
      />
    </Stack>
  );
}

function SupportLink({
  title,
  description,
  href,
  actionLabel
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Stack
      spacing={1}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.default'
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
      <div>
        <Button component={Link} href={href} variant="outlined">
          {actionLabel}
        </Button>
      </div>
    </Stack>
  );
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <Stack spacing={0.35}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
