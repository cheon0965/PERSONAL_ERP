'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import type {
  AccountingPeriodItem,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { parseMoneyWon } from '@personal-erp/money';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import {
  accountSubjectsQueryKey,
  fundingAccountsManagementQueryKey,
  getAccountSubjects,
  getFundingAccounts,
  getReferenceDataReadiness,
  referenceDataReadinessQueryKey
} from '@/features/reference-data/reference-data.api';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { getTodayMonthInputValue } from '@/shared/lib/date-input';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import {
  accountingPeriodsQueryKey,
  buildCloseAccountingPeriodFallback,
  buildReopenAccountingPeriodFallback,
  closeAccountingPeriod,
  currentAccountingPeriodQueryKey,
  getAccountingPeriods,
  openAccountingPeriod,
  reopenAccountingPeriod
} from './accounting-periods.api';
import {
  CurrentPeriodStatusSection,
  periodColumns
} from './accounting-periods-page.sections';
import {
  buildOpeningBalanceTotals,
  isBalanceSheetAccountSubject,
  normalizeOptionalIdentifier,
  readMembershipRoleLabel
} from './accounting-periods-page.helpers';
import {
  PeriodOperationsSection,
  type PeriodOperationTab
} from './accounting-periods-page.lifecycle-section';
import {
  PeriodsSectionNav,
  type PeriodWorkspaceSection
} from './periods-section-nav';
import {
  createEmptyOpeningBalanceLine,
  periodFormSchema,
  type PeriodFormInput,
  type ReopenAccountingPeriodPayload,
  type SubmitFeedback
} from './accounting-periods-page.types';

