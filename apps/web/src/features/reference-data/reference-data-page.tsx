'use client';

import * as React from 'react';
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';
import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import type {
  AccountSubjectItem,
  CategoryItem,
  CreateCategoryRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  LedgerTransactionTypeItem,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import type { GridColDef } from '@mui/x-data-grid';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { formatWon } from '@/shared/lib/format';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import { ConfirmActionDialog } from '@/shared/ui/confirm-action-dialog';
import { DataTableCard } from '@/shared/ui/data-table-card';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { CategoryManagementForm } from './category-management-form';
import { FundingAccountManagementForm } from './funding-account-management-form';
import {
  accountSubjectsQueryKey,
  categoriesQueryKey,
  categoriesManagementQueryKey,
  createCategory,
  createFundingAccount,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getAccountSubjects,
  getCategories,
  getFundingAccounts,
  getReferenceDataReadiness,
  getLedgerTransactionTypes,
  ledgerTransactionTypesQueryKey,
  referenceDataReadinessQueryKey,
  updateCategory,
  updateFundingAccount
} from './reference-data.api';
import { ReferenceDataReadinessSummarySection } from './reference-data-readiness';

const accountSubjectColumns: GridColDef<AccountSubjectItem>[] = [
  { field: 'code', headerName: '코드', flex: 0.5 },
  { field: 'name', headerName: '계정과목', flex: 1 },
  { field: 'statementType', headerName: '보고서', flex: 0.8 },
  { field: 'normalSide', headerName: '정상잔액', flex: 0.7 }
];

const ledgerTransactionTypeColumns: GridColDef<LedgerTransactionTypeItem>[] = [
  { field: 'code', headerName: '코드', flex: 0.8 },
  { field: 'name', headerName: '거래유형', flex: 1 },
  { field: 'flowKind', headerName: '흐름', flex: 0.7 },
  { field: 'postingPolicyKey', headerName: '전표 정책', flex: 1.1 }
];

type CategoryEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; categoryId: string }
  | null;

type FundingAccountEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; fundingAccountId: string }
  | null;

type FundingAccountStatusActionTarget = {
  fundingAccount: FundingAccountItem;
  nextStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
} | null;

