'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatDate, formatWon } from '@/shared/lib/format';
import { DomainContextCard } from '@/shared/ui/domain-context-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  buildCarryForwardFallback,
  carryForwardQueryKey,
  generateCarryForward,
  getCarryForwardView
} from './carry-forwards.api';

export function CarryForwardsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);
  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  const lockedPeriods = React.useMemo(
    () => (periodsQuery.data ?? []).filter((period) => period.status === 'LOCKED'),
    [periodsQuery.data]
  );

  const [selectedPeriodId, setSelectedPeriodId] = React.useState('');

  React.useEffect(() => {
    if (!selectedPeriodId && lockedPeriods.length > 0) {
      setSelectedPeriodId(lockedPeriods[0]!.id);
    }
  }, [lockedPeriods, selectedPeriodId]);

  const selectedPeriod =
    lockedPeriods.find((period) => period.id === selectedPeriodId) ?? null;

  const carryForwardQuery = useQuery({
    queryKey: carryForwardQueryKey(selectedPeriodId || null),
    queryFn: () => getCarryForwardView(selectedPeriodId || null),
    enabled: Boolean(selectedPeriodId)
  });

  const mutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      generateCarryForward(
        { fromPeriodId: period.id },
        buildCarryForwardFallback(period)
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: carryForwardQueryKey(result.sourcePeriod.id)
      });
      await queryClient.invalidateQueries({
        queryKey: accountingPeriodsQueryKey
      });
    }
  });

  const membershipRole = user?.currentWorkspace?.membership.role ?? null;
  const canGenerate = membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const view = carryForwardQuery.data;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="차기 이월"
        title="이월 기준 생성"
        description="잠금된 운영 기간의 ClosingSnapshot을 다음 월 오프닝 기준으로 연결합니다. Round 9에서는 CarryForwardRecord와 OpeningBalanceSnapshot을 얇게 먼저 연결합니다."
      />

      <DomainContextCard
        description="이 화면은 마감 결과를 다음 월 시작 기준으로 넘기는 공식 이월 화면입니다. 재무제표와 달리, 다음 운영 월의 오프닝 잔액이 실제로 어떻게 만들어졌는지까지 함께 고정합니다."
        primaryEntity="이월 기록 (CarryForwardRecord)"
        relatedEntities={[
          '마감 스냅샷 (ClosingSnapshot)',
          '오프닝 잔액 스냅샷 (OpeningBalanceSnapshot)',
          '운영 기간 (AccountingPeriod)'
        ]}
        truthSource="차기 이월은 잠금된 기간의 ClosingSnapshot과 BalanceSnapshotLine을 근거로 생성됩니다."
        readModelNote="Round 9에서는 자산·부채·자본 계정의 잔액만 다음 월 오프닝으로 이월하고, 향후 라운드에서 생성 전표나 정교한 예외 흐름을 확장합니다."
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="잠금된 운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {carryForwardQuery.error ? (
        <QueryErrorAlert
          title="차기 이월 결과를 불러오지 못했습니다."
          error={carryForwardQuery.error}
        />
      ) : null}

      <SectionCard
        title="이월 대상 선택"
        description="잠금된 운영 기간을 선택하면, 다음 월 오프닝 기준을 생성하거나 이미 생성된 이월 결과를 조회할 수 있습니다."
      >
        <Stack spacing={appLayout.cardGap}>
          <TextField
            select
            label="잠금된 운영 기간"
            value={selectedPeriodId}
            onChange={(event) => {
              setSelectedPeriodId(event.target.value);
              setFeedback(null);
            }}
            helperText={
              lockedPeriods.length > 0
                ? '잠금된 기간만 차기 이월의 기준이 됩니다.'
                : '아직 잠금된 운영 기간이 없습니다.'
            }
            disabled={lockedPeriods.length === 0}
          >
            {lockedPeriods.map((period) => (
              <MenuItem key={period.id} value={period.id}>
                {period.monthLabel}
              </MenuItem>
            ))}
          </TextField>

          <Alert severity="info" variant="outlined">
            완료한 라운드: `Round 0, 1, 2, 5, 6, 7, 8`
            {' '}| 현재 진행 중: `Round 9`
            {' '}| 남은 라운드: `Round 3, 4`
          </Alert>

          <div>
            <Button
              variant="contained"
              color="inherit"
              disabled={!selectedPeriod || !canGenerate || mutation.isPending}
              onClick={async () => {
                if (!selectedPeriod) {
                  return;
                }

                setFeedback(null);

                try {
                  const result = await mutation.mutateAsync(selectedPeriod);
                  setFeedback({
                    severity: 'success',
                    message: `${result.sourcePeriod.monthLabel} 마감 결과를 ${result.targetPeriod.monthLabel} 오프닝 기준으로 이월했습니다.`
                  });
                } catch (error) {
                  setFeedback({
                    severity: 'error',
                    message:
                      error instanceof Error
                        ? error.message
                        : '차기 이월을 생성하지 못했습니다.'
                  });
                }
              }}
            >
              {mutation.isPending ? '차기 이월 생성 중...' : '차기 이월 생성'}
            </Button>
          </div>
        </Stack>
      </SectionCard>

      {!selectedPeriod ? (
        <SectionCard
          title="표시할 차기 이월이 없습니다"
          description="먼저 월 마감을 완료한 잠금된 운영 기간을 만들어 주세요."
        >
          <Typography variant="body2" color="text.secondary">
            Round 9는 `Round 7`과 `Round 8`이 완료된 기간 위에서 동작합니다.
          </Typography>
        </SectionCard>
      ) : view == null ? (
        <SectionCard
          title="차기 이월이 아직 없습니다"
          description="선택한 잠금 기간에 대해 CarryForwardRecord가 아직 생성되지 않았습니다."
        >
          <Typography variant="body2" color="text.secondary">
            {selectedPeriod.monthLabel} 기간을 기준으로 차기 이월 생성을 실행해 주세요.
          </Typography>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          <SectionCard
            title="이월 개요"
            description={`${view.sourcePeriod.monthLabel} 마감 결과가 ${view.targetPeriod.monthLabel} 오프닝 기준으로 연결되었습니다.`}
          >
            <Stack spacing={appLayout.cardGap}>
              <Typography variant="body2" color="text.secondary">
                이월 생성 시각: {formatDate(view.carryForwardRecord.createdAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                대상 운영 기간 상태: {view.targetPeriod.status}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                오프닝 스냅샷 기준: {view.targetOpeningBalanceSnapshot.sourceKind}
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="마감 기준"
            description="이월은 손익 계정을 직접 넘기지 않고, 잠금 시점의 자산·부채·자본 잔액만 다음 월 기준으로 전달합니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                자산 합계: {formatWon(view.sourceClosingSnapshot.totalAssetAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                부채 합계: {formatWon(view.sourceClosingSnapshot.totalLiabilityAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                자본 합계: {formatWon(view.sourceClosingSnapshot.totalEquityAmount)}
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="다음 월 오프닝 라인"
            description="현재 1차 구현에서는 CarryForward 대상 계정의 잔액을 그대로 OpeningBalanceSnapshot 라인으로 생성합니다."
          >
            <Stack spacing={1}>
              {view.targetOpeningBalanceSnapshot.lines.length > 0 ? (
                view.targetOpeningBalanceSnapshot.lines.map((line) => (
                  <Typography key={line.id} variant="body2" color="text.secondary">
                    {line.accountSubjectCode} {line.accountSubjectName}
                    {line.fundingAccountName ? ` / ${line.fundingAccountName}` : ''}
                    {' '}| {formatWon(line.balanceAmount)}
                  </Typography>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  생성된 오프닝 라인이 없습니다.
                </Typography>
              )}
            </Stack>
          </SectionCard>
        </Stack>
      )}
    </Stack>
  );
}
