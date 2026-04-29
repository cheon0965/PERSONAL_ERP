'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Grid, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { buildErrorFeedback } from '@/shared/api/fetch-json';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useAppNotification } from '@/shared/providers/notification-provider';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import { FinancialStatementsSectionNav } from './financial-statements-section-nav';
import {
  buildFinancialStatementsFallbackView,
  financialStatementsQueryKey,
  generateFinancialStatements,
  getFinancialStatements
} from './financial-statements.api';
import {
  buildFinancialStatementsDetailHref,
  FinancialStatementsDetail,
  FinancialStatementsOverview,
  readPeriodStatusLabel
} from './financial-statements-page.sections';

type FinancialStatementsPageMode = 'overview' | 'detail';

type FinancialStatementsPageProps = {
  mode?: FinancialStatementsPageMode;
  selectedPeriodId?: string | null;
};

export function FinancialStatementsPage({
  mode = 'overview',
  selectedPeriodId: pinnedPeriodId = null
}: FinancialStatementsPageProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notifySuccess } = useAppNotification();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<FeedbackAlertValue>(null);
  const periodsQuery = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });

  useDomainHelp(buildFinancialStatementsHelpContext(mode));

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

  const statementsQuery = useQuery({
    queryKey: financialStatementsQueryKey(selectedPeriodId || null),
    queryFn: () => getFinancialStatements(selectedPeriodId || null),
    enabled: Boolean(selectedPeriodId) && !selectedPeriodMissing
  });

  const mutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      generateFinancialStatements(
        {
          periodId: period.id
        },
        buildFinancialStatementsFallbackView(period)
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: financialStatementsQueryKey(result.period.id)
      });
    }
  });

  const membershipRole = user?.currentWorkspace?.membership.role ?? null;
  const canGenerate =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const view = statementsQuery.data;
  const hasStatements = Boolean(view && view.snapshots.length > 0);
  const detailHref = selectedPeriod
    ? buildFinancialStatementsDetailHref(selectedPeriod.id)
    : null;

  const handleGenerateSnapshot = React.useCallback(async () => {
    if (!selectedPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await mutation.mutateAsync(selectedPeriod);

      if (mode === 'overview') {
        router.push(buildFinancialStatementsDetailHref(result.period.id));
        return;
      }

      notifySuccess(
        `${result.period.monthLabel} 공식 재무제표 스냅샷을 생성했습니다.`
      );
    } catch (error) {
      setFeedback(
        buildErrorFeedback(error, '재무제표 스냅샷을 생성하지 못했습니다.')
      );
    }
  }, [mode, mutation, router, selectedPeriod]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="공식 보고"
        title={
          mode === 'detail'
            ? `${selectedPeriod?.monthLabel ?? '선택 기간'} 보고서 보기`
            : '재무제표 생성 / 선택'
        }
        description={
          mode === 'detail'
            ? '선택한 잠금 기간의 공식 재무제표, 전기 대비 비교, 기초 잔액 기준선을 보고서 화면에서 확인합니다.'
            : '잠금된 운영 월을 고르고 공식 재무제표 생성 여부를 확인한 뒤 보고서 화면으로 이동합니다.'
        }
        badges={[
          {
            label: selectedPeriod
              ? `${selectedPeriod.monthLabel} 보고 대상`
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
            label: '표시 스냅샷',
            value: `${view?.snapshots.length ?? 0}개`
          },
          {
            label: '전기 비교',
            value: view?.previousPeriod?.monthLabel ?? '없음'
          }
        ]}
        primaryActionLabel={
          mode === 'detail' && hasStatements
            ? '공식 재무제표 재생성'
            : '공식 재무제표 생성'
        }
        primaryActionOnClick={() => {
          void handleGenerateSnapshot();
        }}
        primaryActionDisabled={
          !selectedPeriod || !canGenerate || mutation.isPending
        }
        secondaryActionLabel={
          mode === 'detail'
            ? '생성 / 선택으로 돌아가기'
            : detailHref && hasStatements
              ? '보고서 보기'
              : '차기 이월 보기'
        }
        secondaryActionHref={
          mode === 'detail'
            ? '/financial-statements'
            : detailHref && hasStatements
              ? detailHref
              : '/carry-forwards'
        }
      />

      <FinancialStatementsSectionNav
        selectedPeriodId={selectedPeriodId || null}
      />

      <FeedbackAlert feedback={feedback} />

      {periodsQuery.error ? (
        <QueryErrorAlert
          title="잠금된 운영 기간 목록을 불러오지 못했습니다."
          error={periodsQuery.error}
        />
      ) : null}

      {statementsQuery.error ? (
        <QueryErrorAlert
          title="재무제표 스냅샷을 불러오지 못했습니다."
          error={statementsQuery.error}
        />
      ) : null}

      <SectionCard
        title={mode === 'detail' ? '보고 대상 전환' : '보고 기준'}
        description={
          mode === 'detail'
            ? '다른 잠금 기간으로 바로 이동하거나, 선택한 기간의 생성 상태를 다시 확인합니다.'
            : '잠금된 운영 기간을 고르고, 생성과 조회를 같은 흐름 안에서 분리해 진행합니다.'
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
                  router.push(
                    buildFinancialStatementsDetailHref(event.target.value)
                  );
                }
              }}
              helperText={
                lockedPeriods.length > 0
                  ? '잠금된 기간을 선택하면 생성 여부를 확인하고, 보고서 보기 화면으로 바로 이동할 수 있습니다.'
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
                  ? `${selectedPeriod.monthLabel} 기간은 ${readPeriodStatusLabel(selectedPeriod.status)} 상태입니다. 공식 재무제표는 잠금된 기간만 생성할 수 있고, 운영 판단 화면과 분리된 공식 보고 기준으로 읽습니다.`
                  : '잠금된 기간이 준비되면 여기서 생성 상태를 확인하고 공식 보고서 화면으로 이동할 수 있습니다.'}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                useFlexGap
                flexWrap="wrap"
              >
                <Button component={Link} href="/periods" variant="outlined">
                  운영 월 보기
                </Button>
                <Button component={Link} href="/carry-forwards" variant="text">
                  차기 이월 보기
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
                href="/financial-statements"
                variant="contained"
              >
                생성 / 선택으로 돌아가기
              </Button>
            </div>
          </Stack>
        </SectionCard>
      ) : !selectedPeriod ? (
        <SectionCard
          title="표시할 재무제표가 없습니다"
          description="먼저 월 마감을 완료해 잠금된 운영 기간을 만들어 주세요."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              재무제표 스냅샷은 잠금된 기간 위에서만 동작합니다.
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
                href="/journal-entries"
                variant="outlined"
              >
                전표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : mode === 'overview' ? (
        <FinancialStatementsOverview
          canGenerate={canGenerate}
          detailHref={detailHref}
          hasStatements={hasStatements}
          isGenerating={mutation.isPending}
          lockedPeriods={lockedPeriods}
          onGenerate={handleGenerateSnapshot}
          onSelectPeriod={setSelectedPeriodIdState}
          selectedPeriod={selectedPeriod}
          view={view}
        />
      ) : view == null || view.snapshots.length === 0 ? (
        <SectionCard
          title="공식 스냅샷이 아직 없습니다"
          description="선택한 잠금 기간에 대한 공식 재무제표가 아직 생성되지 않았습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {selectedPeriod.monthLabel} 기간에 대해 공식 재무제표 생성을 먼저
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
                  onClick={handleGenerateSnapshot}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? '스냅샷 생성 중...'
                    : '이 보고서에서 바로 생성'}
                </Button>
              ) : null}
              <Button
                component={Link}
                href="/financial-statements"
                variant="outlined"
              >
                생성 / 선택으로 돌아가기
              </Button>
              <Button component={Link} href="/periods" variant="text">
                운영 월 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <FinancialStatementsDetail
          lockedPeriods={lockedPeriods}
          selectedPeriodId={selectedPeriod.id}
          view={view}
        />
      )}
    </Stack>
  );
}

