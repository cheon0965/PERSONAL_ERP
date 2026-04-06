'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { Alert, Grid, Stack } from '@mui/material';
import type {
  AccountSubjectItem,
  AccountingPeriodItem,
  CloseAccountingPeriodResponse,
  OpenAccountingPeriodRequest
} from '@personal-erp/contracts';
import { useFieldArray, useForm } from 'react-hook-form';
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
  PeriodOperationsSection,
  periodColumns
} from './accounting-periods-page.sections';
import {
  createEmptyOpeningBalanceLine,
  periodFormSchema,
  type PeriodFormInput,
  type ReopenAccountingPeriodPayload,
  type SubmitFeedback
} from './accounting-periods-page.types';

export function AccountingPeriodsPage() {
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
    title: '운영 기간 관리 개요',
    description:
      '운영 기간은 모든 수집 거래, 전표 확정, 마감, 재무제표의 기준 월을 고정합니다. 월 운영 시작부터 잠금, 재오픈까지의 상태 흐름을 이 화면에서 관리합니다.',
    primaryEntity: '운영 기간',
    relatedEntities: [
      '기간 상태 이력',
      '기초 잔액 기준',
      '사업 장부',
      '사용자 권한'
    ],
    truthSource:
      '운영 월의 공식 시작 기준은 운영 기간이며, 첫 월 시작은 기초 잔액 생성 여부까지 함께 남깁니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '월 운영 시작과 마감은 현재 로그인한 사용자의 사업 장부 문맥 안에서만 실행됩니다.',
        facts: [
          {
            label: '사업장',
            value: currentWorkspace
              ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
              : '-'
          },
          {
            label: '장부',
            value: currentWorkspace?.ledger?.name ?? '-'
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
        title: '최근 마감 스냅샷',
        description: latestClosingResult
          ? '가장 최근에 실행한 월 마감 요약입니다.'
          : '최근 마감 결과는 본문 대신 도메인 가이드에서 확인할 수 있습니다.',
        facts: latestClosingSnapshotFacts,
        items: latestClosingSnapshotItems
      }
    ],
    readModelNote:
      '현재 목록은 운영 기간 상태를 중심으로 확인하고, 최근 마감 상세는 도메인 가이드에서 검토하는 관리 화면입니다.'
  });

  const form = useForm<PeriodFormInput>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      month: getTodayMonthInputValue(),
      initializeOpeningBalance: true,
      openingBalanceLines: [createEmptyOpeningBalanceLine()],
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

  React.useEffect(() => {
    form.setValue('initializeOpeningBalance', isFirstPeriod, {
      shouldValidate: false
    });
  }, [form, isFirstPeriod]);

  React.useEffect(() => {
    if (isFirstPeriod) {
      if (openingBalanceFields.length === 0) {
        replaceOpeningBalanceLines([createEmptyOpeningBalanceLine()]);
      }

      return;
    }

    if (openingBalanceFields.length > 0) {
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

  const initializeOpeningBalance = form.watch('initializeOpeningBalance');
  const openingBalanceLines = form.watch('openingBalanceLines');
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
      openingBalanceTotals.hasLines &&
      openingBalanceTotals.isBalanced);
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
              balanceAmount: Number(line.balanceAmount)
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
        eyebrow="월 운영 시작"
        title="운영 기간 관리"
        description="현재 사업 장부의 운영 기간을 열고 상태를 관리합니다. 최근 마감 상세는 도메인 가이드에서 확인할 수 있습니다."
        primaryActionLabel="운영 작업 보기"
        primaryActionHref="#accounting-period-operations"
      />
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

      <CurrentPeriodStatusSection currentPeriod={currentPeriod} />

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 7 }}>
          <DataTableCard
            title="운영 기간 목록"
            description="현재 사업 장부에 생성된 운영 기간과 기초 잔액 준비 여부를 최신 월 순서로 확인합니다."
            rows={periods}
            columns={periodColumns}
            height={360}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 5 }}>
          <PeriodOperationsSection
            form={form}
            initializeOpeningBalance={initializeOpeningBalance}
            isFirstPeriod={isFirstPeriod}
            isBusy={openFormBusy}
            canOpenPeriod={canOpenPeriod}
            canSubmitOpeningBalance={canSubmitOpeningBalance}
            isSubmitting={openMutation.isPending}
            openingBalanceFields={openingBalanceFields}
            openingBalanceAccountSubjects={balanceSheetAccountSubjects}
            openingBalanceFundingAccounts={openingBalanceFundingAccounts}
            openingBalanceTotals={openingBalanceTotals}
            openingBalanceReferenceError={openingBalanceReferenceError}
            onAppendOpeningBalanceLine={() => {
              appendOpeningBalanceLine(createEmptyOpeningBalanceLine());
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
          />
        </Grid>
      </Grid>
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

function readMembershipRoleLabel(role: string | null) {
  switch (role) {
    case 'OWNER':
      return '소유자';
    case 'MANAGER':
      return '관리자';
    case 'EDITOR':
      return '편집자';
    case 'VIEWER':
      return '조회자';
    default:
      return role ?? '-';
  }
}

function isBalanceSheetAccountSubject(accountSubject: AccountSubjectItem) {
  return (
    accountSubject.subjectKind === 'ASSET' ||
    accountSubject.subjectKind === 'LIABILITY' ||
    accountSubject.subjectKind === 'EQUITY'
  );
}

function buildOpeningBalanceTotals(
  lines: PeriodFormInput['openingBalanceLines'],
  accountSubjects: AccountSubjectItem[]
) {
  const accountSubjectById = new Map(
    accountSubjects.map((accountSubject) => [accountSubject.id, accountSubject])
  );

  return lines.reduce(
    (accumulator, line) => {
      const accountSubject = accountSubjectById.get(line.accountSubjectId);
      const balanceAmount = Number(line.balanceAmount);
      if (
        !accountSubject ||
        !Number.isFinite(balanceAmount) ||
        balanceAmount <= 0
      ) {
        return accumulator;
      }

      accumulator.hasLines = true;

      switch (accountSubject.subjectKind) {
        case 'ASSET':
          accumulator.assetAmount += balanceAmount;
          break;
        case 'LIABILITY':
          accumulator.liabilityAmount += balanceAmount;
          break;
        case 'EQUITY':
          accumulator.equityAmount += balanceAmount;
          break;
        default:
          break;
      }

      accumulator.isBalanced =
        accumulator.assetAmount ===
        accumulator.liabilityAmount + accumulator.equityAmount;

      return accumulator;
    },
    {
      assetAmount: 0,
      liabilityAmount: 0,
      equityAmount: 0,
      hasLines: false,
      isBalanced: false
    }
  );
}

function normalizeOptionalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}