export function AccountingPeriodsPage({
  section = 'overview'
}: {
  section?: PeriodWorkspaceSection;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const [closeNote, setCloseNote] = React.useState('');
  const [reopenReason, setReopenReason] = React.useState('');
  const [latestClosingResult, setLatestClosingResult] =
    React.useState<CloseAccountingPeriodResponse | null>(null);
  const { data: periods = [], error } = useQuery({
    queryKey: accountingPeriodsQueryKey,
    queryFn: getAccountingPeriods
  });
  const referenceDataReadinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
  });
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const fundingAccountsQuery = useQuery({
    queryKey: fundingAccountsManagementQueryKey,
    queryFn: () => getFundingAccounts({ includeInactive: true })
  });
  const currentWorkspace = user?.currentWorkspace ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const workspaceLabel = currentWorkspace
    ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
    : '-';
  const ledgerLabel = currentWorkspace?.ledger?.name ?? '-';
  const latestClosingSnapshotFacts = latestClosingResult
    ? [
        {
          label: '마감 월',
          value: latestClosingResult.period.monthLabel
        },
        {
          label: '자산 합계',
          value: formatWon(latestClosingResult.closingSnapshot.totalAssetAmount)
        },
        {
          label: '부채 합계',
          value: formatWon(
            latestClosingResult.closingSnapshot.totalLiabilityAmount
          )
        },
        {
          label: '자본 합계',
          value: formatWon(
            latestClosingResult.closingSnapshot.totalEquityAmount
          )
        },
        {
          label: '당기 손익',
          value: formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)
        }
      ]
    : undefined;
  const latestClosingSnapshotItems = latestClosingResult
    ? latestClosingResult.closingSnapshot.lines.map((line) => {
        const fundingAccountSuffix = line.fundingAccountName
          ? ` / ${line.fundingAccountName}`
          : '';

        return `${line.accountSubjectCode} ${line.accountSubjectName}${fundingAccountSuffix} · ${formatWon(line.balanceAmount)}`;
      })
    : [
        '아직 이 세션에서 생성한 마감 스냅샷이 없습니다. 현재 열린 기간을 마감하면 요약이 도메인 가이드에 표시됩니다.'
      ];

  useDomainHelp({
    title: '월 운영 사용 가이드',
    description:
      '이 화면은 한 달 운영을 열고 닫는 기준점입니다. 운영 기간을 열어야 계획 항목, 업로드 승격, 수집 거래 입력, 전표 확정이 같은 월 안에서 움직입니다.',
    primaryEntity: '운영 기간',
    relatedEntities: [
      '기간 상태 이력',
      '기초 잔액 기준',
      '사업 장부',
      '사용자 권한'
    ],
    truthSource:
      '운영 기간의 상태가 월별 쓰기 가능 여부를 결정하며, 첫 월 시작 시 입력한 기초 잔액이 이후 마감과 이월의 시작 기준이 됩니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '월 운영 시작과 마감은 현재 로그인한 사용자의 사업 장부 문맥 안에서만 실행됩니다.',
        facts: [
          {
            label: '사업장',
            value: workspaceLabel
          },
          {
            label: '장부',
            value: ledgerLabel
          },
          {
            label: '권한',
            value: membershipRole ?? '-'
          },
          {
            label: '기준 통화 / 시간대',
            value: currentWorkspace?.ledger
              ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
              : '-'
          }
        ]
      },
      {
        title: '바로 쓰는 순서',
        description:
          '월 운영은 시작, 진행, 마감, 필요 시 재오픈 순서로 다룹니다.',
        items: [
          '열린 기간이 없으면 기준 데이터 readiness를 확인한 뒤 월 운영 시작에서 대상 월을 엽니다.',
          '첫 월이면 기초 잔액 라인을 1건 이상 입력해 시작 기준을 남깁니다.',
          '열린 기간이 있으면 계획 항목, 업로드 배치, 수집 거래 화면에서 월 운영을 진행합니다.',
          '전표 준비 거래를 모두 확정한 뒤 월 마감에서 현재 열린 월을 잠급니다.',
          '마감 후 정정이 필요할 때만 재오픈 사유를 남기고 다시 엽니다.'
        ]
      },
      {
        title: '최근 마감 스냅샷',
        description: latestClosingResult
          ? '가장 최근에 실행한 월 마감 요약입니다.'
          : '최근 마감 결과는 본문 대신 도메인 가이드에서 확인할 수 있습니다.',
        facts: latestClosingSnapshotFacts,
        items: latestClosingSnapshotItems
      }
    ],
    readModelNote:
      '마감은 미확정 수집 거래가 남아 있으면 실패할 수 있습니다. 막히면 수집 거래 화면에서 전표 준비와 확정 상태를 먼저 정리합니다.'
  });

  const form = useForm<PeriodFormInput>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      month: getTodayMonthInputValue(),
      initializeOpeningBalance: true,
      openingBalanceLines: [],
      note: ''
    }
  });
  const {
    fields: openingBalanceFields,
    append: appendOpeningBalanceLine,
    remove: removeOpeningBalanceLine,
    replace: replaceOpeningBalanceLines
  } = useFieldArray({
    control: form.control,
    name: 'openingBalanceLines'
  });

  const hasWorkspace = Boolean(currentWorkspace?.ledger);
  const canOpenPeriod =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const canClosePeriod = membershipRole === 'OWNER';
  const canReopenPeriod = membershipRole === 'OWNER';
  const isFirstPeriod = periods.length === 0;
  const openPeriod = React.useMemo(
    () => periods.find((period) => period.status !== 'LOCKED') ?? null,
    [periods]
  );
  const latestPeriod = periods[0] ?? null;
  const reopenPeriod = latestPeriod?.status === 'LOCKED' ? latestPeriod : null;
  const currentPeriod = openPeriod ?? latestPeriod ?? null;
  const lockedPeriodCount = React.useMemo(
    () => periods.filter((period) => period.status === 'LOCKED').length,
    [periods]
  );
  const periodStatusSummary = React.useMemo(() => {
    const counts = {
      OPEN: 0,
      IN_REVIEW: 0,
      CLOSING: 0,
      LOCKED: 0
    };

    periods.forEach((period) => {
      counts[period.status] += 1;
    });

    return counts;
  }, [periods]);
  const balanceSheetAccountSubjects = React.useMemo(
    () =>
      (accountSubjectsQuery.data ?? []).filter((accountSubject) =>
        isBalanceSheetAccountSubject(accountSubject)
      ),
    [accountSubjectsQuery.data]
  );
  const openingBalanceFundingAccounts = React.useMemo(
    () =>
      (fundingAccountsQuery.data ?? []).filter(
        (fundingAccount) => fundingAccount.status !== 'CLOSED'
      ),
    [fundingAccountsQuery.data]
  );
  const focusedOperationTab: PeriodOperationTab =
    section === 'open'
      ? 'open'
      : openPeriod
        ? 'close'
        : reopenPeriod
          ? 'reopen'
          : 'close';
  const pageTitle =
    section === 'overview'
      ? '운영 기간'
      : section === 'open'
        ? '월 운영 시작'
        : section === 'close'
          ? '월 마감 / 재오픈'
          : '운영 기간 이력';
  const pageDescription =
    section === 'overview'
      ? '현재 운영 월 상태와 다음 작업을 먼저 확인하고, 실제 시작·마감·이력 화면으로 이어지는 기준 허브입니다.'
      : section === 'open'
        ? '새 운영 월과 기초 잔액 기준을 집중해서 준비하는 화면입니다.'
        : section === 'close'
          ? '열린 운영 월의 마감과 최근 잠금 월 재오픈 여부를 별도 작업 화면에서 관리합니다.'
          : '운영 기간 상태 이력과 기초 잔액 출처를 이력 중심으로 검토하는 화면입니다.';
  const primaryAction =
    section === 'overview'
      ? openPeriod
        ? {
            label: '월 마감 작업',
            href: '/periods/close' as const
          }
        : {
            label: '월 운영 시작',
            href: '/periods/open' as const
          }
      : section === 'open'
        ? openPeriod
          ? {
              label: '현재 상태 보기',
              href: '/periods' as const
            }
          : {
              label: '입력 작업대로 이동',
              href: '#open-accounting-period-form' as const
            }
        : section === 'close'
          ? {
              label: '마감 작업대로 이동',
              href: '#accounting-period-workbench' as const
            }
          : {
              label: '월 운영 시작',
              href: '/periods/open' as const
            };
  const secondaryAction =
    section === 'history'
      ? {
          label: '현재 상태 보기',
          href: '/periods' as const
        }
      : {
          label: '기간 이력',
          href: '/periods/history' as const
        };

  React.useEffect(() => {
    form.setValue('initializeOpeningBalance', isFirstPeriod, {
      shouldValidate: false
    });
  }, [form, isFirstPeriod]);

  React.useEffect(() => {
    if (!isFirstPeriod && openingBalanceFields.length > 0) {
      replaceOpeningBalanceLines([]);
    }
  }, [isFirstPeriod, openingBalanceFields.length, replaceOpeningBalanceLines]);

  const openMutation = useMutation({
    mutationFn: (payload: OpenAccountingPeriodRequest) =>
      openAccountingPeriod(payload),
    onSuccess: async () => {
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const closeMutation = useMutation({
    mutationFn: (period: AccountingPeriodItem) =>
      closeAccountingPeriod(
        period.id,
        { note: closeNote.trim() || undefined },
        buildCloseAccountingPeriodFallback(period, {
          note: closeNote.trim() || undefined
        })
      ),
    onSuccess: async (result) => {
      setLatestClosingResult(result);
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const reopenMutation = useMutation({
    mutationFn: (payload: ReopenAccountingPeriodPayload) =>
      reopenAccountingPeriod(
        payload.period.id,
        payload.input,
        buildReopenAccountingPeriodFallback(payload.period, payload.input)
      ),
    onSuccess: async () => {
      setLatestClosingResult(null);
      await invalidateAccountingPeriodQueries(queryClient);
    }
  });

  const initializeOpeningBalance = useWatch({
    control: form.control,
    name: 'initializeOpeningBalance',
    defaultValue: true
  });
  const openingBalanceLines = useWatch({
    control: form.control,
    name: 'openingBalanceLines',
    defaultValue: []
  });
  const openingBalanceTotals = React.useMemo(
    () =>
      buildOpeningBalanceTotals(
        openingBalanceLines,
        balanceSheetAccountSubjects
      ),
    [balanceSheetAccountSubjects, openingBalanceLines]
  );
  const openingBalanceReferenceError = isFirstPeriod
    ? (accountSubjectsQuery.error ?? fundingAccountsQuery.error ?? null)
    : null;
  const canSubmitOpeningBalance =
    !isFirstPeriod ||
    (balanceSheetAccountSubjects.length > 0 &&
      openingBalanceFields.length > 0 &&
      openingBalanceTotals.hasLines);
  const openFormBusy =
    openMutation.isPending ||
    form.formState.isSubmitting ||
    !hasWorkspace ||
    (isFirstPeriod &&
      (accountSubjectsQuery.isLoading || fundingAccountsQuery.isLoading));

  const handleOpenPeriodSubmit = form.handleSubmit(async (values) => {
    setFeedback(null);

    try {
      await openMutation.mutateAsync({
        month: values.month,
        initializeOpeningBalance: values.initializeOpeningBalance,
        openingBalanceLines: values.initializeOpeningBalance
          ? values.openingBalanceLines.map((line) => ({
              accountSubjectId: line.accountSubjectId,
              fundingAccountId: normalizeOptionalIdentifier(
                line.fundingAccountId
              ),
              balanceAmount: parseMoneyWon(line.balanceAmount) ?? 0
            }))
          : undefined,
        note: values.note.trim() || undefined
      });

      setFeedback({
        severity: 'success',
        message: `${values.month} 운영 기간을 시작했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '운영 기간을 시작하지 못했습니다.'
      });
    }
  });

  const handleClosePeriod = React.useCallback(async () => {
    if (!openPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await closeMutation.mutateAsync(openPeriod);
      setFeedback({
        severity: 'success',
        message: `${result.period.monthLabel} 월 마감을 완료했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '월 마감을 완료하지 못했습니다.'
      });
    }
  }, [closeMutation, openPeriod]);

  const handleReopenPeriod = React.useCallback(async () => {
    if (!reopenPeriod) {
      return;
    }

    setFeedback(null);

    try {
      const result = await reopenMutation.mutateAsync({
        period: reopenPeriod,
        input: {
          reason: reopenReason.trim()
        }
      });
      setReopenReason('');
      setFeedback({
        severity: 'success',
        message: `${result.monthLabel} 월을 재오픈했습니다.`
      });
    } catch (mutationError) {
      setFeedback({
        severity: 'error',
        message:
          mutationError instanceof Error
            ? mutationError.message
            : '월 재오픈을 완료하지 못했습니다.'
      });
    }
  }, [reopenMutation, reopenPeriod, reopenReason]);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="월 운영"
        title={pageTitle}
        description={pageDescription}
        badges={[
          {
            label:
              section === 'overview'
                ? currentPeriod
                  ? currentPeriod.monthLabel
                  : '운영 기간 없음'
                : section === 'open'
                  ? '운영 시작 작업'
                  : section === 'close'
                    ? '마감 / 재오픈 작업'
                    : '기간 이력 검토',
            color: currentPeriod ? 'primary' : 'default'
          },
          {
            label:
              referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ?? false
                ? '시작 준비됨'
                : '기준 데이터 점검 필요',
            color:
              referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ?? false
                ? 'success'
                : 'warning'
          }
        ]}
        metadata={[
          {
            label: '사업장',
            value: workspaceLabel
          },
          {
            label: '장부',
            value: ledgerLabel
          },
          {
            label:
              section === 'history' ? '운영 기간 수' : '현재 운영 월',
            value:
              section === 'history'
                ? `${periods.length}개`
                : currentPeriod?.monthLabel ?? '-'
          },
          {
            label: '권한',
            value: readMembershipRoleLabel(membershipRole)
          }
        ]}
        primaryActionLabel={primaryAction.label}
        primaryActionHref={primaryAction.href}
        secondaryActionLabel={secondaryAction.label}
        secondaryActionHref={secondaryAction.href}
      />
      <PeriodsSectionNav />
      {error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={error}
        />
      ) : null}

      {!hasWorkspace ? (
        <Alert severity="warning" variant="outlined">
          현재 작업 사업장과 장부 문맥이 아직 준비되지 않았습니다. 작업 문맥
          화면에서 연결 상태를 먼저 확인해 주세요.
        </Alert>
      ) : null}

      {!canOpenPeriod && hasWorkspace ? (
        <Alert severity="info" variant="outlined">
          월 운영 시작은 소유자 또는 관리자만 실행할 수 있습니다. 현재 역할은{' '}
          {readMembershipRoleLabel(membershipRole)} 입니다.
        </Alert>
      ) : null}
      <ReferenceDataReadinessAlert
        readiness={referenceDataReadinessQuery.data ?? null}
        context="monthly-operation"
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {latestClosingResult ? (
        <Alert severity="success" variant="outlined">
          {latestClosingResult.period.monthLabel} 월 마감이 완료되었습니다.
          생성된 스냅샷 라인 {latestClosingResult.closingSnapshot.lines.length}
          건, 당기손익{' '}
          {formatWon(latestClosingResult.closingSnapshot.periodPnLAmount)}{' '}
          입니다.
        </Alert>
      ) : null}

      {section === 'overview' ? (
        <Stack spacing={appLayout.sectionGap}>
          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, xl: 5 }}>
              <CurrentPeriodStatusSection
                currentPeriod={currentPeriod}
                openPeriod={openPeriod}
                reopenPeriod={reopenPeriod}
                canClosePeriod={canClosePeriod}
                canReopenPeriod={canReopenPeriod}
                isReadyForMonthlyOperation={
                  referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ??
                  false
                }
              />
            </Grid>

            <Grid size={{ xs: 12, xl: 7 }}>
              <SectionCard
                title="다음 작업 바로가기"
                description="월 운영 홈에서는 현재 상태와 다음 행동만 보여주고, 실제 입력과 마감은 각각의 전용 화면으로 나눕니다."
              >
                <Stack spacing={appLayout.cardGap}>
                  <Grid container spacing={appLayout.fieldGap}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <OverviewActionCard
                        title="월 운영 시작"
                        description="새 운영 월과 기초 잔액 기준을 준비합니다."
                        href="/periods/open"
                        buttonLabel="시작 화면 열기"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <OverviewActionCard
                        title="월 마감 / 재오픈"
                        description="열린 월 마감이나 최근 잠금 월 재오픈만 집중해서 처리합니다."
                        href="/periods/close"
                        buttonLabel="마감 화면 열기"
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <OverviewActionCard
                        title="기간 이력"
                        description="운영 기간 상태, 잠금일, 기초 잔액 출처를 이력 중심으로 확인합니다."
                        href="/periods/history"
                        buttonLabel="이력 보기"
                      />
                    </Grid>
                  </Grid>
                  <Typography variant="body2" color="text.secondary">
                    현재 홈 화면은 기준 확인과 이동에만 집중하고, 실제 시작과 마감
                    작업은 별도 화면에서 처리합니다.
                  </Typography>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>

          <div id="period-history">
            <DataTableCard
              title="최근 운영 기간"
              description="최신 월 몇 건만 빠르게 보고, 전체 이력은 전용 화면에서 이어서 확인합니다."
              toolbar={renderPeriodHistoryToolbar({
                periodStatusSummary,
                lockedPeriodCount,
                compact: true
              })}
              rows={periods.slice(0, 5)}
              columns={periodColumns}
              height={320}
            />
          </div>
        </Stack>
      ) : null}

      {section === 'open' ? (
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, xl: 4.5 }}>
            <CurrentPeriodStatusSection
              currentPeriod={currentPeriod}
              openPeriod={openPeriod}
              reopenPeriod={reopenPeriod}
              canClosePeriod={canClosePeriod}
              canReopenPeriod={canReopenPeriod}
              isReadyForMonthlyOperation={
                referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ??
                false
              }
            />
          </Grid>

          <Grid size={{ xs: 12, xl: 7.5 }}>
            <PeriodOperationsSection
              form={form}
              initializeOpeningBalance={initializeOpeningBalance}
              isFirstPeriod={isFirstPeriod}
              isBusy={openFormBusy}
              canOpenPeriod={canOpenPeriod}
              canSubmitOpeningBalance={canSubmitOpeningBalance}
              isSubmitting={openMutation.isPending}
              openingBalanceFields={openingBalanceFields}
              openingBalanceLineCount={openingBalanceFields.length}
              openingBalanceAccountSubjects={balanceSheetAccountSubjects}
              openingBalanceFundingAccounts={openingBalanceFundingAccounts}
              openingBalanceTotals={openingBalanceTotals}
              openingBalanceReferenceError={openingBalanceReferenceError}
              onAppendOpeningBalanceLine={() => {
                appendOpeningBalanceLine(createEmptyOpeningBalanceLine(), {
                  shouldFocus: true
                });
              }}
              onRemoveOpeningBalanceLine={removeOpeningBalanceLine}
              onSubmit={handleOpenPeriodSubmit}
              openPeriod={openPeriod}
              reopenPeriod={reopenPeriod}
              membershipRole={membershipRole}
              canClosePeriod={canClosePeriod}
              canReopenPeriod={canReopenPeriod}
              hasWorkspace={hasWorkspace}
              closeNote={closeNote}
              reopenReason={reopenReason}
              closePending={closeMutation.isPending}
              reopenPending={reopenMutation.isPending}
              onCloseNoteChange={setCloseNote}
              onReopenReasonChange={setReopenReason}
              onClosePeriod={handleClosePeriod}
              onReopenPeriod={handleReopenPeriod}
              forcedTab="open"
              hideTabs
              headingTitle="월 운영 시작 작업대"
              headingDescription="새 운영 월과 기초 잔액 기준을 이 화면에서만 집중해서 준비합니다."
            />
          </Grid>
        </Grid>
      ) : null}

      {section === 'close' ? (
        <Grid container spacing={appLayout.sectionGap}>
          <Grid size={{ xs: 12, xl: 4.5 }}>
            <CurrentPeriodStatusSection
              currentPeriod={currentPeriod}
              openPeriod={openPeriod}
              reopenPeriod={reopenPeriod}
              canClosePeriod={canClosePeriod}
              canReopenPeriod={canReopenPeriod}
              isReadyForMonthlyOperation={
                referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ??
                false
              }
            />
          </Grid>

          <Grid size={{ xs: 12, xl: 7.5 }}>
            <PeriodOperationsSection
              form={form}
              initializeOpeningBalance={initializeOpeningBalance}
              isFirstPeriod={isFirstPeriod}
              isBusy={openFormBusy}
              canOpenPeriod={canOpenPeriod}
              canSubmitOpeningBalance={canSubmitOpeningBalance}
              isSubmitting={openMutation.isPending}
              openingBalanceFields={openingBalanceFields}
              openingBalanceLineCount={openingBalanceFields.length}
              openingBalanceAccountSubjects={balanceSheetAccountSubjects}
              openingBalanceFundingAccounts={openingBalanceFundingAccounts}
              openingBalanceTotals={openingBalanceTotals}
              openingBalanceReferenceError={openingBalanceReferenceError}
              onAppendOpeningBalanceLine={() => {
                appendOpeningBalanceLine(createEmptyOpeningBalanceLine(), {
                  shouldFocus: true
                });
              }}
              onRemoveOpeningBalanceLine={removeOpeningBalanceLine}
              onSubmit={handleOpenPeriodSubmit}
              openPeriod={openPeriod}
              reopenPeriod={reopenPeriod}
              membershipRole={membershipRole}
              canClosePeriod={canClosePeriod}
              canReopenPeriod={canReopenPeriod}
              hasWorkspace={hasWorkspace}
              closeNote={closeNote}
              reopenReason={reopenReason}
              closePending={closeMutation.isPending}
              reopenPending={reopenMutation.isPending}
              onCloseNoteChange={setCloseNote}
              onReopenReasonChange={setReopenReason}
              onClosePeriod={handleClosePeriod}
              onReopenPeriod={handleReopenPeriod}
              forcedTab={focusedOperationTab}
              hideTabs
              headingTitle="월 마감 / 재오픈 작업대"
              headingDescription={
                openPeriod
                  ? `${openPeriod.monthLabel} 운영 월 마감 준비를 이 화면에서만 집중해서 처리합니다.`
                  : reopenPeriod
                    ? `${reopenPeriod.monthLabel} 최근 잠금 월 재오픈 여부를 이 화면에서 검토합니다.`
                    : '현재 열린 운영 월이 없어 최근 잠금 월 재오픈 가능 여부만 확인합니다.'
              }
            />
          </Grid>
        </Grid>
      ) : null}

      {section === 'history' ? (
        <Stack spacing={appLayout.sectionGap}>
          <Grid container spacing={appLayout.sectionGap}>
            <Grid size={{ xs: 12, xl: 4.5 }}>
              <CurrentPeriodStatusSection
                currentPeriod={currentPeriod}
                openPeriod={openPeriod}
                reopenPeriod={reopenPeriod}
                canClosePeriod={canClosePeriod}
                canReopenPeriod={canReopenPeriod}
                isReadyForMonthlyOperation={
                  referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ??
                  false
                }
              />
            </Grid>

            <Grid size={{ xs: 12, xl: 7.5 }}>
              <SectionCard
                title="이력 읽는 순서"
                description="운영 월 상태, 잠금 시점, 기초 잔액 출처를 차례대로 읽으면 마감과 차기 이월 연결을 가장 빠르게 확인할 수 있습니다."
              >
                <Stack spacing={1.25}>
                  <Typography variant="body2" color="text.secondary">
                    최신 월부터 상태와 잠금 여부를 보고, 필요한 경우 최근 잠금 월만
                    재오픈 검토 대상으로 삼습니다.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    첫 월은 `초기 설정`, 이후 월은 `이월` 기초 잔액 출처가 자연스럽게
                    이어지는지 함께 확인합니다.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button href="/periods/open" variant="contained">
                      월 운영 시작
                    </Button>
                    <Button href="/periods/close" variant="outlined">
                      마감 작업 보기
                    </Button>
                  </Stack>
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>

          <div id="period-history">
            <DataTableCard
              title="기간 이력"
              description="최신 월 순서로 운영 기간 상태와 기초 잔액 기준 여부를 확인합니다."
              toolbar={renderPeriodHistoryToolbar({
                periodStatusSummary,
                lockedPeriodCount
              })}
              rows={periods}
              columns={periodColumns}
              height={420}
            />
          </div>
        </Stack>
      ) : null}
    </Stack>
  );
}