function buildFinancialStatementsHelpContext(
  mode: FinancialStatementsPageMode
) {
  if (mode === 'detail') {
    return {
      title: '보고서 보기 도움말',
      description:
        '이 화면은 선택한 잠금 기간의 공식 재무제표 스냅샷과 전기 대비 변동, 시작 기준선을 읽는 보고서 화면입니다.',
      primaryEntity: '공식 재무제표 보고서',
      relatedEntities: [
        '월 마감 스냅샷',
        '차기 이월 기록',
        '기초 잔액 기준',
        '전표'
      ],
      truthSource:
        '공식 재무제표는 잠금된 기간의 마감 결과와 전표를 근거로 생성되며, 기초 잔액은 차기 이월 또는 초기 설정을 따릅니다.',
      supplementarySections: [
        {
          title: '이 탭에서 하는 일',
          items: [
            '보고 대상 기간과 직전 잠금 기간이 맞는지 먼저 확인합니다.',
            '재무상태표, 손익보고서, 현금흐름, 순자산 변동표의 요약과 전기 대비 변동을 검토합니다.',
            '숫자 기준선이 의심되면 이월 및 기준선 정보와 전표 흐름을 함께 확인합니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '재무제표 생성 / 선택',
              description: '다른 잠금 기간을 고르거나 공식 스냅샷을 다시 생성합니다.',
              href: '/financial-statements',
              actionLabel: '생성 / 선택 보기'
            },
            {
              title: '차기 이월',
              description: '보고 숫자가 다음 월 시작 기준으로 어떻게 이어지는지 확인합니다.',
              href: '/carry-forwards',
              actionLabel: '차기 이월 보기'
            },
            {
              title: '전표 조회',
              description: '이상한 숫자가 보이면 전표 기준으로 원인을 추적합니다.',
              href: '/journal-entries',
              actionLabel: '전표 보기'
            }
          ]
        }
      ],
      readModelNote:
        '대시보드와 전망은 운영 판단용입니다. 공식 보고 숫자는 잠금된 기간을 대상으로 이 화면에서 생성한 스냅샷을 기준으로 봅니다.'
    };
  }

  return {
    title: '재무제표 생성 / 선택 도움말',
    description:
      '이 화면은 잠금된 운영 기간을 고르고 공식 재무제표 스냅샷 생성 여부를 확인한 뒤 보고서 화면으로 이어가는 시작 화면입니다.',
    primaryEntity: '공식 재무제표 생성',
    relatedEntities: [
      '운영 월',
      '월 마감 스냅샷',
      '차기 이월 기록',
      '기초 잔액 기준'
    ],
    truthSource:
      '공식 재무제표는 잠금된 기간의 마감 결과와 전표를 근거로 생성되며, 기초 잔액은 차기 이월 또는 초기 설정을 따릅니다.',
    supplementarySections: [
      {
        title: '이 탭에서 하는 일',
        items: [
          '잠금된 운영 기간을 고르고 공식 재무제표 생성 여부를 확인합니다.',
          '필요하면 공식 재무제표 생성을 실행한 뒤 보고서 보기 화면으로 이동합니다.',
          '다른 잠금 월과 비교할 때도 이 화면에서 대상을 다시 선택합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '잠금된 기간이 없으면 월 운영 화면에서 먼저 월 마감을 완료합니다.',
          '전표가 이상하면 전표 조회 화면에서 반전/정정 필요 여부를 확인한 뒤 재생성합니다.',
          '다음 월 시작 기준까지 이어가려면 차기 이월 화면에서 이월 기준을 생성합니다.'
        ],
        links: [
          {
            title: '월 마감',
            description:
              '재무제표를 만들 잠금 월이 없거나 마감 차단 사유가 남아 있을 때 확인합니다.',
            href: '/operations/month-end',
            actionLabel: '월 마감 보기'
          },
          {
            title: '전표 조회',
            description:
              '보고 숫자 이상 원인을 전표 라인과 조정 이력에서 추적합니다.',
            href: '/journal-entries',
            actionLabel: '전표 보기'
          },
          {
            title: '차기 이월',
            description:
              '생성한 보고 숫자를 다음 월 시작 기준으로 넘깁니다.',
            href: '/carry-forwards',
            actionLabel: '차기 이월 보기'
          }
        ]
      }
    ],
    readModelNote:
      '공식 재무제표는 운영 중 임시 숫자가 아니라 잠금된 기간의 확정 기준을 보여줍니다.'
  };
}