export function ReferenceDataPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);
  const [fundingAccountEditorState, setFundingAccountEditorState] =
    React.useState<FundingAccountEditorState>(null);
  const [categoryEditorState, setCategoryEditorState] =
    React.useState<CategoryEditorState>(null);
  const [fundingAccountStatusActionTarget, setFundingAccountStatusActionTarget] =
    React.useState<FundingAccountStatusActionTarget>(null);
  const [toggleTarget, setToggleTarget] = React.useState<CategoryItem | null>(
    null
  );
  const fundingAccountsManagementQuery = useQuery({
    queryKey: fundingAccountsManagementQueryKey,
    queryFn: () => getFundingAccounts({ includeInactive: true })
  });
  const categoriesManagementQuery = useQuery({
    queryKey: categoriesManagementQueryKey,
    queryFn: () => getCategories({ includeInactive: true })
  });
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const ledgerTransactionTypesQuery = useQuery({
    queryKey: ledgerTransactionTypesQueryKey,
    queryFn: getLedgerTransactionTypes
  });
  const readinessQuery = useQuery({
    queryKey: referenceDataReadinessQueryKey,
    queryFn: getReferenceDataReadiness
  });
  const currentWorkspace = user?.currentWorkspace ?? null;
  const membershipRole = currentWorkspace?.membership.role ?? null;
  const canManageReferenceData =
    membershipRole === 'OWNER' || membershipRole === 'MANAGER';
  const managedFundingAccounts = React.useMemo(
    () => fundingAccountsManagementQuery.data ?? [],
    [fundingAccountsManagementQuery.data]
  );
  const managedCategories = React.useMemo(
    () => categoriesManagementQuery.data ?? [],
    [categoriesManagementQuery.data]
  );
  const editingFundingAccount =
    fundingAccountEditorState?.mode === 'edit'
      ? managedFundingAccounts.find(
          (fundingAccount) =>
            fundingAccount.id === fundingAccountEditorState.fundingAccountId
        ) ?? null
      : null;
  const editingCategory =
    categoryEditorState?.mode === 'edit'
      ? managedCategories.find(
          (category) => category.id === categoryEditorState.categoryId
        ) ?? null
      : null;

  useDomainHelp({
    title: '기준 데이터와 참조 입력',
    description:
      '입출금 계정, 거래 분류, 계정과목, 거래 유형은 월 운영, 거래 입력, 전표 확정, 마감 보고에 공통으로 쓰이는 공식 기준 데이터입니다.',
    primaryEntity: '기준 데이터',
    relatedEntities: [
      '입출금 계정',
      '거래 분류',
      '계정과목',
      '거래 유형'
    ],
    truthSource:
      '현재 작업 문맥의 활성 기준 데이터만 각 입력 화면의 공식 선택지로 사용합니다.',
    supplementarySections: [
      {
        title: '현재 작업 문맥',
        description:
          '기준 데이터는 로그인한 사용자의 현재 사업 장부 문맥 안에서만 조회됩니다.',
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
            value: currentWorkspace?.membership.role ?? '-'
          }
        ]
      },
      {
        title: '참조 입력 원칙',
        description:
          '화면별 입력 폼은 여기서 조회되는 활성 기준 데이터만 선택지로 사용합니다.',
        items: [
          '수집 거래와 반복 규칙 폼은 이 화면에서 보이는 공식 기준 데이터만 사용합니다.',
          '입력 화면은 기준 데이터의 식별자와 정책 키를 참조하며, 임의 텍스트를 기준값으로 확정하지 않습니다.',
          '카테고리는 현재 앱 안에서 직접 생성, 이름 수정, 비활성화/재활성화를 지원합니다.',
          '자금수단은 현재 앱 안에서 직접 생성, 이름 수정, 비활성화/재활성화/종료를 지원합니다. 종료는 비활성 자금수단에서만 가능하고, 종료 후에는 읽기 전용으로 유지합니다.',
          '계정과목과 거래유형은 system-managed 기준 데이터로 유지되며, 운영자는 존재 여부와 활성 상태를 확인합니다.'
        ]
      }
    ],
    readModelNote:
      '이 화면은 각 입력 폼에서 참조하는 활성 기준 데이터를 확인하고, readiness/ownership를 함께 점검하며 현재 범위의 카테고리/자금수단 관리까지 수행하는 운영 화면입니다.'
  });

  const saveFundingAccountMutation = useMutation({
    mutationFn: (input: {
      mode: 'create' | 'edit';
      fundingAccountId?: string;
      payload: CreateFundingAccountRequest | UpdateFundingAccountRequest;
      fallback: FundingAccountItem;
    }) => {
      if (input.mode === 'edit' && input.fundingAccountId) {
        return updateFundingAccount(
          input.fundingAccountId,
          input.payload as UpdateFundingAccountRequest,
          input.fallback
        );
      }

      return createFundingAccount(
        input.payload as CreateFundingAccountRequest,
        input.fallback
      );
    },
    onSuccess: async (saved, variables) => {
      setFundingAccountEditorState(null);
      setFeedback({
        severity: 'success',
        message:
          variables.mode === 'create'
            ? `${saved.name} 자금수단을 추가했습니다.`
            : `${saved.name} 자금수단을 저장했습니다.`
      });

      await invalidateReferenceDataQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '자금수단을 저장하지 못했습니다.'
      });
    }
  });

  const saveCategoryMutation = useMutation({
    mutationFn: (input: {
      mode: 'create' | 'edit';
      categoryId?: string;
      payload: CreateCategoryRequest | UpdateCategoryRequest;
      fallback: CategoryItem;
    }) => {
      if (input.mode === 'edit' && input.categoryId) {
        return updateCategory(
          input.categoryId,
          input.payload as UpdateCategoryRequest,
          input.fallback
        );
      }

      return createCategory(
        input.payload as CreateCategoryRequest,
        input.fallback
      );
    },
    onSuccess: async (saved, variables) => {
      setCategoryEditorState(null);
      setFeedback({
        severity: 'success',
        message:
          variables.mode === 'create'
            ? `${saved.name} 카테고리를 추가했습니다.`
            : `${saved.name} 카테고리를 저장했습니다.`
      });

      await invalidateReferenceDataQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '카테고리를 저장하지 못했습니다.'
      });
    }
  });

  const transitionFundingAccountMutation = useMutation({
    mutationFn: (
      input: Exclude<FundingAccountStatusActionTarget, null>
    ) =>
      updateFundingAccount(
        input.fundingAccount.id,
        {
          name: input.fundingAccount.name,
          status: input.nextStatus
        },
        {
          ...input.fundingAccount,
          status: input.nextStatus
        }
      ),
    onSuccess: async (saved, variables) => {
      setFundingAccountStatusActionTarget(null);
      setFeedback({
        severity: 'success',
        message: readFundingAccountTransitionSuccessMessage(
          variables.fundingAccount.name,
          saved.status
        )
      });

      await invalidateReferenceDataQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '자금수단 상태를 변경하지 못했습니다.'
      });
    }
  });

  const toggleCategoryMutation = useMutation({
    mutationFn: (category: CategoryItem) =>
      updateCategory(
        category.id,
        {
          name: category.name,
          isActive: !category.isActive
        },
        {
          ...category,
          isActive: !category.isActive
        }
      ),
    onSuccess: async (saved, previous) => {
      setToggleTarget(null);
      setFeedback({
        severity: 'success',
        message: saved.isActive
          ? `${previous.name} 카테고리를 다시 활성화했습니다.`
          : `${previous.name} 카테고리를 비활성화했습니다.`
      });

      await invalidateReferenceDataQueries(queryClient);
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '카테고리 상태를 변경하지 못했습니다.'
      });
    }
  });

  const fundingAccountColumns = React.useMemo<GridColDef<FundingAccountItem>[]>(
    () => [
      { field: 'name', headerName: '자금수단', flex: 1.2 },
      {
        field: 'type',
        headerName: '유형',
        flex: 0.7,
        valueFormatter: (value) => readFundingAccountTypeLabel(String(value))
      },
      {
        field: 'status',
        headerName: '상태',
        flex: 0.7,
        renderCell: (params) => (
          <Chip
            label={readFundingAccountStatusLabel(params.row.status)}
            size="small"
            color={readFundingAccountStatusColor(params.row.status)}
            variant={params.row.status === 'ACTIVE' ? 'filled' : 'outlined'}
          />
        )
      },
      {
        field: 'balanceWon',
        headerName: '현재 잔액',
        flex: 0.8,
        valueFormatter: (value) => formatWon(Number(value ?? 0))
      },
      {
        field: 'actions',
        headerName: '관리',
        flex: 1.8,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          if (!canManageReferenceData) {
            return (
              <Typography variant="caption" color="text.secondary">
                OWNER/MANAGER 전용
              </Typography>
            );
          }

          if (params.row.status === 'CLOSED') {
            return (
              <Typography variant="caption" color="text.secondary">
                종료 계정은 읽기 전용
              </Typography>
            );
          }

          return (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => {
                  setFeedback(null);
                  setFundingAccountEditorState({
                    mode: 'edit',
                    fundingAccountId: params.row.id
                  });
                }}
              >
                수정
              </Button>
              <Button
                size="small"
                color={params.row.status === 'ACTIVE' ? 'warning' : 'success'}
                onClick={() => {
                  setFeedback(null);
                  setFundingAccountStatusActionTarget({
                    fundingAccount: params.row,
                    nextStatus:
                      params.row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                  });
                }}
              >
                {params.row.status === 'ACTIVE' ? '비활성화' : '재활성화'}
              </Button>
              {params.row.status === 'INACTIVE' ? (
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setFeedback(null);
                    setFundingAccountStatusActionTarget({
                      fundingAccount: params.row,
                      nextStatus: 'CLOSED'
                    });
                  }}
                >
                  종료
                </Button>
              ) : null}
            </Stack>
          );
        }
      }
    ],
    [canManageReferenceData]
  );

  const categoryColumns = React.useMemo<GridColDef<CategoryItem>[]>(
    () => [
      { field: 'name', headerName: '카테고리', flex: 1.2 },
      {
        field: 'kind',
        headerName: '구분',
        flex: 0.8,
        valueFormatter: (value) => readCategoryKindLabel(String(value))
      },
      {
        field: 'isActive',
        headerName: '상태',
        flex: 0.7,
        renderCell: (params) => (
          <Chip
            label={params.row.isActive ? '활성' : '비활성'}
            size="small"
            color={params.row.isActive ? 'success' : 'default'}
            variant={params.row.isActive ? 'filled' : 'outlined'}
          />
        )
      },
      {
        field: 'actions',
        headerName: '관리',
        flex: 1.3,
        sortable: false,
        filterable: false,
        renderCell: (params) =>
          canManageReferenceData ? (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => {
                  setFeedback(null);
                  setCategoryEditorState({
                    mode: 'edit',
                    categoryId: params.row.id
                  });
                }}
              >
                수정
              </Button>
              <Button
                size="small"
                color={params.row.isActive ? 'warning' : 'success'}
                onClick={() => {
                  setFeedback(null);
                  setToggleTarget(params.row);
                }}
              >
                {params.row.isActive ? '비활성화' : '재활성화'}
              </Button>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              OWNER/MANAGER 전용
            </Typography>
          )
      }
    ],
    [canManageReferenceData]
  );

  const queryErrors = [
    readinessQuery.error,
    fundingAccountsManagementQuery.error,
    categoriesManagementQuery.error,
    accountSubjectsQuery.error,
    ledgerTransactionTypesQuery.error
  ].filter(Boolean);

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="기준 데이터"
        title="기준 데이터와 참조 입력"
        description="현재 사업 장부에서 사용하는 활성 기준 데이터와 준비 상태를 한 번에 확인합니다."
      />

      {feedback ? (
        <Alert severity={feedback.severity} variant="outlined">
          {feedback.message}
        </Alert>
      ) : null}

      {queryErrors.length > 0 ? (
        <QueryErrorAlert
          title="기준 데이터 일부를 불러오지 못했습니다."
          error={queryErrors[0]}
        />
      ) : null}

      {readinessQuery.data ? (
        <ReferenceDataReadinessSummarySection readiness={readinessQuery.data} />
      ) : null}

      <Alert severity="info" variant="outlined">
        {canManageReferenceData
          ? '현재 범위에서는 자금수단과 카테고리를 앱 안에서 직접 추가하고, 이름 수정과 활성 상태 관리를 할 수 있습니다. 자금수단은 비활성 상태에서만 종료(CLOSED)할 수 있고, 종료 후에는 읽기 전용으로 유지됩니다. 잔액 직접 수정은 아직 지원하지 않습니다.'
          : '자금수단/카테고리 직접 관리는 OWNER 또는 MANAGER 역할에서만 가능합니다. 현재 역할은 기준 데이터 현황과 운영 영향을 확인하는 범위로 유지됩니다.'}
      </Alert>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="자금수단"
            description="거래 입력과 반복 규칙에서 입출금 계정으로 선택하는 기준 목록입니다. 현재 범위에서는 생성, 이름 수정, 비활성화/재활성화, 비활성 자금수단 종료를 지원합니다."
            actions={
              canManageReferenceData ? (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    setFeedback(null);
                    setFundingAccountEditorState({ mode: 'create' });
                  }}
                >
                  자금수단 추가
                </Button>
              ) : null
            }
            rows={managedFundingAccounts}
            columns={fundingAccountColumns}
            height={360}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="카테고리"
            description="수입, 지출, 이체를 분류할 때 사용하는 기준 목록입니다. 현재 범위에서는 생성, 이름 수정, 비활성화/재활성화를 지원합니다."
            actions={
              canManageReferenceData ? (
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => {
                    setFeedback(null);
                    setCategoryEditorState({ mode: 'create' });
                  }}
                >
                  카테고리 추가
                </Button>
              ) : null
            }
            rows={managedCategories}
            columns={categoryColumns}
            height={360}
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="계정과목"
            description="전표 라인과 마감 잔액 계산에서 공통으로 쓰는 공식 계정과목입니다."
            rows={accountSubjectsQuery.data ?? []}
            columns={accountSubjectColumns}
            height={360}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <DataTableCard
            title="거래유형"
            description="계획 항목과 수집 거래가 공통으로 참조하는 사업 거래 유형입니다."
            rows={ledgerTransactionTypesQuery.data ?? []}
            columns={ledgerTransactionTypeColumns}
            height={360}
          />
        </Grid>
      </Grid>

      <FormDrawer
        open={fundingAccountEditorState !== null}
        onClose={() => setFundingAccountEditorState(null)}
        title={
          fundingAccountEditorState?.mode === 'edit'
            ? '자금수단 수정'
            : '자금수단 추가'
        }
        description={
          fundingAccountEditorState?.mode === 'edit'
            ? '현재 범위에서는 자금수단 이름을 수정합니다. 활성/비활성/종료 전환은 목록 액션에서 처리합니다.'
            : '현재 장부에 새 자금수단을 추가합니다. 생성 후에는 입력 화면의 활성 선택지에 반영됩니다.'
        }
      >
        {fundingAccountEditorState?.mode === 'edit' && !editingFundingAccount ? (
          <Alert severity="warning" variant="outlined">
            수정할 자금수단을 찾지 못했습니다.
          </Alert>
        ) : (
          <FundingAccountManagementForm
            mode={fundingAccountEditorState?.mode ?? 'create'}
            initialFundingAccount={editingFundingAccount}
            busy={saveFundingAccountMutation.isPending}
            onSubmit={async (input) => {
              setFeedback(null);
              await saveFundingAccountMutation.mutateAsync({
                mode: fundingAccountEditorState?.mode ?? 'create',
                fundingAccountId: editingFundingAccount?.id,
                payload:
                  fundingAccountEditorState?.mode === 'edit'
                    ? {
                        name: input.name
                      }
                    : input,
                fallback: {
                  id:
                    editingFundingAccount?.id ??
                    `funding-account-demo-${Date.now()}`,
                  name: input.name,
                  type: editingFundingAccount?.type ?? input.type,
                  balanceWon: editingFundingAccount?.balanceWon ?? 0,
                  status: editingFundingAccount?.status ?? 'ACTIVE'
                }
              });
            }}
          />
        )}
      </FormDrawer>

      <FormDrawer
        open={categoryEditorState !== null}
        onClose={() => setCategoryEditorState(null)}
        title={
          categoryEditorState?.mode === 'edit'
            ? '카테고리 수정'
            : '카테고리 추가'
        }
        description={
          categoryEditorState?.mode === 'edit'
            ? '현재 범위에서는 카테고리 이름과 활성 상태만 관리합니다.'
            : '현재 장부에 새 카테고리를 추가합니다. 생성 후에는 입력 화면의 활성 선택지에 반영됩니다.'
        }
      >
        {categoryEditorState?.mode === 'edit' && !editingCategory ? (
          <Alert severity="warning" variant="outlined">
            수정할 카테고리를 찾지 못했습니다.
          </Alert>
        ) : (
          <CategoryManagementForm
            mode={categoryEditorState?.mode ?? 'create'}
            initialCategory={editingCategory}
            busy={saveCategoryMutation.isPending}
            onSubmit={async (input) => {
              setFeedback(null);
              await saveCategoryMutation.mutateAsync({
                mode: categoryEditorState?.mode ?? 'create',
                categoryId: editingCategory?.id,
                payload:
                  categoryEditorState?.mode === 'edit'
                    ? {
                        name: input.name
                      }
                    : input,
                fallback: {
                  id: editingCategory?.id ?? `category-demo-${Date.now()}`,
                  name: input.name,
                  kind: editingCategory?.kind ?? input.kind,
                  isActive: editingCategory?.isActive ?? true
                }
              });
            }}
          />
        )}
      </FormDrawer>

      <ConfirmActionDialog
        open={fundingAccountStatusActionTarget !== null}
        title={readFundingAccountTransitionTitle(fundingAccountStatusActionTarget)}
        description={readFundingAccountTransitionDescription(
          fundingAccountStatusActionTarget
        )}
        confirmLabel={readFundingAccountTransitionConfirmLabel(
          fundingAccountStatusActionTarget
        )}
        pendingLabel={
          transitionFundingAccountMutation.isPending ? '저장 중...' : undefined
        }
        confirmColor={readFundingAccountTransitionConfirmColor(
          fundingAccountStatusActionTarget
        )}
        busy={transitionFundingAccountMutation.isPending}
        onClose={() => setFundingAccountStatusActionTarget(null)}
        onConfirm={() => {
          if (!fundingAccountStatusActionTarget) {
            return;
          }

          void transitionFundingAccountMutation.mutateAsync(
            fundingAccountStatusActionTarget
          );
        }}
      />

      <ConfirmActionDialog
        open={toggleTarget !== null}
        title={toggleTarget?.isActive ? '카테고리 비활성화' : '카테고리 재활성화'}
        description={
          toggleTarget
            ? toggleTarget.isActive
              ? `"${toggleTarget.name}" 카테고리를 비활성화할까요? 기존 거래 기록은 유지되지만 새 입력 화면의 기본 선택지에서는 빠집니다.`
              : `"${toggleTarget.name}" 카테고리를 다시 활성화할까요? 이후 입력 화면의 공식 선택지에 다시 포함됩니다.`
            : ''
        }
        confirmLabel={toggleTarget?.isActive ? '비활성화' : '재활성화'}
        pendingLabel={
          toggleCategoryMutation.isPending ? '저장 중...' : undefined
        }
        confirmColor={toggleTarget?.isActive ? 'warning' : 'primary'}
        busy={toggleCategoryMutation.isPending}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => {
          if (!toggleTarget) {
            return;
          }

          void toggleCategoryMutation.mutateAsync(toggleTarget);
        }}
      />
    </Stack>
  );
}

