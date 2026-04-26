'use client';

import * as React from 'react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient
} from '@tanstack/react-query';
import {
  Alert,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import type {
  AccountSubjectItem,
  CategoryItem,
  CreateLiabilityAgreementRequest,
  FundingAccountItem,
  LiabilityAgreementItem,
  LiabilityAgreementStatus,
  LiabilityInterestRateType,
  LiabilityOverviewItem,
  LiabilityOverviewResponse,
  LiabilityRepaymentMethod,
  LiabilityRepaymentScheduleItem,
  LiabilityRepaymentScheduleStatus,
  UpdateLiabilityAgreementRequest,
  UpdateLiabilityRepaymentScheduleRequest
} from '@personal-erp/contracts';
import { addMoneyWon, subtractMoneyWon } from '@personal-erp/money';
import {
  accountSubjectsQueryKey,
  categoriesManagementQueryKey,
  fundingAccountsManagementQueryKey,
  getAccountSubjects,
  getCategories,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { webRuntime } from '@/shared/config/env';
import { formatDate, formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { useAppNotification } from '@/shared/providers/notification-provider';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { GridActionCell } from '@/shared/ui/data-grid-cell';
import {
  FeedbackAlert,
  type FeedbackAlertValue
} from '@/shared/ui/feedback-alert';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { StatusChip } from '@/shared/ui/status-chip';
import {
  archiveLiabilityAgreement,
  buildLiabilityAgreementFallbackItem,
  buildLiabilityRepaymentFallbackItem,
  createLiabilityAgreement,
  createLiabilityRepayment,
  generateLiabilityRepaymentPlanItem,
  getLiabilities,
  getLiabilityOverview,
  getLiabilityRepayments,
  liabilitiesOverviewQueryKey,
  liabilitiesQueryKey,
  liabilityRepaymentsQueryKey,
  mergeLiabilityAgreementItem,
  mergeLiabilityRepaymentItem,
  updateLiabilityAgreement,
  updateLiabilityRepayment
} from './liabilities.api';

type AgreementDrawerState =
  | { mode: 'create' }
  | { mode: 'edit'; agreement: LiabilityAgreementItem }
  | null;

type RepaymentDrawerState =
  | { mode: 'create'; agreement: LiabilityAgreementItem }
  | {
      mode: 'edit';
      agreement: LiabilityAgreementItem;
      repayment: LiabilityRepaymentScheduleItem;
    }
  | null;

type AgreementArchiveTarget = LiabilityAgreementItem | null;

type AgreementFormState = {
  lenderName: string;
  productName: string;
  loanNumberLast4: string;
  principalAmount: string;
  borrowedAt: string;
  maturityDate: string;
  interestRate: string;
  interestRateType: LiabilityInterestRateType;
  repaymentMethod: LiabilityRepaymentMethod;
  paymentDay: string;
  defaultFundingAccountId: string;
  liabilityAccountSubjectId: string;
  interestExpenseCategoryId: string;
  feeExpenseCategoryId: string;
  status: LiabilityAgreementStatus;
  memo: string;
};

type RepaymentFormState = {
  dueDate: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  status: LiabilityRepaymentScheduleStatus;
  memo: string;
};

type AgreementMutationInput = {
  mode: 'create' | 'edit';
  agreementId?: string;
  payload: UpdateLiabilityAgreementRequest;
  fallback: LiabilityAgreementItem;
};

type RepaymentMutationInput = {
  mode: 'create' | 'edit';
  agreementId: string;
  repaymentId?: string;
  payload: UpdateLiabilityRepaymentScheduleRequest;
  fallback: LiabilityRepaymentScheduleItem;
};

type NumberParseResult = { value: number } | { error: string };

const agreementStatusLabelMap: Record<LiabilityAgreementStatus, string> = {
  ACTIVE: '상환 중',
  PAID_OFF: '완납',
  ARCHIVED: '보관'
};

const repaymentStatusLabelMap: Record<
  LiabilityRepaymentScheduleStatus,
  string
> = {
  SCHEDULED: '예정',
  PLANNED: '계획',
  MATCHED: '거래 연결',
  POSTED: '전표 확정',
  SKIPPED: '건너뜀',
  CANCELLED: '취소'
};

const interestRateTypeLabelMap: Record<LiabilityInterestRateType, string> = {
  FIXED: '고정',
  VARIABLE: '변동'
};

const repaymentMethodLabelMap: Record<LiabilityRepaymentMethod, string> = {
  EQUAL_PRINCIPAL: '원금균등',
  EQUAL_PAYMENT: '원리금균등',
  INTEREST_ONLY: '이자만 납부',
  BULLET: '만기일시',
  MANUAL: '수동'
};

type LiabilitiesPageMode = 'list' | 'detail';

type LiabilitiesPageProps = {
  mode?: LiabilitiesPageMode;
  selectedAgreementId?: string | null;
};

export function LiabilitiesPage({
  mode = 'list',
  selectedAgreementId: pinnedAgreementId = null
}: LiabilitiesPageProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { notifySuccess } = useAppNotification();
  const isDetailMode = mode === 'detail';
  const [agreementDrawerState, setAgreementDrawerState] =
    React.useState<AgreementDrawerState>(null);
  const [repaymentDrawerState, setRepaymentDrawerState] =
    React.useState<RepaymentDrawerState>(null);
  const [archiveTarget, setArchiveTarget] =
    React.useState<AgreementArchiveTarget>(null);
  const [feedback, setFeedback] = React.useState<FeedbackAlertValue>(null);

  const agreementsQuery = useQuery({
    queryKey: liabilitiesQueryKey,
    queryFn: () => getLiabilities({ includeArchived: true })
  });
  const overviewQuery = useQuery({
    queryKey: liabilitiesOverviewQueryKey,
    queryFn: getLiabilityOverview
  });
  const fundingAccountsQuery = useQuery({
    queryKey: fundingAccountsManagementQueryKey,
    queryFn: () => getFundingAccounts({ includeInactive: true })
  });
  const categoriesQuery = useQuery({
    queryKey: categoriesManagementQueryKey,
    queryFn: () => getCategories({ includeInactive: true })
  });
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const agreements = agreementsQuery.data ?? [];
  const overview = overviewQuery.data ?? null;
  const fundingAccounts = fundingAccountsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const accountSubjects = accountSubjectsQuery.data ?? [];
  const selectedAgreement =
    isDetailMode && pinnedAgreementId
      ? (agreements.find((agreement) => agreement.id === pinnedAgreementId) ??
        null)
      : null;
  const selectedAgreementMissing =
    isDetailMode &&
    Boolean(pinnedAgreementId) &&
    agreementsQuery.data !== undefined &&
    selectedAgreement == null;
  const repaymentsQuery = useQuery({
    queryKey: liabilityRepaymentsQueryKey(
      isDetailMode && !selectedAgreementMissing ? pinnedAgreementId : null
    ),
    queryFn: () => getLiabilityRepayments(pinnedAgreementId),
    enabled:
      isDetailMode && Boolean(pinnedAgreementId) && !selectedAgreementMissing
  });
  const repayments = repaymentsQuery.data ?? [];

  useDomainHelp(buildLiabilitiesHelpContext(mode));

  const activeAgreements = agreements.filter(
    (agreement) => agreement.status === 'ACTIVE'
  );
  const overviewData =
    overview ??
    buildFallbackOverview({
      agreements,
      repayments: isDetailMode ? repayments : []
    });
  const selectedAgreementOverview = React.useMemo(() => {
    if (!selectedAgreement) {
      return null;
    }

    return (
      overviewData.items.find(
        (item) => item.liabilityAgreementId === selectedAgreement.id
      ) ?? buildLiabilityOverviewItemFallback(selectedAgreement, repayments)
    );
  }, [overviewData.items, repayments, selectedAgreement]);

  const saveAgreementMutation = useMutation({
    mutationFn: ({
      mode,
      agreementId,
      payload,
      fallback
    }: AgreementMutationInput) => {
      if (mode === 'edit' && agreementId) {
        return updateLiabilityAgreement(agreementId, payload, fallback);
      }

      return createLiabilityAgreement(payload, fallback);
    },
    onSuccess: async (saved, variables) => {
      queryClient.setQueryData<LiabilityAgreementItem[]>(
        liabilitiesQueryKey,
        (current) => mergeLiabilityAgreementItem(current, saved)
      );
      setAgreementDrawerState(null);
      notifySuccess(
        `${saved.lenderName} ${saved.productName} 계약을 저장했습니다.`
      );

      await invalidateLiabilityQueries(queryClient);

      if (!isDetailMode && variables.mode === 'create') {
        React.startTransition(() => {
          router.push(buildLiabilityDetailHref(saved.id));
        });
      }
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '부채 계약을 저장하지 못했습니다.'
      });
    }
  });

  const archiveMutation = useMutation({
    mutationFn: (agreement: LiabilityAgreementItem) =>
      archiveLiabilityAgreement(agreement.id, {
        ...agreement,
        status: 'ARCHIVED'
      }),
    onSuccess: async (saved) => {
      queryClient.setQueryData<LiabilityAgreementItem[]>(
        liabilitiesQueryKey,
        (current) => mergeLiabilityAgreementItem(current, saved)
      );
      setArchiveTarget(null);
      notifySuccess(
        `${saved.lenderName} ${saved.productName} 계약을 보관했습니다.`
      );

      await invalidateLiabilityQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '부채 계약을 보관하지 못했습니다.'
      });
    }
  });

  const saveRepaymentMutation = useMutation({
    mutationFn: ({
      mode,
      agreementId,
      repaymentId,
      payload,
      fallback
    }: RepaymentMutationInput) => {
      if (mode === 'edit' && repaymentId) {
        return updateLiabilityRepayment(
          agreementId,
          repaymentId,
          payload,
          fallback
        );
      }

      return createLiabilityRepayment(agreementId, payload, fallback);
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData<LiabilityRepaymentScheduleItem[]>(
        liabilityRepaymentsQueryKey(saved.liabilityAgreementId),
        (current) => mergeLiabilityRepaymentItem(current, saved)
      );
      setRepaymentDrawerState(null);
      notifySuccess(`${formatDate(saved.dueDate)} 상환 일정을 저장했습니다.`);

      await invalidateLiabilityQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '상환 일정을 저장하지 못했습니다.'
      });
    }
  });

  const generatePlanItemMutation = useMutation({
    mutationFn: (input: {
      agreement: LiabilityAgreementItem;
      repayment: LiabilityRepaymentScheduleItem;
    }) =>
      generateLiabilityRepaymentPlanItem(
        input.agreement.id,
        input.repayment.id,
        {
          repayment: {
            ...input.repayment,
            status: 'MATCHED',
            linkedPlanItemId:
              input.repayment.linkedPlanItemId ??
              `plan-liability-demo-${Date.now()}`,
            matchedCollectedTransactionId:
              input.repayment.matchedCollectedTransactionId ??
              `tx-liability-demo-${Date.now()}`,
            matchedCollectedTransactionTitle:
              input.repayment.matchedCollectedTransactionTitle ??
              `${input.agreement.lenderName} ${input.agreement.productName} 상환`
          },
          createdPlanItemId:
            input.repayment.linkedPlanItemId ??
            `plan-liability-demo-${Date.now()}`,
          createdCollectedTransactionId:
            input.repayment.matchedCollectedTransactionId ??
            `tx-liability-demo-${Date.now()}`
        }
      ),
    onSuccess: async (response) => {
      queryClient.setQueryData<LiabilityRepaymentScheduleItem[]>(
        liabilityRepaymentsQueryKey(response.repayment.liabilityAgreementId),
        (current) => mergeLiabilityRepaymentItem(current, response.repayment)
      );
      notifySuccess(
        `${formatDate(response.repayment.dueDate)} 상환 일정을 계획 항목과 수집 거래로 연결했습니다.`
      );

      await Promise.all([
        invalidateLiabilityQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['plan-items'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      ]);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '상환 계획 항목을 생성하지 못했습니다.'
      });
    }
  });

  const agreementColumns = React.useMemo(
    () =>
      buildAgreementColumns({
        onEdit: (agreement) => {
          setFeedback(null);
          setAgreementDrawerState({ mode: 'edit', agreement });
        },
        onArchive: (agreement) => {
          setFeedback(null);
          setArchiveTarget(agreement);
        }
      }),
    []
  );
  const repaymentColumns = React.useMemo(
    () =>
      buildRepaymentColumns({
        busyRepaymentId:
          generatePlanItemMutation.variables?.repayment.id ?? null,
        onEdit: (repayment) => {
          if (!selectedAgreement) {
            return;
          }

          setFeedback(null);
          setRepaymentDrawerState({
            mode: 'edit',
            agreement: selectedAgreement,
            repayment
          });
        },
        onGeneratePlanItem: (repayment) => {
          if (!selectedAgreement) {
            return;
          }

          setFeedback(null);
          void generatePlanItemMutation.mutateAsync({
            agreement: selectedAgreement,
            repayment
          });
        }
      }),
    [generatePlanItemMutation, selectedAgreement]
  );

  const referenceError =
    fundingAccountsQuery.error ??
    categoriesQuery.error ??
    accountSubjectsQuery.error;
  const pageError = agreementsQuery.error ?? overviewQuery.error;

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="보조 운영 영역"
        title={
          isDetailMode
            ? selectedAgreement
              ? `${selectedAgreement.lenderName} ${selectedAgreement.productName} 상세`
              : '부채 계약 상세'
            : '부채 계약 목록'
        }
        description={
          isDetailMode
            ? '선택한 부채 계약의 기준과 상환 일정을 분리된 상세 화면에서 관리합니다.'
            : '계약 기준은 목록에서 정리하고, 선택한 계약의 상환 일정과 계획 연결은 상세 화면에서 이어집니다.'
        }
        badges={[
          isDetailMode
            ? {
                label: selectedAgreement
                  ? agreementStatusLabelMap[selectedAgreement.status]
                  : '계약 확인 필요',
                color:
                  selectedAgreement?.status === 'ACTIVE' ? 'success' : 'default'
              }
            : {
                label: `활성 ${activeAgreements.length}건`,
                color: activeAgreements.length > 0 ? 'success' : 'default'
              },
          isDetailMode
            ? {
                label: selectedAgreementOverview?.nextDueDate
                  ? `다음 상환 ${formatDate(selectedAgreementOverview.nextDueDate)}`
                  : '상환 일정 점검 필요',
                color: selectedAgreementOverview?.nextDueDate
                  ? 'primary'
                  : 'warning'
              }
            : {
                label: overviewData.nextDueDate
                  ? `다음 상환 ${formatDate(overviewData.nextDueDate)}`
                  : '상환 일정 점검 필요',
                color: overviewData.nextDueDate ? 'primary' : 'warning'
              }
        ]}
        metadata={[
          isDetailMode
            ? {
                label: '잔여 원금 추정',
                value: formatWon(
                  selectedAgreementOverview?.remainingPrincipalWon ?? 0
                )
              }
            : {
                label: '잔여 원금',
                value: formatWon(overviewData.remainingPrincipalWon)
              },
          isDetailMode
            ? {
                label: '상환 일정',
                value: `${repayments.length}건`
              }
            : {
                label: '운영 월 상환 예정',
                value: formatWon(overviewData.currentPeriodDueWon)
              },
          isDetailMode
            ? {
                label: '계약 상태',
                value: selectedAgreement
                  ? agreementStatusLabelMap[selectedAgreement.status]
                  : '-'
              }
            : {
                label: '전체 계약',
                value: `${overviewData.totalAgreementCount}건`
              }
        ]}
        primaryActionLabel={isDetailMode ? '상환 일정 추가' : '부채 계약 등록'}
        primaryActionOnClick={
          isDetailMode
            ? () => {
                if (!selectedAgreement) {
                  return;
                }

                setFeedback(null);
                setRepaymentDrawerState({
                  mode: 'create',
                  agreement: selectedAgreement
                });
              }
            : () => {
                setFeedback(null);
                setAgreementDrawerState({ mode: 'create' });
              }
        }
        primaryActionDisabled={isDetailMode && !selectedAgreement}
        secondaryActionLabel={
          isDetailMode ? '부채 목록 보기' : '계획 항목 보기'
        }
        secondaryActionHref={isDetailMode ? '/liabilities' : '/plan-items'}
      />

      <FeedbackAlert feedback={feedback} />
      {pageError ? (
        <QueryErrorAlert
          title="부채 정보 조회에 실패했습니다."
          error={pageError}
        />
      ) : null}
      {isDetailMode && repaymentsQuery.error ? (
        <QueryErrorAlert
          title="상환 일정 조회에 실패했습니다."
          error={repaymentsQuery.error}
        />
      ) : null}
      {referenceError ? (
        <QueryErrorAlert
          title="부채 관리에 필요한 기준 데이터 조회에 실패했습니다."
          error={referenceError}
        />
      ) : null}

      {isDetailMode ? (
        selectedAgreementMissing ? (
          <SectionCard
            title="선택한 부채 계약을 찾을 수 없습니다"
            description="보관 상태가 바뀌었거나 잘못된 링크로 진입했을 수 있습니다."
          >
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                부채 계약 목록으로 돌아가 다시 선택해 주세요.
              </Typography>
              <div>
                <Button
                  component={Link}
                  href="/liabilities"
                  variant="contained"
                >
                  부채 목록 보기
                </Button>
              </div>
            </Stack>
          </SectionCard>
        ) : !selectedAgreement ? (
          agreementsQuery.data === undefined && !agreementsQuery.error ? (
            <SectionCard
              title="부채 계약을 불러오는 중입니다"
              description="선택한 계약 기준과 상환 일정을 준비하고 있습니다."
            >
              <Typography variant="body2" color="text.secondary">
                잠시만 기다려 주세요.
              </Typography>
            </SectionCard>
          ) : (
            <SectionCard
              title="등록된 부채 계약이 없습니다"
              description="먼저 목록 화면에서 계약 기준을 등록한 뒤 상세 화면으로 이동해 주세요."
            >
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  계약을 만들면 상환 일정과 계획 생성 흐름을 이 상세 화면에서
                  바로 이어서 관리할 수 있습니다.
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Button
                    component={Link}
                    href="/liabilities"
                    variant="contained"
                  >
                    부채 목록 보기
                  </Button>
                  <Button
                    component={Link}
                    href="/plan-items"
                    variant="outlined"
                  >
                    계획 항목 보기
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>
          )
        ) : (
          <>
            <SectionCard
              title="계약 전환"
              description="다른 부채 계약 상세로 바로 이동하거나 목록 화면으로 돌아갈 수 있습니다."
            >
              <Grid
                container
                spacing={appLayout.fieldGap}
                alignItems="flex-start"
              >
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    select
                    fullWidth
                    label="부채 계약"
                    value={selectedAgreement.id}
                    onChange={(event) => {
                      router.push(buildLiabilityDetailHref(event.target.value));
                    }}
                    helperText="상세 화면 안에서 다른 계약으로 바로 전환할 수 있습니다."
                    disabled={agreements.length === 0}
                  >
                    {agreements.map((agreement) => (
                      <MenuItem key={agreement.id} value={agreement.id}>
                        {agreement.lenderName} {agreement.productName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <Stack spacing={1.25}>
                    <Typography variant="body2" color="text.secondary">
                      {selectedAgreement.status === 'ACTIVE'
                        ? '이 계약은 현재 운영 기준에 포함됩니다. 상환 일정 추가와 계획 항목 연결을 이 화면에서 이어서 진행합니다.'
                        : '현재 활성 계약은 아니지만, 기존 상환 일정과 연결 이력은 이 상세 화면에서 계속 확인할 수 있습니다.'}
                    </Typography>
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Button
                        component={Link}
                        href="/liabilities"
                        variant="outlined"
                      >
                        부채 목록 보기
                      </Button>
                      <Button
                        component={Link}
                        href="/transactions"
                        variant="text"
                      >
                        수집 거래 보기
                      </Button>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </SectionCard>

            <SectionCard
              title="계약 기준"
              description="상환 일정 상세로 내려가기 전에 대출 조건, 자금수단, 분개 기준 카테고리를 먼저 확인합니다."
            >
              <Stack spacing={appLayout.cardGap}>
                <Grid container spacing={appLayout.fieldGap}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="대출 기관 / 상품"
                      value={`${selectedAgreement.lenderName} ${selectedAgreement.productName}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="원금 / 실행일"
                      value={`${formatWon(selectedAgreement.principalAmount)} / ${formatDate(selectedAgreement.borrowedAt)}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="만기 / 납부일"
                      value={`${formatDate(selectedAgreement.maturityDate)} / ${selectedAgreement.paymentDay ? `${selectedAgreement.paymentDay}일` : '-'}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="금리 / 방식"
                      value={`${selectedAgreement.interestRate == null ? '-' : `${selectedAgreement.interestRate.toFixed(2)}%`} / ${repaymentMethodLabelMap[selectedAgreement.repaymentMethod]}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="자금수단 / 부채 계정과목"
                      value={`${selectedAgreement.defaultFundingAccountName} / ${selectedAgreement.liabilityAccountSubjectName ?? '미설정'}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="이자 / 수수료 카테고리"
                      value={`${selectedAgreement.interestExpenseCategoryName ?? '미설정'} / ${selectedAgreement.feeExpenseCategoryName ?? '미설정'}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="상태 / 금리 유형"
                      value={`${agreementStatusLabelMap[selectedAgreement.status]} / ${interestRateTypeLabelMap[selectedAgreement.interestRateType]}`}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="대출번호 끝 4자리"
                      value={selectedAgreement.loanNumberLast4 ?? '-'}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <AgreementDetailItem
                      label="메모"
                      value={selectedAgreement.memo ?? '-'}
                    />
                  </Grid>
                </Grid>

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                >
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFeedback(null);
                      setAgreementDrawerState({
                        mode: 'edit',
                        agreement: selectedAgreement
                      });
                    }}
                  >
                    계약 수정
                  </Button>
                  <Button
                    color="warning"
                    disabled={selectedAgreement.status === 'ARCHIVED'}
                    onClick={() => {
                      setFeedback(null);
                      setArchiveTarget(selectedAgreement);
                    }}
                  >
                    계약 보관
                  </Button>
                  <Button
                    component={Link}
                    href="/journal-entries"
                    variant="text"
                  >
                    전표 보기
                  </Button>
                </Stack>
              </Stack>
            </SectionCard>

            <DataTableCard
              title={`${selectedAgreement.lenderName} ${selectedAgreement.productName} 상환 일정`}
              description="상환 일정에서 계획 생성을 실행하면 운영 월 계획 항목과 전표 준비 수집 거래가 함께 만들어집니다."
              actions={
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    setFeedback(null);
                    setRepaymentDrawerState({
                      mode: 'create',
                      agreement: selectedAgreement
                    });
                  }}
                >
                  상환 일정 추가
                </Button>
              }
              toolbar={
                <RepaymentToolbar
                  repayments={repayments}
                  selectedAgreement={selectedAgreement}
                />
              }
              rows={repayments}
              columns={repaymentColumns}
              height={470}
              rowHeight={64}
            />
          </>
        )
      ) : (
        <>
          <DataTableCard
            title="부채 계약 목록"
            description="상세 보기로 들어가면 선택 계약의 상환 일정과 계획 연결 작업을 전용 화면에서 이어서 처리합니다."
            toolbar={
              <AgreementToolbar
                activeCount={activeAgreements.length}
                archivedCount={
                  agreements.filter(
                    (agreement) => agreement.status === 'ARCHIVED'
                  ).length
                }
                paidOffCount={
                  agreements.filter(
                    (agreement) => agreement.status === 'PAID_OFF'
                  ).length
                }
              />
            }
            rows={agreements}
            columns={agreementColumns}
            height={430}
            rowHeight={64}
          />
        </>
      )}

      <AgreementDrawer
        drawerState={agreementDrawerState}
        fundingAccounts={fundingAccounts}
        categories={categories}
        accountSubjects={accountSubjects}
        busy={saveAgreementMutation.isPending}
        onClose={() => setAgreementDrawerState(null)}
        onSubmit={(payload, fallback) => {
          if (!agreementDrawerState) {
            return;
          }

          void saveAgreementMutation.mutateAsync({
            mode: agreementDrawerState.mode,
            agreementId:
              agreementDrawerState.mode === 'edit'
                ? agreementDrawerState.agreement.id
                : undefined,
            payload,
            fallback
          });
        }}
      />

      <RepaymentDrawer
        drawerState={repaymentDrawerState}
        busy={saveRepaymentMutation.isPending}
        onClose={() => setRepaymentDrawerState(null)}
        onSubmit={(payload, fallback) => {
          if (!repaymentDrawerState) {
            return;
          }

          void saveRepaymentMutation.mutateAsync({
            mode: repaymentDrawerState.mode,
            agreementId: repaymentDrawerState.agreement.id,
            repaymentId:
              repaymentDrawerState.mode === 'edit'
                ? repaymentDrawerState.repayment.id
                : undefined,
            payload,
            fallback
          });
        }}
      />

      <ConfirmActionDialog
        open={archiveTarget !== null}
        title="부채 계약 보관"
        description={
          archiveTarget
            ? `"${archiveTarget.lenderName} ${archiveTarget.productName}" 계약을 보관할까요? 이미 생성된 계획 항목과 전표 이력은 유지됩니다.`
            : ''
        }
        confirmLabel="보관"
        pendingLabel="보관 중..."
        confirmColor="warning"
        busy={archiveMutation.isPending}
        onClose={() => {
          if (!archiveMutation.isPending) {
            setArchiveTarget(null);
          }
        }}
        onConfirm={() => {
          if (archiveTarget) {
            void archiveMutation.mutateAsync(archiveTarget);
          }
        }}
      />
    </Stack>
  );
}

function AgreementDetailItem({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight={700}>
        {value}
      </Typography>
    </Stack>
  );
}

function AgreementToolbar({
  activeCount,
  archivedCount,
  paidOffCount
}: {
  activeCount: number;
  archivedCount: number;
  paidOffCount: number;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={`상환 중 ${activeCount}건`} size="small" color="success" />
        <Chip
          label={`완납 ${paidOffCount}건`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`보관 ${archivedCount}건`}
          size="small"
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        계약 기준을 먼저 정리한 뒤 월별 상환 일정을 연결합니다.
      </Typography>
    </Stack>
  );
}

function RepaymentToolbar({
  repayments,
  selectedAgreement
}: {
  repayments: LiabilityRepaymentScheduleItem[];
  selectedAgreement: LiabilityAgreementItem | null;
}) {
  const plannedCount = repayments.filter((repayment) =>
    ['PLANNED', 'MATCHED'].includes(repayment.status)
  ).length;
  const postedCount = repayments.filter(
    (repayment) => repayment.status === 'POSTED'
  ).length;

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', md: 'center' }}
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip
          label={`일정 ${repayments.length}건`}
          size="small"
          color={selectedAgreement ? 'primary' : 'default'}
        />
        <Chip
          label={`계획 연결 ${plannedCount}건`}
          size="small"
          variant="outlined"
        />
        <Chip
          label={`확정 ${postedCount}건`}
          size="small"
          color={postedCount > 0 ? 'success' : 'default'}
          variant="outlined"
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        선택 계약 기준으로 상환 원금, 이자, 수수료를 분리해 관리합니다.
      </Typography>
    </Stack>
  );
}

