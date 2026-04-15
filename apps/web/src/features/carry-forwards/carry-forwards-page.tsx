'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Grid,
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
import { CarryForwardsSectionNav } from './carry-forwards-section-nav';
import {
  buildCarryForwardFallback,
  carryForwardQueryKey,
  generateCarryForward,
  getCarryForwardView
} from './carry-forwards.api';

type CarryForwardsPageMode = 'overview' | 'detail';

type CarryForwardsPageProps = {
  mode?: CarryForwardsPageMode;
  selectedPeriodId?: string | null;
};

export function CarryForwardsPage({
  mode = 'overview',
  selectedPeriodId: pinnedPeriodId = null
}: CarryForwardsPageProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
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
          '생성 / 선택 화면에서 잠금된 운영 기간을 선택합니다.',
          '차기 이월 생성을 눌러 선택한 월의 마감 잔액을 다음 월 오프닝 기준으로 넘깁니다.',
          '결과 보기 화면에서 원천 월과 대상 월이 맞는지 확인합니다.',
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

  const [selectedPeriodIdState, setSelectedPeriodIdState] = React.useState(
    pinnedPeriodId ?? ''
  );

  React.useEffect(() => {
    if (pinnedPeriodId != null) {
      setSelectedPeriodIdState(pinnedPeriodId);
    }
  }, [pinnedPeriodId]);

  React.useEffect(() => {
    if (pinnedPeriodId == null && !selectedPeriodIdState && lockedPeriods.length > 0) {
      setSelectedPeriodIdState(lockedPeriods[0]!.id);
    }
  }, [lockedPeriods, pinnedPeriodId, selectedPeriodIdState]);

  const selectedPeriodId = pinnedPeriodId ?? selectedPeriodIdState;
  const selectedPeriod =
    lockedPeriods.find((period) => period.id === selectedPeriodId) ?? null;
  const selectedPeriodMissing =
    Boolean(selectedPeriodId) &&
    periodsQuery.data !== undefined &&
    selectedPeriod == null;

  const carryForwardQuery = useQuery({
    queryKey: carryForwardQueryKey(selectedPeriodId || null),
    queryFn: () => getCarryForwardView(selectedPeriodId || null),
    enabled: Boolean(selectedPeriodId) && !selectedPeriodMissing
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
  const hasCarryForward = view != null;
  const detailHref = selectedPeriod
    ? buildCarryForwardsDetailHref(selectedPeriod.id)
    : null;

  const handleGenerateCarryForward = React.useCallback(async () => {
    if (!selectedPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await mutation.mutateAsync(selectedPeriod);

      if (mode === 'overview') {
        router.push(buildCarryForwardsDetailHref(result.sourcePeriod.id));
        return;
      }

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
  }, [mode, mutation, router, selectedPeriod]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="차기 이월"
        title={
          mode === 'detail'
            ? `${selectedPeriod?.monthLabel ?? '선택 기간'} 결과 보기`
            : '이월 기준 생성 / 선택'
        }
        description={
          mode === 'detail'
            ? '선택한 잠금 기간의 이월 결과와 다음 월 오프닝 기준을 결과 화면에서 확인합니다.'
            : '잠금된 운영 기간을 고르고 차기 이월 생성 여부를 확인한 뒤 결과 화면으로 이동합니다.'
        }
        badges={[
          {
            label: selectedPeriod
              ? `${selectedPeriod.monthLabel} 이월 대상`
              : '잠금 기간 선택 필요',
            color: selectedPeriod ? 'primary' : 'warning'
          },
          {
            label: canGenerate ? '생성 권한 있음' : '생성 권한 없음',
            color: canGenerate ? 'success' : 'default'
          }
        ]}
        metadata={[
          {
            label: '잠금 기간',
            value: `${lockedPeriods.length}개`
          },
          {
            label: '대상 월',
            value: view?.targetPeriod.monthLabel ?? '없음'
          },
          {
            label: '오프닝 라인',
            value: `${view?.targetOpeningBalanceSnapshot.lines.length ?? 0}개`
          }
        ]}
        primaryActionLabel={
          mode === 'detail' && hasCarryForward
            ? '차기 이월 다시 생성'
            : '차기 이월 생성'
        }
        primaryActionOnClick={() => {
          void handleGenerateCarryForward();
        }}
        primaryActionDisabled={!selectedPeriod || !canGenerate || mutation.isPending}
        secondaryActionLabel={
          mode === 'detail'
            ? '생성 / 선택으로 돌아가기'
            : detailHref && hasCarryForward
              ? '결과 보기'
              : '재무제표 보기'
        }
        secondaryActionHref={
          mode === 'detail'
            ? '/carry-forwards'
            : detailHref && hasCarryForward
              ? detailHref
              : '/financial-statements'
        }
      />

      <CarryForwardsSectionNav selectedPeriodId={selectedPeriodId || null} />

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
        title={mode === 'detail' ? '이월 대상 전환' : '이월 기준'}
        description={
          mode === 'detail'
            ? '다른 잠금 기간으로 바로 이동하거나, 선택한 기간의 이월 상태를 다시 확인합니다.'
            : '잠금된 운영 기간을 고른 뒤, 생성과 결과 확인을 같은 흐름 안에서 분리해 진행합니다.'
        }
      >
        <Grid container spacing={appLayout.fieldGap} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              select
              fullWidth
              label="잠금된 운영 기간"
              value={selectedPeriodId}
              onChange={(event) => {
                setSelectedPeriodIdState(event.target.value);
                setFeedback(null);
                if (mode === 'detail') {
                  router.push(buildCarryForwardsDetailHref(event.target.value));
                }
              }}
              helperText={
                lockedPeriods.length > 0
                  ? '잠금된 기간만 차기 이월의 기준이 되며, 결과 화면으로 바로 이동할 수 있습니다.'
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
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={1.25}>
              <Typography variant="body2" color="text.secondary">
                {selectedPeriod
                  ? `${selectedPeriod.monthLabel} 기간은 ${readPeriodStatusLabel(selectedPeriod.status)} 상태입니다. 차기 이월은 잠금된 월의 자산·부채·자본 잔액만 다음 월 오프닝 기준으로 넘깁니다.`
                  : '잠금된 기간이 준비되면 여기서 차기 이월 상태를 확인하고 결과 화면으로 이동할 수 있습니다.'}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button
                  component={Link}
                  href="/financial-statements"
                  variant="outlined"
                >
                  재무제표 보기
                </Button>
                <Button component={Link} href="/forecast" variant="text">
                  기간 전망 보기
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>

      {selectedPeriodMissing ? (
        <SectionCard
          title="선택한 잠금 기간을 찾을 수 없습니다"
          description="잠금이 해제되었거나 잘못된 링크로 진입했을 수 있습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              현재 잠금된 운영 기간 목록으로 돌아가 다시 선택해 주세요.
            </Typography>
            <div>
              <Button component={Link} href="/carry-forwards" variant="contained">
                생성 / 선택으로 돌아가기
              </Button>
            </div>
          </Stack>
        </SectionCard>
      ) : !selectedPeriod ? (
        <SectionCard
          title="표시할 차기 이월이 없습니다"
          description="먼저 월 마감을 완료한 잠금된 운영 기간을 만들어 주세요."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              잠금된 운영 기간이 준비되면 차기 이월 생성과 결과 조회를 진행할 수
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
      ) : mode === 'overview' ? (
        <CarryForwardsOverview
          canGenerate={canGenerate}
          detailHref={detailHref}
          hasCarryForward={hasCarryForward}
          isGenerating={mutation.isPending}
          lockedPeriods={lockedPeriods}
          onGenerate={handleGenerateCarryForward}
          onSelectPeriod={setSelectedPeriodIdState}
          selectedPeriod={selectedPeriod}
          view={view}
        />
      ) : view == null ? (
        <SectionCard
          title="차기 이월이 아직 없습니다"
          description="선택한 잠금 기간에 대해 차기 이월 기록이 아직 생성되지 않았습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {selectedPeriod.monthLabel} 기간을 기준으로 차기 이월 생성을 먼저
              실행해 주세요.
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
                    : '이 결과 화면에서 바로 생성'}
                </Button>
              ) : null}
              <Button component={Link} href="/carry-forwards" variant="outlined">
                생성 / 선택으로 돌아가기
              </Button>
              <Button component={Link} href="/financial-statements" variant="text">
                재무제표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <CarryForwardsDetail
          lockedPeriods={lockedPeriods}
          selectedPeriodId={selectedPeriod.id}
          view={view}
        />
      )}
    </Stack>
  );
}

function CarryForwardsOverview({
  canGenerate,
  detailHref,
  hasCarryForward,
  isGenerating,
  lockedPeriods,
  onGenerate,
  onSelectPeriod,
  selectedPeriod,
  view
}: {
  canGenerate: boolean;
  detailHref: Route | null;
  hasCarryForward: boolean;
  isGenerating: boolean;
  lockedPeriods: AccountingPeriodItem[];
  onGenerate: () => void;
  onSelectPeriod: (periodId: string) => void;
  selectedPeriod: AccountingPeriodItem;
  view: Awaited<ReturnType<typeof getCarryForwardView>> | undefined;
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
                  <Button component={Link} href={detailHref} variant="contained">
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
                {canGenerate && hasCarryForward ? (
                  <Button
                    variant="outlined"
                    onClick={onGenerate}
                    disabled={isGenerating}
                  >
                    현재 기준으로 다시 생성
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
                {readOpeningSourceLabel(view?.targetOpeningBalanceSnapshot.sourceKind)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                자산 합계:{' '}
                {formatWon(view?.sourceClosingSnapshot.totalAssetAmount ?? 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                부채 합계:{' '}
                {formatWon(view?.sourceClosingSnapshot.totalLiabilityAmount ?? 0)}
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
                    backgroundColor: isSelected ? 'action.selected' : 'background.paper'
                  }}
                >
                  <Typography variant="subtitle1">{period.monthLabel}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {readPeriodStatusLabel(period.status)} 상태의 차기 이월 기준입니다.
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

function CarryForwardsDetail({
  lockedPeriods,
  selectedPeriodId,
  view
}: {
  lockedPeriods: AccountingPeriodItem[];
  selectedPeriodId: string;
  view: NonNullable<Awaited<ReturnType<typeof getCarryForwardView>>>;
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
              variant={period.id === selectedPeriodId ? 'contained' : 'outlined'}
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
              value={readOpeningSourceLabel(view.targetOpeningBalanceSnapshot.sourceKind)}
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
              value={formatWon(view.sourceClosingSnapshot.totalLiabilityAmount)}
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
                {line.fundingAccountName ? ` / ${line.fundingAccountName}` : ''} |{' '}
                {formatWon(line.balanceAmount)}
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

function buildCarryForwardsDetailHref(periodId: string) {
  return `/carry-forwards/${periodId}` as Route;
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