async function invalidateReferenceDataQueries(
  queryClient: QueryClient
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: fundingAccountsQueryKey }),
    queryClient.invalidateQueries({
      queryKey: fundingAccountsManagementQueryKey
    }),
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: categoriesManagementQueryKey }),
    queryClient.invalidateQueries({ queryKey: referenceDataReadinessQueryKey })
  ]);
}

function readFundingAccountTypeLabel(type: string) {
  switch (type) {
    case 'BANK':
      return '통장';
    case 'CASH':
      return '현금';
    case 'CARD':
      return '카드';
    default:
      return type;
  }
}

function readFundingAccountStatusLabel(status: FundingAccountItem['status']) {
  switch (status) {
    case 'ACTIVE':
      return '활성';
    case 'INACTIVE':
      return '비활성';
    case 'CLOSED':
      return '종료';
    default:
      return status;
  }
}

function readFundingAccountStatusColor(status: FundingAccountItem['status']) {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'CLOSED':
      return 'error';
    case 'INACTIVE':
    default:
      return 'default';
  }
}

function readFundingAccountTransitionTitle(
  target: FundingAccountStatusActionTarget
) {
  switch (target?.nextStatus) {
    case 'ACTIVE':
      return '자금수단 재활성화';
    case 'INACTIVE':
      return '자금수단 비활성화';
    case 'CLOSED':
      return '자금수단 종료';
    default:
      return '';
  }
}