function buildAgreementColumns({
  onEdit,
  onArchive
}: {
  onEdit: (agreement: LiabilityAgreementItem) => void;
  onArchive: (agreement: LiabilityAgreementItem) => void;
}): GridColDef<LiabilityAgreementItem>[] {
  return [
    {
      field: 'lenderName',
      headerName: '기관',
      flex: 1,
      minWidth: 130
    },
    {
      field: 'productName',
      headerName: '상품',
      flex: 1.3,
      minWidth: 160
    },
    {
      field: 'principalAmount',
      headerName: '원금',
      flex: 1,
      minWidth: 130,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'interestRate',
      headerName: '금리',
      flex: 0.7,
      minWidth: 90,
      valueFormatter: (value) =>
        value == null ? '-' : `${Number(value).toFixed(2)}%`
    },
    {
      field: 'paymentDay',
      headerName: '납부일',
      flex: 0.7,
      minWidth: 90,
      valueFormatter: (value) => (value ? `${value}일` : '-')
    },
    {
      field: 'defaultFundingAccountName',
      headerName: '자금수단',
      flex: 1.1,
      minWidth: 150,
      valueFormatter: (value) => (value ? String(value) : '미설정')
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 0.8,
      minWidth: 105,
      renderCell: (params) => <StatusChip label={params.row.status} />
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 1.9,
      minWidth: 300,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <GridActionCell>
          <Button
            component={Link}
            href={buildLiabilityDetailHref(params.row.id)}
            size="small"
            variant="contained"
          >
            상세 보기
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onEdit(params.row)}
          >
            수정
          </Button>
          <Button
            size="small"
            color="warning"
            disabled={params.row.status === 'ARCHIVED'}
            onClick={() => onArchive(params.row)}
          >
            보관
          </Button>
        </GridActionCell>
      )
    }
  ];
}

