'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Alert,
  Button,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  FinancialStatementKind
} from '@personal-erp/contracts';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { useAuthSession } from '@/shared/auth/auth-provider';
import {
  accountingPeriodsQueryKey,
  getAccountingPeriods
} from '@/features/accounting-periods/accounting-periods.api';
import {
  buildFinancialStatementsFallbackView,
  financialStatementsQueryKey,
  generateFinancialStatements,
  getFinancialStatements
} from './financial-statements.api';

export function FinancialStatementsPage() {
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
    title: '재무제표 사용 가이드',
    description:
      '이 화면은 월 마감으로 잠금된 기간의 공식 보고 스냅샷을 생성하고 확인하는 곳입니다. 운영 중 임시 숫자가 아니라 마감된 전표와 스냅샷을 기준으로 봅니다.',
    primaryEntity: '공식 재무제표',
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
        title: '바로 쓰는 순서',
        items: [
          '보고 대상 선택에서 잠금된 운영 기간을 고릅니다.',
          '공식 재무제표 생성을 눌러 해당 기간의 보고 스냅샷을 만듭니다.',
          '보고 대상, 직전 잠금 기간, 기초 잔액 출처를 먼저 확인합니다.',
          '이월 및 기준선에서 어떤 마감/이월 기록을 기준으로 시작했는지 확인합니다.',
          '재무상태표, 손익보고서, 현금흐름, 순자산 변동표의 요약과 전기 대비 변동을 검토합니다.'
        ]
      },
      {
        title: '막히면 확인',
        items: [
          '잠금된 기간이 없으면 월 운영 화면에서 먼저 월 마감을 완료합니다.',
          '전표가 이상하면 전표 조회 화면에서 반전/정정 필요 여부를 확인한 뒤 재생성합니다.',
          '다음 월 시작 기준까지 이어가려면 차기 이월 화면에서 이월 기준을 생성합니다.'
        ]
      }
    ],
    readModelNote:
      '대시보드와 전망은 운영 판단용입니다. 공식 보고 숫자는 잠금된 기간을 대상으로 이 화면에서 생성한 스냅샷을 기준으로 봅니다.'
  });

  const lockedPeriods = React.useMemo(
    () =>
      (periodsQuery.data ?? []).filter((period) => period.status === 'LOCKED'),
    [periodsQuery.data]
  );

  const [selectedPeriodId, setSelectedPeriodId] = React.useState<string>('');

  React.useEffect(() => {
    if (!selectedPeriodId && lockedPeriods.length > 0) {
      setSelectedPeriodId(lockedPeriods[0]!.id);
    }
  }, [lockedPeriods, selectedPeriodId]);

  const selectedPeriod =
    lockedPeriods.find((period) => period.id === selectedPeriodId) ?? null;

  const statementsQuery = useQuery({
    queryKey: financialStatementsQueryKey(selectedPeriodId || null),
    queryFn: () => getFinancialStatements(selectedPeriodId || null),
    enabled: Boolean(selectedPeriodId)
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
  const handleGenerateSnapshot = React.useCallback(async () => {
    if (!selectedPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await mutation.mutateAsync(selectedPeriod);
      setFeedback({
        severity: 'success',
        message: `${result.period.monthLabel} 공식 재무제표 스냅샷을 생성했습니다.`
      });
    } catch (error) {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '재무제표 스냅샷을 생성하지 못했습니다.'
      });
    }
  }, [mutation, selectedPeriod]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="공식 보고"
        title="재무제표"
        description="잠금된 운영 월의 공식 재무제표와 전기 대비 비교, 기초 잔액 기준선을 함께 확인합니다."
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
        primaryActionLabel="공식 재무제표 생성"
        primaryActionOnClick={() => {
          void handleGenerateSnapshot();
        }}
        primaryActionDisabled={!selectedPeriod || !canGenerate || mutation.isPending}
        secondaryActionLabel="차기 이월 보기"
        secondaryActionHref="/carry-forwards"
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

      {statementsQuery.error ? (
        <QueryErrorAlert
          title="재무제표 스냅샷을 불러오지 못했습니다."
          error={statementsQuery.error}
        />
      ) : null}

      <SectionCard
        title="보고 기준"
        description="잠금된 운영 기간을 고르고, 같은 흐름에서 스냅샷 생성과 조회를 이어갑니다."
      >
        <Grid container spacing={appLayout.fieldGap} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 5 }}>
            <TextField
              select
              fullWidth
              label="잠금된 운영 기간"
              value={selectedPeriodId}
              onChange={(event) => {
                setSelectedPeriodId(event.target.value);
                setFeedback(null);
              }}
              helperText={
                lockedPeriods.length > 0
                  ? '잠금된 기간을 선택하면 스냅샷 생성, 조회, 전기 비교를 함께 확인할 수 있습니다.'
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
                  ? `${selectedPeriod.monthLabel} 기간은 ${readPeriodStatusLabel(selectedPeriod.status)} 상태입니다. 공식 재무제표는 잠금된 기간만 생성할 수 있고, 운영 해석 화면과 분리된 공식 보고 기준으로 읽습니다.`
                  : '잠금된 기간이 준비되면 여기서 바로 스냅샷 생성과 조회를 이어갈 수 있습니다.'}
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
                <Button component={Link} href="/journal-entries" variant="text">
                  전표 보기
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>

      {!selectedPeriod ? (
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
              <Button component={Link} href="/journal-entries" variant="outlined">
                전표 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : view == null || view.snapshots.length === 0 ? (
        <SectionCard
          title="공식 스냅샷이 아직 없습니다"
          description="잠금된 기간은 있지만, 아직 공식 재무제표가 생성되지 않았습니다."
        >
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              {selectedPeriod.monthLabel} 기간에 대해 공식 재무제표 생성을 실행해
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
                  onClick={handleGenerateSnapshot}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending
                    ? '스냅샷 생성 중...'
                    : '이 화면에서 바로 생성'}
                </Button>
              ) : null}
              <Button component={Link} href="/periods" variant="outlined">
                운영 월 보기
              </Button>
            </Stack>
          </Stack>
        </SectionCard>
      ) : (
        <Stack spacing={appLayout.sectionGap}>
          {view.warnings.map((warning) => (
            <Alert key={warning} severity="info" variant="outlined">
              {warning}
            </Alert>
          ))}

          <SectionCard
            title="보고 기준 요약"
            description="생성 대상, 전기 비교, 기초 잔액 기준선을 먼저 확인한 뒤 상세 보고서로 내려갑니다."
          >
            <Grid container spacing={appLayout.fieldGap}>
              <Grid size={{ xs: 12, md: 4 }}>
                <ReportInfoItem
                  label="보고 대상"
                  value={view.period.monthLabel}
                  description={`상태: ${readPeriodStatusLabel(view.period.status)}`}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <ReportInfoItem
                  label="직전 잠금 기간"
                  value={view.previousPeriod?.monthLabel ?? '없음'}
                  description={
                    view.previousPeriod
                      ? '전기 대비 비교 카드와 지표에 사용합니다.'
                      : '비교 가능한 직전 잠금 기간이 아직 없습니다.'
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <ReportInfoItem
                  label="기초 잔액 출처"
                  value={readOpeningSourceLabel(
                    view.basis.openingBalanceSourceKind
                  )}
                  description={
                    view.basis.sourceMonthLabel
                      ? `${view.basis.sourceMonthLabel} 마감/이월에서 이어졌습니다.`
                      : '초기 설정 또는 직접 생성 기준입니다.'
                  }
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard
            title="이월 및 기준선"
            description="이 재무제표가 어느 마감과 이월 기록을 기준으로 시작했는지 추적합니다."
          >
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                기초 잔액 출처:{' '}
                {readOpeningSourceLabel(view.basis.openingBalanceSourceKind)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                차기 이월 기록: {view.basis.carryForwardRecordId ?? '없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기준 마감 스냅샷:{' '}
                {view.basis.sourceClosingSnapshotId ?? '없음'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                기준 월: {view.basis.sourceMonthLabel ?? '없음'}
              </Typography>
            </Stack>
          </SectionCard>

          <Grid container spacing={appLayout.sectionGap}>
            {view.comparison.map((comparison) => (
              <Grid key={comparison.statementKind} size={{ xs: 12, lg: 6 }}>
                <SectionCard
                  title={`${readStatementKindLabel(comparison.statementKind)} 비교`}
                  description={
                    view.previousPeriod
                      ? `${view.period.monthLabel} vs ${view.previousPeriod.monthLabel}`
                      : `${view.period.monthLabel} 단독 요약`
                  }
                >
                  <Stack spacing={1.2}>
                    {comparison.metrics.map((metric) => (
                      <Stack
                        key={`${comparison.statementKind}-${metric.label}`}
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {metric.label}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {formatWon(metric.currentAmountWon)}
                          {metric.deltaWon === null
                            ? ''
                            : ` / ${formatWon(metric.deltaWon)} 변동`}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </SectionCard>
              </Grid>
            ))}
          </Grid>

          <Stack spacing={appLayout.sectionGap}>
            {view.snapshots.map((snapshot) => (
              <SectionCard
                key={snapshot.id}
                title={readStatementKindLabel(snapshot.statementKind)}
                description={`${snapshot.monthLabel} 기준 공식 보고 스냅샷입니다.`}
              >
                <Stack spacing={appLayout.cardGap}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">핵심 요약</Typography>
                    {snapshot.payload.summary.map((item) => (
                      <Typography
                        key={item.label}
                        variant="body2"
                        color="text.secondary"
                      >
                        {item.label}: {formatWon(item.amountWon)}
                      </Typography>
                    ))}
                  </Stack>

                  <Stack spacing={appLayout.fieldGap}>
                    {snapshot.payload.sections.map((section) => (
                      <Stack key={section.title} spacing={1}>
                        <Typography variant="subtitle2">
                          {section.title}
                        </Typography>
                        {section.items.length > 0 ? (
                          section.items.map((item) => (
                            <Typography
                              key={`${section.title}-${item.label}`}
                              variant="body2"
                              color="text.secondary"
                            >
                              {item.label}: {formatWon(item.amountWon)}
                            </Typography>
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            표시할 항목이 없습니다.
                          </Typography>
                        )}
                      </Stack>
                    ))}
                  </Stack>

                  {snapshot.payload.notes.length > 0 ? (
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">메모</Typography>
                      {snapshot.payload.notes.map((note) => (
                        <Typography
                          key={note}
                          variant="body2"
                          color="text.secondary"
                        >
                          {note}
                        </Typography>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </SectionCard>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function readStatementKindLabel(statementKind: FinancialStatementKind) {
  switch (statementKind) {
    case 'STATEMENT_OF_FINANCIAL_POSITION':
      return '사업 재무상태표';
    case 'MONTHLY_PROFIT_AND_LOSS':
      return '월간 손익보고서';
    case 'CASH_FLOW_SUMMARY':
      return '현금흐름 요약표';
    case 'NET_WORTH_MOVEMENT':
      return '순자산 변동표';
    default:
      return statementKind;
  }
}

function ReportInfoItem({
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

function readOpeningSourceLabel(sourceKind: string | null) {
  switch (sourceKind) {
    case 'INITIAL_SETUP':
      return '초기 설정';
    case 'CARRY_FORWARD':
      return '차기 이월';
    default:
      return '없음';
  }
}

function readPeriodStatusLabel(status: string) {
  switch (status) {
    case 'LOCKED':
      return '잠금';
    case 'CLOSING':
      return '마감 중';
    case 'IN_REVIEW':
      return '검토 중';
    case 'OPEN':
      return '열림';
    default:
      return status;
  }
}
