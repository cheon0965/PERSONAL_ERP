'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type {
  AccountingPeriodItem,
  CarryForwardView
} from '@personal-erp/contracts';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import { CarryForwardsSectionNav } from './carry-forwards-section-nav';
import {
  buildCarryForwardsDetailHref,
  CarryForwardsDetail,
  CarryForwardsOverview,
  readPeriodStatusLabel
} from './carry-forwards-page.sections';
import {
  buildCancelCarryForwardFallback,
  buildCarryForwardFallback,
  cancelCarryForward,
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
  const { notifySuccess } = useAppNotification();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<FeedbackAlertValue>(null);
  const [confirmation, setConfirmation] = React.useState<
    'cancel' | 'regenerate' | null
  >(null);
  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  useDomainHelp(buildCarryForwardsHelpContext(mode));

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
    if (
      pinnedPeriodId == null &&
      !selectedPeriodIdState &&
      lockedPeriods.length > 0
    ) {
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

  const generationMutation = useMutation({
    mutationFn: (input: {
      period: AccountingPeriodItem;
      replaceExisting?: boolean;
    }) =>
      generateCarryForward(
        {
          fromPeriodId: input.period.id,
          replaceExisting: input.replaceExisting,
          replaceReason: input.replaceExisting
            ? '현재 마감 기준으로 차기 이월 재생성'
            : undefined
        },
        buildCarryForwardFallback(input.period)
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

  const cancelMutation = useMutation({
    mutationFn: (viewToCancel: CarryForwardView) =>
      cancelCarryForward(
        viewToCancel.carryForwardRecord.id,
        { reason: '사용자 요청으로 차기 이월 취소' },
        buildCancelCarryForwardFallback(viewToCancel)
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
  const canCancel = membershipRole === 'OWNER';
  const canRegenerate = canCancel;
  const view = carryForwardQuery.data;
  const hasCarryForward = view != null;
  const detailHref = selectedPeriod
    ? buildCarryForwardsDetailHref(selectedPeriod.id)
    : null;

  const handleGenerateCarryForward = React.useCallback(
    async (options?: { replaceExisting?: boolean }) => {
      if (!selectedPeriod) {
        return;
      }

      setFeedback(null);

      try {
        const result = await generationMutation.mutateAsync({
          period: selectedPeriod,
          replaceExisting: options?.replaceExisting
        });

        if (mode === 'overview' && !options?.replaceExisting) {
          router.push(buildCarryForwardsDetailHref(result.sourcePeriod.id));
          return;
        }

        notifySuccess(
          options?.replaceExisting
            ? `${result.sourcePeriod.monthLabel} 차기 이월을 현재 마감 기준으로 다시 생성했습니다.`
            : `${result.sourcePeriod.monthLabel} 마감 결과를 ${result.targetPeriod.monthLabel} 오프닝 기준으로 이월했습니다.`
        );
      } catch (error) {
        setFeedback(
          buildErrorFeedback(error, '차기 이월을 생성하지 못했습니다.')
        );
      }
    },
    [generationMutation, mode, router, selectedPeriod]
  );

  const handleCancelCarryForward = React.useCallback(async () => {
    if (!view) {
      return;
    }

    setFeedback(null);

    try {
      const result = await cancelMutation.mutateAsync(view);
      notifySuccess(`${result.sourcePeriod.monthLabel} 차기 이월을 취소했습니다.`);
    } catch (error) {
      setFeedback(
        buildErrorFeedback(error, '차기 이월을 취소하지 못했습니다.')
      );
    }
  }, [cancelMutation, view]);

  const handleConfirmAction = React.useCallback(async () => {
    const currentConfirmation = confirmation;
    if (!currentConfirmation) {
      return;
    }

    if (currentConfirmation === 'cancel') {
      await handleCancelCarryForward();
    } else {
      await handleGenerateCarryForward({ replaceExisting: true });
    }

    setConfirmation(null);
  }, [confirmation, handleCancelCarryForward, handleGenerateCarryForward]);

  const mutationPending =
    generationMutation.isPending || cancelMutation.isPending;

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
          if (mode === 'detail' && hasCarryForward) {
            setConfirmation('regenerate');
            return;
          }

          void handleGenerateCarryForward();
        }}
        primaryActionDisabled={
          !selectedPeriod ||
          mutationPending ||
          (mode === 'detail' && hasCarryForward ? !canRegenerate : !canGenerate)
        }
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

      <FeedbackAlert feedback={feedback} />

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
              <Button
                component={Link}
                href="/carry-forwards"
                variant="contained"
              >
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
          canCancel={canCancel}
          canGenerate={canGenerate}
          canRegenerate={canRegenerate}
          detailHref={detailHref}
          hasCarryForward={hasCarryForward}
          isCanceling={cancelMutation.isPending}
          isGenerating={generationMutation.isPending}
          lockedPeriods={lockedPeriods}
          onCancel={() => setConfirmation('cancel')}
          onGenerate={() => void handleGenerateCarryForward()}
          onRegenerate={() => setConfirmation('regenerate')}
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
                  onClick={() => {
                    void handleGenerateCarryForward();
                  }}
                  disabled={generationMutation.isPending}
                >
                  {generationMutation.isPending
                    ? '차기 이월 생성 중...'
                    : '이 결과 화면에서 바로 생성'}
                </Button>
              ) : null}
              <Button
                component={Link}
                href="/carry-forwards"
                variant="outlined"
              >
                생성 / 선택으로 돌아가기
              </Button>
              <Button
                component={Link}
                href="/financial-statements"
                variant="text"
              >
                재무제표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <CarryForwardsDetail
          canCancel={canCancel}
          canRegenerate={canRegenerate}
          isCanceling={cancelMutation.isPending}
          isRegenerating={generationMutation.isPending}
          lockedPeriods={lockedPeriods}
          onCancel={() => setConfirmation('cancel')}
          onRegenerate={() => setConfirmation('regenerate')}
          selectedPeriodId={selectedPeriod.id}
          view={view}
        />
      )}

      <ConfirmActionDialog
        open={confirmation != null}
        title={
          confirmation === 'cancel' ? '차기 이월 취소' : '차기 이월 다시 생성'
        }
        description={
          confirmation === 'cancel'
            ? `${view?.sourcePeriod.monthLabel ?? '선택 기간'} 차기 이월을 취소할까요? 다음 운영 기간에 거래, 업로드, 전표, 마감 산출물이 있으면 서버에서 차단됩니다.`
            : `${view?.sourcePeriod.monthLabel ?? '선택 기간'} 차기 이월을 현재 마감 기준으로 다시 생성할까요? 먼저 기존 오프닝 기준을 안전하게 제거한 뒤 새 기준을 만듭니다.`
        }
        confirmLabel={confirmation === 'cancel' ? '이월 취소' : '다시 생성'}
        pendingLabel={confirmation === 'cancel' ? '취소 중...' : '생성 중...'}
        confirmColor={confirmation === 'cancel' ? 'warning' : 'primary'}
        busy={mutationPending}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          void handleConfirmAction();
        }}
      />
    </Stack>
  );
}