function buildRepaymentColumns({
  busyRepaymentId,
  onEdit,
  onGeneratePlanItem
}: {
  busyRepaymentId: string | null;
  onEdit: (repayment: LiabilityRepaymentScheduleItem) => void;
  onGeneratePlanItem: (repayment: LiabilityRepaymentScheduleItem) => void;
}): GridColDef<LiabilityRepaymentScheduleItem>[] {
  return [
    {
      field: 'dueDate',
      headerName: '상환일',
      flex: 0.9,
      minWidth: 120,
      valueFormatter: (value) => formatDate(String(value))
    },
    {
      field: 'principalAmount',
      headerName: '원금',
      flex: 1,
      minWidth: 130,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'interestAmount',
      headerName: '이자',
      flex: 1,
      minWidth: 120,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'feeAmount',
      headerName: '수수료',
      flex: 0.9,
      minWidth: 120,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'totalAmount',
      headerName: '합계',
      flex: 1,
      minWidth: 130,
      valueFormatter: (value) => formatWon(Number(value))
    },
    {
      field: 'status',
      headerName: '상태',
      flex: 1,
      minWidth: 120,
      renderCell: (params) => <StatusChip label={params.row.status} />
    },
    {
      field: 'matchedCollectedTransactionTitle',
      headerName: '수집 거래',
      flex: 1.3,
      minWidth: 160,
      valueFormatter: (value) => (value ? String(value) : '미연결')
    },
    {
      field: 'postedJournalEntryNumber',
      headerName: '전표',
      flex: 0.8,
      minWidth: 110,
      valueFormatter: (value) => (value ? String(value) : '-')
    },
    {
      field: 'actions',
      headerName: '동작',
      flex: 1.8,
      minWidth: 230,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const cannotGenerate =
          Boolean(params.row.linkedPlanItemId) ||
          Boolean(params.row.postedJournalEntryId) ||
          ['POSTED', 'SKIPPED', 'CANCELLED'].includes(params.row.status);

        return (
          <GridActionCell>
            <Button
              size="small"
              variant="outlined"
              disabled={params.row.status === 'POSTED'}
              onClick={() => onEdit(params.row)}
            >
              수정
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={cannotGenerate || busyRepaymentId === params.row.id}
              onClick={() => onGeneratePlanItem(params.row)}
            >
              {busyRepaymentId === params.row.id ? '생성 중' : '계획 생성'}
            </Button>
          </GridActionCell>
        );
      }
    }
  ];
}

