'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { Button, Grid, Stack, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { formatDate, formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { getCarryForwardView } from './carry-forwards.api';

type CarryForwardView = Awaited<ReturnType<typeof getCarryForwardView>>;

export function CarryForwardsOverview({
  canCancel,
  canGenerate,
  canRegenerate,
  detailHref,
  hasCarryForward,
  isCanceling,
  isGenerating,
  lockedPeriods,
  onCancel,
  onGenerate,
  onRegenerate,
  onSelectPeriod,
  selectedPeriod,
  view
}: {
  canCancel: boolean;
  canGenerate: boolean;
  canRegenerate: boolean;
  detailHref: Route | null;
  hasCarryForward: boolean;
  isCanceling: boolean;
  isGenerating: boolean;
  lockedPeriods: AccountingPeriodItem[];
  onGenerate: () => void;
  onCancel: () => void;
  onRegenerate: () => void;
  onSelectPeriod: (periodId: string) => void;
  selectedPeriod: AccountingPeriodItem;
  view: CarryForwardView | undefined;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="선택한 기간 작업대"
            description="여기서는 생성 여부와 다음 이동만 빠르게 판단하고, 상세 라인 확인은 결과 보기 화면에서 읽습니다."
          >
            <Stack spacing={appLayout.cardGap}>
              <Grid container spacing={appLayout.fieldGap}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <CarryForwardInfoItem
                    label="이월 기준 월"
                    value={selectedPeriod.monthLabel}
                    description={`상태: ${readPeriodStatusLabel(selectedPeriod.status)}`}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <CarryForwardInfoItem
                    label="결과 상태"
                    value={hasCarryForward ? '생성됨' : '미생성'}
                    description={
                      hasCarryForward
                        ? `${view?.targetPeriod.monthLabel ?? '-'} 오프닝 기준으로 이어집니다.`
                        : '먼저 차기 이월 생성을 실행해야 합니다.'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <CarryForwardInfoItem
                    label="오프닝 라인"
                    value={`${view?.targetOpeningBalanceSnapshot.lines.length ?? 0}개`}
                    description="다음 월 시작 잔액 라인 수입니다."
                  />
                </Grid>
              </Grid>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                {detailHref && hasCarryForward ? (
                  <Button
                    component={Link}
                    href={detailHref}
                    variant="contained"
                  >
                    결과 보기
                  </Button>
                ) : canGenerate ? (
                  <Button
                    variant="contained"
                    color="inherit"
                    onClick={onGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? '차기 이월 생성 중...' : '차기 이월 생성'}
                  </Button>
                ) : null}
                {canRegenerate && hasCarryForward ? (
                  <Button
                    variant="outlined"
                    onClick={onRegenerate}
                    disabled={isGenerating || isCanceling}
                  >
                    {isGenerating
                      ? '다시 생성 중...'
                      : '현재 기준으로 다시 생성'}
                  </Button>
                ) : null}
                {canCancel && hasCarryForward ? (
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={onCancel}
                    disabled={isGenerating || isCanceling}
                  >
                    {isCanceling ? '취소 중...' : '차기 이월 취소'}
                  </Button>
                ) : null}
                {!hasCarryForward ? (
                  <Button
                    component={Link}
                    href="/financial-statements"
                    variant="outlined"
                  >
                    재무제표 보기
                  </Button>
                ) : null}
                <Button component={Link} href="/forecast" variant="text">
                  기간 전망 보기
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="현재 연결 기준"
            description="다음 월 오프닝 기준이 어떤 출처와 대상 월로 이어지는지만 먼저 확인합니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                대상 월: {view?.targetPeriod.monthLabel ?? '없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기초 잔액 출처:{' '}
                {readOpeningSourceLabel(
                  view?.targetOpeningBalanceSnapshot.sourceKind
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                자산 합계:{' '}
                {formatWon(view?.sourceClosingSnapshot.totalAssetAmount ?? 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                부채 합계:{' '}
                {formatWon(
                  view?.sourceClosingSnapshot.totalLiabilityAmount ?? 0
                )}
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard
        title="잠금 기간 바로가기"
        description="목록에서 기준 월을 바꾸고, 결과가 준비된 기간만 결과 보기 화면으로 이동하면 됩니다."
      >
        <Grid container spacing={appLayout.fieldGap}>
          {lockedPeriods.map((period) => {
            const isSelected = period.id === selectedPeriod.id;

            return (
              <Grid key={period.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <Stack
                  spacing={1.25}
                  sx={{
                    p: appLayout.cardPadding,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    backgroundColor: isSelected
                      ? 'action.selected'
                      : 'background.paper'
                  }}
                >
                  <Typography variant="subtitle1">
                    {period.monthLabel}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {readPeriodStatusLabel(period.status)} 상태의 차기 이월
                    기준입니다.
                  </Typography>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    <Button
                      variant={isSelected ? 'contained' : 'outlined'}
                      onClick={() => onSelectPeriod(period.id)}
                    >
                      {isSelected ? '현재 선택됨' : '이 기간 선택'}
                    </Button>
                    {isSelected && detailHref && hasCarryForward ? (
                      <Button component={Link} href={detailHref} variant="text">
                        결과 보기
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Grid>
            );
          })}
        </Grid>
      </SectionCard>
    </Stack>
  );
}

export function CarryForwardsDetail({
  canCancel,
  canRegenerate,
  isCanceling,
  isRegenerating,
  lockedPeriods,
  onCancel,
  onRegenerate,
  selectedPeriodId,
  view
}: {
  canCancel: boolean;
  canRegenerate: boolean;
  isCanceling: boolean;
  isRegenerating: boolean;
  lockedPeriods: AccountingPeriodItem[];
  onCancel: () => void;
  onRegenerate: () => void;
  selectedPeriodId: string;
  view: NonNullable<CarryForwardView>;
}) {
  return (
    <Stack spacing={appLayout.sectionGap}>
      <SectionCard
        title="다른 잠금 기간 보기"
        description="결과 화면 안에서도 다른 잠금 기간으로 빠르게 이동할 수 있습니다."
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {lockedPeriods.map((period) => (
            <Button
              key={period.id}
              component={Link}
              href={buildCarryForwardsDetailHref(period.id)}
              variant={
                period.id === selectedPeriodId ? 'contained' : 'outlined'
              }
            >
              {period.monthLabel}
            </Button>
          ))}
        </Stack>
      </SectionCard>

      <SectionCard
        title="이월 기준 요약"
        description={`${view.sourcePeriod.monthLabel} 마감 결과가 ${view.targetPeriod.monthLabel} 기초 잔액 기준으로 연결되었습니다.`}
      >
        <Stack spacing={appLayout.cardGap}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {canRegenerate ? (
              <Button
                variant="outlined"
                onClick={onRegenerate}
                disabled={isRegenerating || isCanceling}
              >
                {isRegenerating ? '다시 생성 중...' : '현재 기준으로 다시 생성'}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                variant="outlined"
                color="warning"
                onClick={onCancel}
                disabled={isRegenerating || isCanceling}
              >
                {isCanceling ? '취소 중...' : '차기 이월 취소'}
              </Button>
            ) : null}
          </Stack>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="이월 생성 시각"
                value={formatDate(view.carryForwardRecord.createdAt)}
                description={`${view.sourcePeriod.monthLabel} 마감 결과를 기준으로 생성했습니다.`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="대상 운영 기간 상태"
                value={readPeriodStatusLabel(view.targetPeriod.status)}
                description={`${view.targetPeriod.monthLabel} 오프닝 기준에 연결됩니다.`}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="기초 잔액 기준"
                value={readOpeningSourceLabel(
                  view.targetOpeningBalanceSnapshot.sourceKind
                )}
                description="다음 월 시작 잔액의 출처를 보여줍니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="자산 합계"
                value={formatWon(view.sourceClosingSnapshot.totalAssetAmount)}
                description="잠금 시점 자산 잔액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="부채 합계"
                value={formatWon(
                  view.sourceClosingSnapshot.totalLiabilityAmount
                )}
                description="잠금 시점 부채 잔액입니다."
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <CarryForwardInfoItem
                label="자본 합계"
                value={formatWon(view.sourceClosingSnapshot.totalEquityAmount)}
                description="손익 계정을 제외한 자본 잔액입니다."
              />
            </Grid>
          </Grid>
        </Stack>
      </SectionCard>

      <SectionCard
        title="다음 월 오프닝 라인"
        description="현재 구현에서는 이월 대상 계정의 잔액을 그대로 다음 월 기초 잔액 라인으로 생성합니다."
      >
        <Stack spacing={1}>
          {view.targetOpeningBalanceSnapshot.lines.length > 0 ? (
            view.targetOpeningBalanceSnapshot.lines.map((line) => (
              <Typography key={line.id} variant="body2" color="text.secondary">
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
  );
}

export function buildCarryForwardsDetailHref(periodId: string) {
  return `/carry-forwards/${periodId}` as Route;
}

export function readPeriodStatusLabel(status: string) {
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

function CarryForwardInfoItem({
  label,
  value,
  description
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1">{value}</Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}

function readOpeningSourceLabel(sourceKind: string | null | undefined) {
  switch (sourceKind) {
    case 'INITIAL_SETUP':
      return '초기 설정';
    case 'CARRY_FORWARD':
      return '차기 이월';
    default:
      return '없음';
  }
}