function readFundingAccountTransitionDescription(
  target: FundingAccountStatusActionTarget
) {
  if (!target) {
    return '';
  }

  switch (target.nextStatus) {
    case 'ACTIVE':
      return `"${target.fundingAccount.name}" 자금수단을 다시 활성화할까요? 이후 입력 화면의 공식 선택지에 다시 포함됩니다.`;
    case 'INACTIVE':
      return `"${target.fundingAccount.name}" 자금수단을 비활성화할까요? 기존 거래와 반복 규칙 기록은 유지되지만 새 입력 화면의 기본 선택지에서는 빠집니다.`;
    case 'CLOSED':
      return `"${target.fundingAccount.name}" 자금수단을 종료할까요? 종료 후에는 읽기 전용으로 유지되고, 현재 범위에서는 다시 활성화할 수 없습니다. 기존 거래와 반복 규칙 기록은 그대로 보존됩니다.`;
    default:
      return '';
  }
}

function readFundingAccountTransitionConfirmLabel(
  target: FundingAccountStatusActionTarget
) {
  switch (target?.nextStatus) {
    case 'ACTIVE':
      return '재활성화';
    case 'INACTIVE':
      return '비활성화';
    case 'CLOSED':
      return '종료';
    default:
      return '저장';
  }
}

function readFundingAccountTransitionConfirmColor(
  target: FundingAccountStatusActionTarget
) {
  switch (target?.nextStatus) {
    case 'ACTIVE':
      return 'primary';
    case 'INACTIVE':
      return 'warning';
    case 'CLOSED':
      return 'error';
    default:
      return 'primary';
  }
}

function readFundingAccountTransitionSuccessMessage(
  fundingAccountName: string,
  nextStatus: FundingAccountItem['status']
) {
  switch (nextStatus) {
    case 'ACTIVE':
      return `${fundingAccountName} 자금수단을 다시 활성화했습니다.`;
    case 'INACTIVE':
      return `${fundingAccountName} 자금수단을 비활성화했습니다.`;
    case 'CLOSED':
      return `${fundingAccountName} 자금수단을 종료했습니다.`;
    default:
      return `${fundingAccountName} 자금수단 상태를 변경했습니다.`;
  }
}

function readCategoryKindLabel(kind: string) {
  switch (kind) {
    case 'INCOME':
      return '수입';
    case 'EXPENSE':
      return '지출';
    case 'TRANSFER':
      return '이체';
    default:
      return kind;
  }
}
