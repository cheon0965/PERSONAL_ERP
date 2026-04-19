'use client';

import * as React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Stack } from '@mui/material';
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
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  accountingPeriodsQueryKey,
  buildCloseAccountingPeriodFallback,
  buildReopenAccountingPeriodFallback,
  closeAccountingPeriod,
  getAccountingPeriods,
  openAccountingPeriod,
  reopenAccountingPeriod
} from './accounting-periods.api';
import {
  buildOpeningBalanceTotals,
  normalizeOptionalIdentifier
} from './accounting-periods-page.helpers';
import {
  buildAccountingPeriodsDomainHelp,
  buildAccountingPeriodsHeaderConfig,
  buildAccountingPeriodsPageModel,
  buildLatestClosingAlertMessage,
  buildPeriodOperationsSectionProps,
  invalidateAccountingPeriodQueries,
  buildStatusSectionProps
} from './accounting-periods-page.model';
import {
  AccountingPeriodsHistoryWorkspace,
  AccountingPeriodsLifecycleWorkspace,
  AccountingPeriodsOverviewWorkspace
} from './accounting-periods-page.workspace-sections';
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
  const ledgerMetaLabel = currentWorkspace?.ledger
    ? `${currentWorkspace.ledger.baseCurrency} / ${currentWorkspace.ledger.timezone}`
    : '-';

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

  const pageModel = React.useMemo(
    () =>
      buildAccountingPeriodsPageModel({
        accountSubjects: accountSubjectsQuery.data ?? [],
        fundingAccounts: fundingAccountsQuery.data ?? [],
        membershipRole,
        periods,
        readiness:
          referenceDataReadinessQuery.data?.isReadyForMonthlyOperation ?? false,
        section,
        workspaceLabel,
        ledgerLabel
      }),
    [
      accountSubjectsQuery.data,
      fundingAccountsQuery.data,
      membershipRole,
      periods,
      referenceDataReadinessQuery.data?.isReadyForMonthlyOperation,
      section,
      workspaceLabel,
      ledgerLabel
    ]
  );
  const {
    balanceSheetAccountSubjects,
    canClosePeriod,
    canOpenPeriod,
    canReopenPeriod,
    currentPeriod,
    focusedOperationTab,
    hasWorkspace,
    isFirstPeriod,
    isReadyForMonthlyOperation,
    lockedPeriodCount,
    membershipRole: membershipRoleLabel,
    openingBalanceFundingAccounts,
    openPeriod,
    pageDescription,
    pageTitle,
    periodStatusSummary,
    primaryAction,
    reopenPeriod,
    secondaryAction
  } = pageModel;

  useDomainHelp(
    buildAccountingPeriodsDomainHelp({
      latestClosingResult,
      ledgerLabel,
      ledgerMetaLabel,
      membershipRole,
      section,
      workspaceLabel
    })
  );

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

  const pageHeaderConfig = buildAccountingPeriodsHeaderConfig({
    currentPeriod,
    isReadyForMonthlyOperation,
    pageDescription,
    pageTitle,
    periodsLength: periods.length,
    primaryAction,
    section,
    secondaryAction,
    workspaceLabel,
    ledgerLabel,
    membershipRole: membershipRoleLabel
  });
  const statusSectionProps = buildStatusSectionProps({
    currentPeriod,
    openPeriod,
    reopenPeriod,
    canClosePeriod,
    canReopenPeriod,
    isReadyForMonthlyOperation
  });
  const periodOperationsBaseProps = buildPeriodOperationsSectionProps({
    form,
    initializeOpeningBalance,
    isFirstPeriod,
    isBusy: openFormBusy,
    canOpenPeriod,
    canSubmitOpeningBalance,
    isSubmitting: openMutation.isPending,
    openingBalanceFields,
    openingBalanceLineCount: openingBalanceFields.length,
    openingBalanceAccountSubjects: balanceSheetAccountSubjects,
    openingBalanceFundingAccounts,
    openingBalanceTotals,
    openingBalanceReferenceError,
    onAppendOpeningBalanceLine: () => {
      appendOpeningBalanceLine(createEmptyOpeningBalanceLine(), {
        shouldFocus: true
      });
    },
    onRemoveOpeningBalanceLine: removeOpeningBalanceLine,
    onSubmit: handleOpenPeriodSubmit,
    openPeriod,
    reopenPeriod,
    membershipRole,
    canClosePeriod,
    canReopenPeriod,
    hasWorkspace,
    closeNote,
    reopenReason,
    closePending: closeMutation.isPending,
    reopenPending: reopenMutation.isPending,
    onCloseNoteChange: setCloseNote,
    onReopenReasonChange: setReopenReason,
    onClosePeriod: handleClosePeriod,
    onReopenPeriod: handleReopenPeriod
  });

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader {...pageHeaderConfig} />
      <PeriodsSectionNav />
      {error ? (
        <QueryErrorAlert
          title="운영 기간 목록을 불러오지 못했습니다."
          error={error}
        />
      ) : null}

      {!hasWorkspace ? (
        <Alert severity="warning" variant="outlined">
          현재 사업장과 장부 정보가 아직 준비되지 않았습니다. 설정 화면에서
          연결 상태를 먼저 확인해 주세요.
        </Alert>
      ) : null}

      {!canOpenPeriod && hasWorkspace ? (
        <Alert severity="info" variant="outlined">
          월 운영 시작은 소유자 또는 관리자만 실행할 수 있습니다. 현재 역할은{' '}
          {membershipRoleLabel} 입니다.
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
          {buildLatestClosingAlertMessage(latestClosingResult)}
        </Alert>
      ) : null}

      {section === 'overview' ? (
        <AccountingPeriodsOverviewWorkspace
          statusSectionProps={statusSectionProps}
          periodStatusSummary={periodStatusSummary}
          lockedPeriodCount={lockedPeriodCount}
          periods={periods}
        />
      ) : null}

      {section === 'open' ? (
        <AccountingPeriodsLifecycleWorkspace
          statusSectionProps={statusSectionProps}
          operationsSectionProps={{
            ...periodOperationsBaseProps,
            forcedTab: 'open',
            hideTabs: true,
            headingTitle: '월 운영 시작 작업대',
            headingDescription:
              '새 운영 월과 기초 잔액 기준을 이 화면에서만 집중해서 준비합니다.'
          }}
        />
      ) : null}

      {section === 'close' ? (
        <AccountingPeriodsLifecycleWorkspace
          statusSectionProps={statusSectionProps}
          operationsSectionProps={{
            ...periodOperationsBaseProps,
            forcedTab: focusedOperationTab,
            hideTabs: true,
            headingTitle: '월 마감 / 재오픈 작업대',
            headingDescription: openPeriod
              ? `${openPeriod.monthLabel} 운영 월 마감 준비를 이 화면에서만 집중해서 처리합니다.`
              : reopenPeriod
                ? `${reopenPeriod.monthLabel} 최근 잠금 월 재오픈 여부를 이 화면에서 검토합니다.`
                : '현재 열린 운영 월이 없어 최근 잠금 월 재오픈 가능 여부만 확인합니다.'
          }}
        />
      ) : null}

      {section === 'history' ? (
        <AccountingPeriodsHistoryWorkspace
          statusSectionProps={statusSectionProps}
          periodStatusSummary={periodStatusSummary}
          lockedPeriodCount={lockedPeriodCount}
          periods={periods}
        />
      ) : null}
    </Stack>
  );
}