function AgreementDrawer({
  drawerState,
  fundingAccounts,
  categories,
  accountSubjects,
  busy,
  onClose,
  onSubmit
}: {
  drawerState: AgreementDrawerState;
  fundingAccounts: FundingAccountItem[];
  categories: CategoryItem[];
  accountSubjects: AccountSubjectItem[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    payload: UpdateLiabilityAgreementRequest,
    fallback: LiabilityAgreementItem
  ) => void;
}) {
  const editAgreement =
    drawerState?.mode === 'edit' ? drawerState.agreement : null;
  const availableFundingAccounts = React.useMemo(
    () =>
      fundingAccounts.filter(
        (fundingAccount) =>
          fundingAccount.status === 'ACTIVE' ||
          fundingAccount.id === editAgreement?.defaultFundingAccountId
      ),
    [editAgreement?.defaultFundingAccountId, fundingAccounts]
  );
  const availableExpenseCategories = React.useMemo(
    () =>
      categories.filter(
        (category) =>
          category.kind === 'EXPENSE' &&
          (category.isActive ||
            category.id === editAgreement?.interestExpenseCategoryId ||
            category.id === editAgreement?.feeExpenseCategoryId)
      ),
    [
      categories,
      editAgreement?.feeExpenseCategoryId,
      editAgreement?.interestExpenseCategoryId
    ]
  );
  const availableLiabilitySubjects = React.useMemo(
    () =>
      accountSubjects.filter(
        (subject) =>
          subject.subjectKind === 'LIABILITY' &&
          (subject.isActive ||
            subject.id === editAgreement?.liabilityAccountSubjectId)
      ),
    [accountSubjects, editAgreement?.liabilityAccountSubjectId]
  );
  const [form, setForm] = React.useState<AgreementFormState>(() =>
    buildDefaultAgreementForm({
      defaultFundingAccountId: availableFundingAccounts[0]?.id ?? '',
      liabilityAccountSubjectId: availableLiabilitySubjects[0]?.id ?? '',
      interestExpenseCategoryId: availableExpenseCategories[0]?.id ?? ''
    })
  );
  const [localFeedback, setLocalFeedback] =
    React.useState<FeedbackAlertValue>(null);

  React.useEffect(() => {
    setLocalFeedback(null);

    if (editAgreement) {
      setForm(mapAgreementToForm(editAgreement));
      return;
    }

    if (drawerState?.mode === 'create') {
      setForm(
        buildDefaultAgreementForm({
          defaultFundingAccountId: availableFundingAccounts[0]?.id ?? '',
          liabilityAccountSubjectId: availableLiabilitySubjects[0]?.id ?? '',
          interestExpenseCategoryId: availableExpenseCategories[0]?.id ?? ''
        })
      );
    }
  }, [
    availableExpenseCategories,
    availableFundingAccounts,
    availableLiabilitySubjects,
    drawerState,
    editAgreement
  ]);

  const setField = <K extends keyof AgreementFormState>(
    field: K,
    value: AgreementFormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <FormDrawer
      open={drawerState !== null}
      onClose={onClose}
      title={drawerState?.mode === 'edit' ? '부채 계약 수정' : '부채 계약 등록'}
      description="상환 계획 생성에 쓰일 계약 기준과 기본 회계 연결값을 정리합니다."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLocalFeedback(null);

          const parsed = buildAgreementPayload(form);
          if ('error' in parsed) {
            setLocalFeedback({ severity: 'error', message: parsed.error });
            return;
          }

          const selectedFundingAccount = availableFundingAccounts.find(
            (item) => item.id === parsed.payload.defaultFundingAccountId
          );
          if (!selectedFundingAccount) {
            setLocalFeedback({
              severity: 'error',
              message: '상환 출금에 사용할 자금수단을 선택해 주세요.'
            });
            return;
          }

          const interestCategory = availableExpenseCategories.find(
            (item) => item.id === parsed.payload.interestExpenseCategoryId
          );
          const feeCategory = availableExpenseCategories.find(
            (item) => item.id === parsed.payload.feeExpenseCategoryId
          );

          onSubmit(
            parsed.payload,
            buildLiabilityAgreementFallbackItem(parsed.payload, {
              id:
                drawerState?.mode === 'edit'
                  ? drawerState.agreement.id
                  : undefined,
              defaultFundingAccountName: selectedFundingAccount.name,
              interestExpenseCategoryName: interestCategory?.name ?? null,
              feeExpenseCategoryName: feeCategory?.name ?? null
            })
          );
        }}
      >
        <Stack spacing={appLayout.cardGap}>
          {availableFundingAccounts.length === 0 ? (
            <Alert severity="warning" variant="outlined">
              활성 자금수단이 없어 부채 계약을 저장할 수 없습니다.
            </Alert>
          ) : null}
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="대출 기관"
                value={form.lenderName}
                onChange={(event) => setField('lenderName', event.target.value)}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="상품명"
                value={form.productName}
                onChange={(event) =>
                  setField('productName', event.target.value)
                }
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="대출번호 뒤 4자리"
                value={form.loanNumberLast4}
                onChange={(event) =>
                  setField('loanNumberLast4', event.target.value)
                }
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="원금"
                type="number"
                value={form.principalAmount}
                onChange={(event) =>
                  setField('principalAmount', event.target.value)
                }
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="대출 실행일"
                type="date"
                value={form.borrowedAt}
                onChange={(event) => setField('borrowedAt', event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="만기일"
                type="date"
                value={form.maturityDate}
                onChange={(event) =>
                  setField('maturityDate', event.target.value)
                }
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="금리"
                type="number"
                value={form.interestRate}
                onChange={(event) =>
                  setField('interestRate', event.target.value)
                }
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="금리 유형"
                select
                value={form.interestRateType}
                onChange={(event) =>
                  setField(
                    'interestRateType',
                    event.target.value as LiabilityInterestRateType
                  )
                }
                fullWidth
              >
                {Object.entries(interestRateTypeLabelMap).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="상환 방식"
                select
                value={form.repaymentMethod}
                onChange={(event) =>
                  setField(
                    'repaymentMethod',
                    event.target.value as LiabilityRepaymentMethod
                  )
                }
                fullWidth
              >
                {Object.entries(repaymentMethodLabelMap).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="기본 납부일"
                type="number"
                value={form.paymentDay}
                onChange={(event) => setField('paymentDay', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="출금 자금수단"
                select
                value={form.defaultFundingAccountId}
                onChange={(event) =>
                  setField('defaultFundingAccountId', event.target.value)
                }
                fullWidth
                required
              >
                {availableFundingAccounts.map((fundingAccount) => (
                  <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                    {fundingAccount.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="부채 계정과목"
                select
                value={form.liabilityAccountSubjectId}
                onChange={(event) =>
                  setField('liabilityAccountSubjectId', event.target.value)
                }
                fullWidth
              >
                <MenuItem value="">기본값</MenuItem>
                {availableLiabilitySubjects.map((subject) => (
                  <MenuItem key={subject.id} value={subject.id}>
                    {subject.code} · {subject.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="이자 비용 카테고리"
                select
                value={form.interestExpenseCategoryId}
                onChange={(event) =>
                  setField('interestExpenseCategoryId', event.target.value)
                }
                fullWidth
              >
                <MenuItem value="">미설정</MenuItem>
                {availableExpenseCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="수수료 카테고리"
                select
                value={form.feeExpenseCategoryId}
                onChange={(event) =>
                  setField('feeExpenseCategoryId', event.target.value)
                }
                fullWidth
              >
                <MenuItem value="">미설정</MenuItem>
                {availableExpenseCategories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="상태"
                select
                value={form.status}
                onChange={(event) =>
                  setField(
                    'status',
                    event.target.value as LiabilityAgreementStatus
                  )
                }
                fullWidth
              >
                {Object.entries(agreementStatusLabelMap).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="메모"
                value={form.memo}
                onChange={(event) => setField('memo', event.target.value)}
                minRows={3}
                multiline
                fullWidth
              />
            </Grid>
          </Grid>
          <FeedbackAlert feedback={localFeedback} />
          <Button
            type="submit"
            variant="contained"
            disabled={busy || availableFundingAccounts.length === 0}
            sx={{ alignSelf: 'flex-start' }}
          >
            {busy
              ? '저장 중...'
              : drawerState?.mode === 'edit'
                ? '수정'
                : '저장'}
          </Button>
        </Stack>
      </form>
    </FormDrawer>
  );
}

function RepaymentDrawer({
  drawerState,
  busy,
  onClose,
  onSubmit
}: {
  drawerState: RepaymentDrawerState;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    payload: UpdateLiabilityRepaymentScheduleRequest,
    fallback: LiabilityRepaymentScheduleItem
  ) => void;
}) {
  const [form, setForm] = React.useState<RepaymentFormState>(
    buildDefaultRepaymentForm()
  );
  const [localFeedback, setLocalFeedback] =
    React.useState<FeedbackAlertValue>(null);

  React.useEffect(() => {
    setLocalFeedback(null);

    if (drawerState?.mode === 'edit') {
      setForm(mapRepaymentToForm(drawerState.repayment));
      return;
    }

    if (drawerState?.mode === 'create') {
      setForm(buildDefaultRepaymentForm(drawerState.agreement.paymentDay));
    }
  }, [drawerState]);

  const setField = <K extends keyof RepaymentFormState>(
    field: K,
    value: RepaymentFormState[K]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <FormDrawer
      open={drawerState !== null}
      onClose={onClose}
      title={drawerState?.mode === 'edit' ? '상환 일정 수정' : '상환 일정 추가'}
      description={
        drawerState
          ? `${drawerState.agreement.lenderName} ${drawerState.agreement.productName} 계약의 월별 상환 기준을 입력합니다.`
          : undefined
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setLocalFeedback(null);

          if (!drawerState) {
            return;
          }

          const parsed = buildRepaymentPayload(form);
          if ('error' in parsed) {
            setLocalFeedback({ severity: 'error', message: parsed.error });
            return;
          }

          onSubmit(
            parsed.payload,
            buildLiabilityRepaymentFallbackItem(
              drawerState.agreement,
              parsed.payload,
              {
                id:
                  drawerState.mode === 'edit'
                    ? drawerState.repayment.id
                    : undefined,
                linkedPlanItemId:
                  drawerState.mode === 'edit'
                    ? drawerState.repayment.linkedPlanItemId
                    : null,
                matchedCollectedTransactionId:
                  drawerState.mode === 'edit'
                    ? drawerState.repayment.matchedCollectedTransactionId
                    : null
              }
            )
          );
        }}
      >
        <Stack spacing={appLayout.cardGap}>
          <Grid container spacing={appLayout.fieldGap}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="상환 예정일"
                type="date"
                value={form.dueDate}
                onChange={(event) => setField('dueDate', event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="원금 상환액"
                type="number"
                value={form.principalAmount}
                onChange={(event) =>
                  setField('principalAmount', event.target.value)
                }
                fullWidth
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="이자"
                type="number"
                value={form.interestAmount}
                onChange={(event) =>
                  setField('interestAmount', event.target.value)
                }
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="수수료"
                type="number"
                value={form.feeAmount}
                onChange={(event) => setField('feeAmount', event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="상태"
                select
                value={form.status}
                onChange={(event) =>
                  setField(
                    'status',
                    event.target.value as LiabilityRepaymentScheduleStatus
                  )
                }
                fullWidth
              >
                {Object.entries(repaymentStatusLabelMap).map(
                  ([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  )
                )}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="메모"
                value={form.memo}
                onChange={(event) => setField('memo', event.target.value)}
                minRows={3}
                multiline
                fullWidth
              />
            </Grid>
          </Grid>
          <FeedbackAlert feedback={localFeedback} />
          <Button
            type="submit"
            variant="contained"
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
          >
            {busy
              ? '저장 중...'
              : drawerState?.mode === 'edit'
                ? '수정'
                : '저장'}
          </Button>
        </Stack>
      </form>
    </FormDrawer>
  );
}

function buildDefaultAgreementForm(input?: {
  defaultFundingAccountId?: string;
  liabilityAccountSubjectId?: string;
  interestExpenseCategoryId?: string;
}): AgreementFormState {
  return {
    lenderName: '',
    productName: '',
    loanNumberLast4: '',
    principalAmount: '',
    borrowedAt: todayDateInput(),
    maturityDate: '',
    interestRate: '',
    interestRateType: 'FIXED',
    repaymentMethod: 'EQUAL_PAYMENT',
    paymentDay: '25',
    defaultFundingAccountId: input?.defaultFundingAccountId ?? '',
    liabilityAccountSubjectId: input?.liabilityAccountSubjectId ?? '',
    interestExpenseCategoryId: input?.interestExpenseCategoryId ?? '',
    feeExpenseCategoryId: '',
    status: 'ACTIVE',
    memo: ''
  };
}

function mapAgreementToForm(
  agreement: LiabilityAgreementItem
): AgreementFormState {
  return {
    lenderName: agreement.lenderName,
    productName: agreement.productName,
    loanNumberLast4: agreement.loanNumberLast4 ?? '',
    principalAmount: String(agreement.principalAmount),
    borrowedAt: agreement.borrowedAt.slice(0, 10),
    maturityDate: agreement.maturityDate?.slice(0, 10) ?? '',
    interestRate:
      agreement.interestRate == null ? '' : String(agreement.interestRate),
    interestRateType: agreement.interestRateType,
    repaymentMethod: agreement.repaymentMethod,
    paymentDay:
      agreement.paymentDay == null ? '' : String(agreement.paymentDay),
    defaultFundingAccountId: agreement.defaultFundingAccountId,
    liabilityAccountSubjectId: agreement.liabilityAccountSubjectId ?? '',
    interestExpenseCategoryId: agreement.interestExpenseCategoryId ?? '',
    feeExpenseCategoryId: agreement.feeExpenseCategoryId ?? '',
    status: agreement.status,
    memo: agreement.memo ?? ''
  };
}

function buildAgreementPayload(
  form: AgreementFormState
): { payload: CreateLiabilityAgreementRequest } | { error: string } {
  const principalAmount = parsePositiveInteger(form.principalAmount, '원금');
  if ('error' in principalAmount) {
    return principalAmount;
  }

  let paymentDay: number | null = null;
  if (form.paymentDay.trim()) {
    const parsedPaymentDay = parseIntegerInRange(
      form.paymentDay,
      '기본 납부일',
      1,
      31
    );
    if ('error' in parsedPaymentDay) {
      return parsedPaymentDay;
    }

    paymentDay = parsedPaymentDay.value;
  }

  let interestRate: number | null = null;
  if (form.interestRate.trim()) {
    const parsedInterestRate = parseNonNegativeNumber(
      form.interestRate,
      '금리'
    );
    if ('error' in parsedInterestRate) {
      return parsedInterestRate;
    }

    interestRate = parsedInterestRate.value;
  }

  if (!form.lenderName.trim() || !form.productName.trim()) {
    return { error: '대출 기관과 상품명을 입력해 주세요.' };
  }

  if (!form.borrowedAt) {
    return { error: '대출 실행일을 입력해 주세요.' };
  }

  if (!form.defaultFundingAccountId) {
    return { error: '출금 자금수단을 선택해 주세요.' };
  }

  return {
    payload: {
      lenderName: form.lenderName.trim(),
      productName: form.productName.trim(),
      loanNumberLast4: form.loanNumberLast4.trim() || null,
      principalAmount: principalAmount.value,
      borrowedAt: form.borrowedAt,
      maturityDate: form.maturityDate || null,
      interestRate,
      interestRateType: form.interestRateType,
      repaymentMethod: form.repaymentMethod,
      paymentDay,
      defaultFundingAccountId: form.defaultFundingAccountId,
      liabilityAccountSubjectId: form.liabilityAccountSubjectId || null,
      interestExpenseCategoryId: form.interestExpenseCategoryId || null,
      feeExpenseCategoryId: form.feeExpenseCategoryId || null,
      status: form.status,
      memo: form.memo.trim() || null
    }
  };
}

function buildDefaultRepaymentForm(
  paymentDay?: number | null
): RepaymentFormState {
  return {
    dueDate: nextDateInput(paymentDay ?? 25),
    principalAmount: '',
    interestAmount: '0',
    feeAmount: '0',
    status: 'SCHEDULED',
    memo: ''
  };
}

function mapRepaymentToForm(
  repayment: LiabilityRepaymentScheduleItem
): RepaymentFormState {
  return {
    dueDate: repayment.dueDate.slice(0, 10),
    principalAmount: String(repayment.principalAmount),
    interestAmount: String(repayment.interestAmount),
    feeAmount: String(repayment.feeAmount),
    status: repayment.status,
    memo: repayment.memo ?? ''
  };
}

function buildRepaymentPayload(
  form: RepaymentFormState
): { payload: UpdateLiabilityRepaymentScheduleRequest } | { error: string } {
  const principalAmount = parseNonNegativeInteger(
    form.principalAmount,
    '원금 상환액'
  );
  if ('error' in principalAmount) {
    return principalAmount;
  }

  const interestAmount = parseNonNegativeInteger(
    form.interestAmount || '0',
    '이자'
  );
  if ('error' in interestAmount) {
    return interestAmount;
  }

  const feeAmount = parseNonNegativeInteger(form.feeAmount || '0', '수수료');
  if ('error' in feeAmount) {
    return feeAmount;
  }

  if (!form.dueDate) {
    return { error: '상환 예정일을 입력해 주세요.' };
  }

  const totalAmount = addMoneyWon(
    addMoneyWon(principalAmount.value, interestAmount.value),
    feeAmount.value
  );

  if (totalAmount <= 0) {
    return { error: '원금, 이자, 수수료 중 하나 이상은 0보다 커야 합니다.' };
  }

  return {
    payload: {
      dueDate: form.dueDate,
      principalAmount: principalAmount.value,
      interestAmount: interestAmount.value,
      feeAmount: feeAmount.value,
      status: form.status,
      memo: form.memo.trim() || null
    }
  };
}

function parsePositiveInteger(value: string, label: string): NumberParseResult {
  const parsed = parseNonNegativeInteger(value, label);
  if ('error' in parsed) {
    return parsed;
  }

  if (parsed.value <= 0) {
    return { error: `${label}은 0보다 커야 합니다.` };
  }

  return parsed;
}

function parseNonNegativeInteger(
  value: string,
  label: string
): NumberParseResult {
  const trimmed = value.trim();
  const parsed = Number(trimmed);

  if (!trimmed || !Number.isInteger(parsed) || parsed < 0) {
    return { error: `${label}은 0 이상의 정수로 입력해 주세요.` };
  }

  return { value: parsed };
}

function parseNonNegativeNumber(
  value: string,
  label: string
): NumberParseResult {
  const trimmed = value.trim();
  const parsed = Number(trimmed);

  if (!trimmed || Number.isNaN(parsed) || parsed < 0) {
    return { error: `${label}은 0 이상의 숫자로 입력해 주세요.` };
  }

  return { value: parsed };
}

function parseIntegerInRange(
  value: string,
  label: string,
  min: number,
  max: number
): NumberParseResult {
  const parsed = parseNonNegativeInteger(value, label);
  if ('error' in parsed) {
    return parsed;
  }

  if (parsed.value < min || parsed.value > max) {
    return { error: `${label}은 ${min}부터 ${max} 사이로 입력해 주세요.` };
  }

  return parsed;
}

function todayDateInput() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function nextDateInput(day: number) {
  const today = new Date();
  const next = new Date(today.getFullYear(), today.getMonth(), day);

  if (next < today) {
    next.setMonth(next.getMonth() + 1);
  }

  next.setMinutes(next.getMinutes() - next.getTimezoneOffset());
  return next.toISOString().slice(0, 10);
}

function buildFallbackOverview({
  agreements,
  repayments
}: {
  agreements: LiabilityAgreementItem[];
  repayments: LiabilityRepaymentScheduleItem[];
}): LiabilityOverviewResponse {
  const overviewItems = agreements.map((agreement) =>
    buildLiabilityOverviewItemFallback(
      agreement,
      repayments.filter(
        (repayment) => repayment.liabilityAgreementId === agreement.id
      )
    )
  );
  const activeAgreements = agreements.filter(
    (agreement) => agreement.status === 'ACTIVE'
  );
  const nextDueDate =
    overviewItems
      .map((item) => item.nextDueDate)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => left.localeCompare(right))[0] ?? null;

  return {
    generatedAt: new Date().toISOString(),
    totalAgreementCount: agreements.length,
    activeAgreementCount: activeAgreements.length,
    remainingPrincipalWon: overviewItems
      .filter((item) => item.status === 'ACTIVE')
      .reduce((sum, item) => sum + item.remainingPrincipalWon, 0),
    currentPeriodDueWon: overviewItems.reduce(
      (sum, item) => sum + item.currentPeriodDueWon,
      0
    ),
    nextDueDate,
    items: overviewItems
  };
}

function buildLiabilityOverviewItemFallback(
  agreement: LiabilityAgreementItem,
  repayments: LiabilityRepaymentScheduleItem[]
): LiabilityOverviewItem {
  const postedPrincipalWon = repayments
    .filter((repayment) => repayment.status === 'POSTED')
    .reduce((sum, repayment) => sum + repayment.principalAmount, 0);
  const openRepayments = repayments.filter(
    (repayment) =>
      !['POSTED', 'CANCELLED', 'SKIPPED'].includes(repayment.status)
  );
  const nextDueDate =
    openRepayments.sort((left, right) =>
      left.dueDate.localeCompare(right.dueDate)
    )[0]?.dueDate ?? null;

  return {
    liabilityAgreementId: agreement.id,
    lenderName: agreement.lenderName,
    productName: agreement.productName,
    status: agreement.status,
    remainingPrincipalWon: Math.max(
      subtractMoneyWon(agreement.principalAmount, postedPrincipalWon),
      0
    ),
    nextDueDate,
    currentPeriodDueWon: openRepayments.reduce(
      (sum, repayment) => sum + repayment.totalAmount,
      0
    ),
    scheduledCount: repayments.filter(
      (repayment) => repayment.status === 'SCHEDULED'
    ).length,
    plannedCount: repayments.filter(
      (repayment) => repayment.status === 'PLANNED'
    ).length,
    matchedCount: repayments.filter(
      (repayment) => repayment.status === 'MATCHED'
    ).length,
    postedCount: repayments.filter((repayment) => repayment.status === 'POSTED')
      .length
  };
}

function buildLiabilitiesHelpContext(mode: LiabilitiesPageMode) {
  if (mode === 'detail') {
    return {
      title: '부채 계약 상세 도움말',
      description:
        '이 화면은 선택한 부채 계약의 기준과 상환 일정을 집중해서 관리하는 상세 화면입니다.',
      primaryEntity: '부채 계약 상세',
      relatedEntities: ['상환 일정', '계획 항목', '수집 거래', '전표'],
      truthSource:
        '부채 계약은 상환 기준 데이터이고, 실제 회계 반영은 상환 일정에서 만든 계획 항목과 전표 확정 시점에 이뤄집니다.',
      supplementarySections: [
        {
          title: '이 탭에서 하는 일',
          items: [
            '선택한 계약의 대출 조건과 자금수단, 계정과목 연결을 먼저 확인합니다.',
            '월별 상환 일정을 추가하거나 수정하고 계획 항목 생성을 실행합니다.',
            '생성된 계획과 연결 거래를 수집 거래/전표 화면으로 넘겨 실제 회계 반영을 이어갑니다.'
          ]
        },
        {
          title: '이어지는 화면',
          links: [
            {
              title: '부채 계약 목록',
              description: '다른 계약을 선택하거나 신규 계약을 등록합니다.',
              href: '/liabilities',
              actionLabel: '부채 목록 보기'
            },
            {
              title: '수집 거래',
              description:
                '상환 거래를 전표 준비 상태에서 검토하고 확정합니다.',
              href: '/transactions',
              actionLabel: '수집 거래 보기'
            },
            {
              title: '전표 조회',
              description: '확정된 원금 상환과 이자 비용 전표를 확인합니다.',
              href: '/journal-entries',
              actionLabel: '전표 보기'
            }
          ]
        }
      ],
      readModelNote:
        '상환 일정은 운영 계획입니다. 원금 감소와 이자 비용은 수집 거래 확정으로 생성된 전표를 기준으로 보고서에 반영됩니다.'
    };
  }

  return {
    title: '부채 계약 목록 도움말',
    description:
      '이 화면은 부채 계약 기준을 정리하고, 개별 계약 상세 화면으로 이어지는 시작 화면입니다.',
    primaryEntity: '부채 계약 목록',
    relatedEntities: ['상환 일정', '계획 항목', '수집 거래', '전표'],
    truthSource:
      '부채 계약은 상환 기준 데이터이고, 실제 회계 반영은 상환 일정에서 만든 계획 항목과 전표 확정 시점에 이뤄집니다.',
    supplementarySections: [
      {
        title: '바로 쓰는 순서',
        items: [
          '대출 기관, 상품명, 원금, 납부 자금수단을 입력해 부채 계약을 등록합니다.',
          '목록에서 상세 보기로 내려가 운영 월 상환 예정일과 원금, 이자, 수수료를 입력합니다.',
          '상세 화면에서 계획 생성을 실행해 계획 항목과 전표 준비 수집 거래를 연결합니다.',
          '실제 출금 확인 후 수집 거래 화면에서 전표로 확정합니다.'
        ]
      },
      {
        title: '이어지는 화면',
        links: [
          {
            title: '계획 항목',
            description: '상환 일정에서 생성된 월 계획을 확인합니다.',
            href: '/plan-items',
            actionLabel: '계획 항목 보기'
          },
          {
            title: '수집 거래',
            description: '상환 거래를 전표 준비 상태에서 검토하고 확정합니다.',
            href: '/transactions',
            actionLabel: '수집 거래 보기'
          }
        ]
      }
    ],
    readModelNote:
      '상환 일정은 운영 계획입니다. 원금 감소와 이자 비용은 수집 거래 확정으로 생성된 전표를 기준으로 보고서에 반영됩니다.'
  };
}

function buildLiabilityDetailHref(agreementId: string): Route {
  return `/liabilities/${agreementId}` as Route;
}

async function invalidateLiabilityQueries(queryClient: QueryClient) {
  if (webRuntime.demoFallbackEnabled) {
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: liabilitiesQueryKey }),
    queryClient.invalidateQueries({ queryKey: liabilitiesOverviewQueryKey })
  ]);
}