function buildCarryForwardsHelpContext(mode: CarryForwardsPageMode) {
  if (mode === 'detail') {
    return {
      title: '차기 이월 결과 도움말',
      description:
        '이 화면은 선택한 잠금 기간의 이월 결과와 다음 월 오프닝 기준선을 읽는 결과 화면입니다.',
      primaryEntity: '차기 이월 결과',
      relatedEntities: ['월 마감 스냅샷', '다음 월 기초 잔액', '운영 기간'],
      truthSource:
        '차기 이월은 잠금된 기간의 마감 결과와 잔액 라인을 근거로 생성됩니다.',
      supplementarySections: [
        {
          title: '이 탭에서 하는 일',
          items: [
            '이전 월과 다음 월 연결이 맞는지 먼저 확인합니다.',
            '마감 기준의 자산, 부채, 자본 합계가 의도한 기준인지 확인합니다.',
            '다음 월 오프닝 라인에서 자금수단과 계정과목별 시작 잔액을 검토합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '이월 기준 생성 / 선택',
              description:
                '다른 잠금 기간을 고르거나 차기 이월을 다시 생성합니다.',
              href: '/carry-forwards',
              actionLabel: '생성 / 선택 보기'
            },
            {
              title: '기간 운영 전망',
              description: '다음 월 준비 상태와 운영 여력을 이어서 확인합니다.',
              href: '/forecast',
              actionLabel: '기간 운영 전망 보기'
            },
            {
              title: '재무제표 생성 / 선택',
              description: '이월 전 보고 숫자와 공식 기준을 다시 확인합니다.',
              href: '/financial-statements',
              actionLabel: '재무제표 보기'
            }
          ]
        }
      ],
      readModelNote:
        '차기 이월은 손익 계정을 직접 넘기지 않고, 잠금 시점의 자산·부채·자본 잔액만 다음 월 오프닝 기준으로 전달합니다.'
    };
  }

  return {
    title: '이월 기준 생성 / 선택 도움말',
    description:
      '이 화면은 잠금된 운영 기간을 고르고 차기 이월 생성 여부를 확인한 뒤 결과 화면으로 이어가는 시작 화면입니다.',
    primaryEntity: '차기 이월 생성',
    relatedEntities: ['월 마감 스냅샷', '다음 월 기초 잔액', '운영 기간'],
    truthSource:
      '차기 이월은 잠금된 기간의 마감 결과와 잔액 라인을 근거로 생성됩니다.',
    supplementarySections: [
      {
        title: '이 탭에서 하는 일',
        items: [
          '잠금된 운영 기간을 선택해 차기 이월 생성 여부를 확인합니다.',
          '차기 이월 생성을 눌러 선택한 월의 마감 잔액을 다음 월 오프닝 기준으로 넘깁니다.',
          '생성이 끝나면 결과 보기 화면에서 이전 월과 다음 월 연결이 맞는지 검토합니다.'
        ]
      },
      {
        title: '다음 단계',
        items: [
          '이월 결과를 확인한 뒤 기간 전망에서 다음 월 준비 상태와 안전 여력을 확인합니다.',
          '다음 운영 월을 실제로 진행하려면 월 운영 화면에서 대상 월 상태를 확인합니다.',
          '이월 전 보고 숫자를 다시 보고 싶으면 재무제표 화면으로 돌아갑니다.'
        ],
        links: [
          {
            title: '기간 운영 전망',
            description:
              '다음 월 준비 상태와 안전 여력을 이월 기준과 함께 확인합니다.',
            href: '/forecast',
            actionLabel: '기간 운영 전망 보기'
          },
          {
            title: '운영 기간',
            description:
              '다음 운영 월이 열려 있는지, 잠금 월과 이력 연결이 맞는지 확인합니다.',
            href: '/periods',
            actionLabel: '운영 기간 보기'
          },
          {
            title: '재무제표 생성 / 선택',
            description:
              '이월 전 공식 보고 숫자를 다시 확인합니다.',
            href: '/financial-statements',
            actionLabel: '재무제표 보기'
          }
        ]
      }
    ],
    readModelNote:
      '차기 이월은 공식 보고를 다음 월 시작 기준으로 이어 주는 단계입니다. 잠금된 운영 기간이 없으면 이 흐름도 시작할 수 없습니다.'
  };
}
