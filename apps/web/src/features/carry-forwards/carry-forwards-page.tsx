'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
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

  useDomainHelp({
    title: '차기 이월 사용 가이드',
    description:
      '이 화면은 잠금된 월의 마감 결과를 다음 월의 시작 잔액 기준으로 넘기는 곳입니다. 한 달 운영을 공식 보고에서 끝내지 않고 다음 달 운영으로 연결합니다.',
    primaryEntity: '차기 이월 기록',
    relatedEntities: [
      '월 마감 스냅샷',
      '다음 월 기초 잔액',
      '운영 기간'
    ],
    truthSource:
      '차기 이월은 잠금된 기간의 마감 결과와 잔액 라인을 근거로 생성됩니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '이월 대상 선택에서 잠금된 운영 기간을 선택합니다.',
          '차기 이월 생성을 눌러 선택한 월의 마감 잔액을 다음 월 오프닝 기준으로 넘깁니다.',
          '이월 개요에서 원천 월과 대상 월이 맞는지 확인합니다.',
          '마감 기준에서 자산, 부채, 자본 합계가 의도한 기준인지 확인합니다.',
          '다음 월 오프닝 라인에서 자금수단과 계정과목별 시작 잔액을 확인합니다.'
        ]
      },
      {
        title: '다음 단계',
        items: [
          '이월 결과를 확인한 뒤 기간 전망에서 다음 월 준비 상태와 안전 여력을 확인합니다.',
          '다음 운영 월을 실제로 진행하려면 월 운영 화면에서 대상 월 상태를 확인합니다.',
          '이월 전 보고 숫자를 다시 보고 싶으면 재무제표 화면으로 돌아갑니다.'
        ]
      }
    ],
    readModelNote:
      '차기 이월은 손익 계정을 직접 넘기지 않고, 잠금 시점의 자산·부채·자본 잔액만 다음 월 오프닝 기준으로 전달합니다.'
  });

  const lockedPeriods = React.useMemo(
    () =>
      (periodsQuery.data ?? []).filter((period) => period.status === 'LOCKED'),
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
  const canGenerate =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const view = carryForwardQuery.data;
  const handleGenerateCarryForward = React.useCallback(async () => {
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
  }, [mutation, selectedPeriod]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="차기 이월"
        title="이월 기준 생성"
        description="잠금된 운영 기간의 마감 결과를 다음 월 시작 기준으로 연결하고, 이미 생성된 이월 결과를 함께 확인합니다."
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

          <div>
            <Button
              variant="contained"
              color="inherit"
              disabled={!selectedPeriod || !canGenerate || mutation.isPending}
              onClick={handleGenerateCarryForward}
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
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              잠금된 운영 기간이 준비되면 차기 이월 생성과 조회를 진행할 수
              있습니다.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              <Button component={Link} href="/periods" variant="contained">
                운영 월 보기
              </Button>
              <Button
                component={Link}
                href="/financial-statements"
                variant="outlined"
              >
                재무제표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : view == null ? (
        <SectionCard
          title="차기 이월이 아직 없습니다"
          description="선택한 잠금 기간에 대해 차기 이월 기록이 아직 생성되지 않았습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {selectedPeriod.monthLabel} 기간을 기준으로 차기 이월 생성을 실행해
              주세요.
            </Typography>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              {canGenerate ? (
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={handleGenerateCarryForward}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? '차기 이월 생성 중...'
                    : '이 화면에서 바로 생성'}
                </Button>
              ) : null}
              <Button
                component={Link}
                href="/financial-statements"
                variant="outlined"
              >
                재무제표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          <SectionCard
            title="이월 개요"
            description={`${view.sourcePeriod.monthLabel} 마감 결과가 ${view.targetPeriod.monthLabel} 기초 잔액 기준으로 연결되었습니다.`}
          >
            <Stack spacing={appLayout.cardGap}>
              <Typography variant="body2" color="text.secondary">
                이월 생성 시각: {formatDate(view.carryForwardRecord.createdAt)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                대상 운영 기간 상태: {readPeriodStatusLabel(view.targetPeriod.status)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기초 잔액 기준:{' '}
                {readOpeningSourceLabel(view.targetOpeningBalanceSnapshot.sourceKind)}
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="마감 기준"
            description="이월은 손익 계정을 직접 넘기지 않고, 잠금 시점의 자산·부채·자본 잔액만 다음 월 기준으로 전달합니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                자산 합계:{' '}
                {formatWon(view.sourceClosingSnapshot.totalAssetAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                부채 합계:{' '}
                {formatWon(view.sourceClosingSnapshot.totalLiabilityAmount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                자본 합계:{' '}
                {formatWon(view.sourceClosingSnapshot.totalEquityAmount)}
              </Typography>
            </Stack>
          </SectionCard>

          <SectionCard
            title="다음 월 오프닝 라인"
            description="현재 구현에서는 이월 대상 계정의 잔액을 그대로 다음 월 기초 잔액 라인으로 생성합니다."
          >
            <Stack spacing={1}>
              {view.targetOpeningBalanceSnapshot.lines.length > 0 ? (
                view.targetOpeningBalanceSnapshot.lines.map((line) => (
                  <Typography
                    key={line.id}
                    variant="body2"
                    color="text.secondary"
                  >
                    {line.accountSubjectCode} {line.accountSubjectName}
                    {line.fundingAccountName
                      ? ` / ${line.fundingAccountName}`
                      : ''}{' '}
                    | {formatWon(line.balanceAmount)}
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

function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'OPEN':
      return '진행 중';
    case 'IN_REVIEW':
      return '검토 중';
    case 'LOCKED':
      return '잠금';
    default:
      return status;
  }
}

function readOpeningSourceLabel(sourceKind: string) {
  switch (sourceKind) {
    case 'INITIAL_SETUP':
      return '초기 설정';
    case 'CARRY_FORWARD':
      return '차기 이월';
    default:
      return sourceKind;
  }
}