async function invalidateAccountingPeriodQueries(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: accountingPeriodsQueryKey
  });
  await queryClient.invalidateQueries({
    queryKey: currentAccountingPeriodQueryKey
  });
}

function renderPeriodHistoryToolbar({
  periodStatusSummary,
  lockedPeriodCount,
  compact = false
}: {
  periodStatusSummary: {
    OPEN: number;
    IN_REVIEW: number;
    CLOSING: number;
    LOCKED: number;
  };
  lockedPeriodCount: number;
  compact?: boolean;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {periodStatusSummary.OPEN > 0 ? (
          <Chip
            label={`열림 ${periodStatusSummary.OPEN}건`}
            size="small"
            color="primary"
            variant="filled"
          />
        ) : null}
        {periodStatusSummary.IN_REVIEW > 0 ? (
          <Chip
            label={`검토 ${periodStatusSummary.IN_REVIEW}건`}
            size="small"
            color="warning"
            variant="outlined"
          />
        ) : null}
        {periodStatusSummary.CLOSING > 0 ? (
          <Chip
            label={`마감 중 ${periodStatusSummary.CLOSING}건`}
            size="small"
            color="warning"
            variant="outlined"
          />
        ) : null}
        <Chip
          label={`잠금 ${lockedPeriodCount}건`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {compact
          ? '최근 운영 월만 먼저 확인하고, 전체 이력은 전용 화면에서 이어서 봅니다.'
          : '상태 이력은 읽기 전용으로 확인하고, 실제 시작/마감 작업은 각 전용 화면에서 처리합니다.'}
      </Typography>
    </Stack>
  );
}

function OverviewActionCard({
  title,
  description,
  href,
  buttonLabel
}: {
  title: string;
  description: string;
  href: '/periods/open' | '/periods/close' | '/periods/history';
  buttonLabel: string;
}) {
  return (
    <Stack
      spacing={1.25}
      sx={{
        p: appLayout.cardPadding,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.default',
        height: '100%'
      }}
    >
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
        {description}
      </Typography>
      <Button href={href} variant="outlined" sx={{ alignSelf: 'flex-start' }}>
        {buttonLabel}
      </Button>
    </Stack>
  );
}
