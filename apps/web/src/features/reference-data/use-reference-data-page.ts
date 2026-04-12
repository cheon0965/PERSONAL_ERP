'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CategoryItem,
  CreateCategoryRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import { useAuthSession } from '@/shared/auth/auth-provider';
import { useDomainHelp } from '@/shared/lib/use-domain-help';
import {
  accountSubjectsQueryKey,
  categoriesManagementQueryKey,
  createCategory,
  createFundingAccount,
  fundingAccountsManagementQueryKey,
  getAccountSubjects,
  getCategories,
  getFundingAccounts,
  getLedgerTransactionTypes,
  ledgerTransactionTypesQueryKey,
  updateCategory,
  updateFundingAccount
} from './reference-data.api';
import type { CategoryManagementSubmitInput } from './category-management-form';
import type { FundingAccountManagementSubmitInput } from './funding-account-management-form';
import {
  invalidateReferenceDataQueries,
  readCategoryToggleSuccessMessage,
  readFundingAccountTransitionSuccessMessage,
  type CategoryEditorState,
  type FeedbackState,
  type FundingAccountEditorState,
  type FundingAccountStatusActionTarget
} from './reference-data.shared';

export function useReferenceDataPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthSession();
  const [feedback, setFeedback] = React.useState<FeedbackState>(null);
  const [fundingAccountEditorState, setFundingAccountEditorState] =
    React.useState<FundingAccountEditorState>(null);
  const [categoryEditorState, setCategoryEditorState] =
    React.useState<CategoryEditorState>(null);
  const [
    fundingAccountStatusActionTarget,
    setFundingAccountStatusActionTarget
  ] = React.useState<FundingAccountStatusActionTarget>(null);
  const [categoryToggleTarget, setCategoryToggleTarget] =
    React.useState<CategoryItem | null>(null);

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
      ? (managedFundingAccounts.find(
          (fundingAccount) =>
            fundingAccount.id === fundingAccountEditorState.fundingAccountId
        ) ?? null)
      : null;
  const editingCategory =
    categoryEditorState?.mode === 'edit'
      ? (managedCategories.find(
          (category) => category.id === categoryEditorState.categoryId
        ) ?? null)
      : null;
  const queryErrors = [
    fundingAccountsManagementQuery.error,
    categoriesManagementQuery.error,
    accountSubjectsQuery.error,
    ledgerTransactionTypesQuery.error
  ].filter(Boolean);

  useDomainHelp({
    title: '기준 데이터 관리 사용 가이드',
    description:
      '이 화면은 입력 화면들이 공통으로 사용하는 자금수단, 카테고리, 계정과목, 거래유형을 확인하고 제한된 범위에서 관리하는 곳입니다. 거래 입력이 막히면 여기서 선택지가 준비됐는지 확인합니다.',
    primaryEntity: '기준 데이터',
    relatedEntities: ['입출금 계정', '거래 분류', '계정과목', '거래 유형'],
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
        title: '바로 쓰는 순서',
        description:
          '월 운영을 시작하기 전에 최소한 사용할 자금수단과 수입/지출 카테고리를 준비합니다.',
        items: [
          '자금수단 영역에서 운영 통장, 카드 같은 실제 입출금 기준을 추가하거나 이름을 정리합니다.',
          '카테고리 영역에서 수입/지출 분류를 추가하거나 비활성 상태를 정리합니다.',
          '계정과목과 거래유형 영역은 직접 편집하지 않고, 전표 자동 생성에 필요한 system-managed 기준이 있는지 확인합니다.',
          '준비가 끝나면 월 운영 화면으로 이동해 운영 기간을 엽니다.'
        ]
      },
      {
        title: '관리 원칙',
        description:
          '화면별 입력 폼은 여기서 조회되는 활성 기준 데이터만 선택지로 사용하며, 직접 편집 가능한 범위도 제한적으로 유지합니다.',
        items: [
          '수집 거래와 반복 규칙 폼은 임의 텍스트가 아니라 기준 데이터의 식별자와 정책 키를 참조합니다.',
          '비활성 카테고리와 자금수단은 새 입력 선택지에서 빠질 수 있지만, 기존 기록 추적을 위해 목록에서는 관리합니다.',
          '자금수단 종료는 비활성 자금수단에서만 가능하며, 종료 후에는 기존 기록 보존용 읽기 전용 기준으로 남습니다.'
        ]
      }
    ],
    readModelNote:
      '금액 잔액을 여기서 직접 고치는 화면은 아닙니다. 잔액 변화는 수집 거래, 전표, 마감, 차기 이월 흐름에서 만들어집니다.'
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
    mutationFn: (input: Exclude<FundingAccountStatusActionTarget, null>) =>
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
    onSuccess: async (saved) => {
      setCategoryToggleTarget(null);
      setFeedback({
        severity: 'success',
        message: readCategoryToggleSuccessMessage(saved)
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

  function openFundingAccountCreate() {
    setFeedback(null);
    setFundingAccountEditorState({ mode: 'create' });
  }

  function openFundingAccountEdit(fundingAccount: FundingAccountItem) {
    setFeedback(null);
    setFundingAccountEditorState({
      mode: 'edit',
      fundingAccountId: fundingAccount.id
    });
  }

  function openFundingAccountTransition(
    fundingAccount: FundingAccountItem,
    nextStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  ) {
    setFeedback(null);
    setFundingAccountStatusActionTarget({
      fundingAccount,
      nextStatus
    });
  }

  function openCategoryCreate() {
    setFeedback(null);
    setCategoryEditorState({ mode: 'create' });
  }

  function openCategoryEdit(category: CategoryItem) {
    setFeedback(null);
    setCategoryEditorState({
      mode: 'edit',
      categoryId: category.id
    });
  }

  function openCategoryToggle(category: CategoryItem) {
    setFeedback(null);
    setCategoryToggleTarget(category);
  }

  async function submitFundingAccount(
    input: FundingAccountManagementSubmitInput
  ) {
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
        id: editingFundingAccount?.id ?? `funding-account-demo-${Date.now()}`,
        name: input.name,
        type: editingFundingAccount?.type ?? input.type,
        balanceWon: editingFundingAccount?.balanceWon ?? 0,
        status: editingFundingAccount?.status ?? 'ACTIVE'
      }
    });
  }

  async function submitCategory(input: CategoryManagementSubmitInput) {
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
  }

  async function confirmFundingAccountTransition() {
    if (!fundingAccountStatusActionTarget) {
      return;
    }

    await transitionFundingAccountMutation.mutateAsync(
      fundingAccountStatusActionTarget
    );
  }

  async function confirmCategoryToggle() {
    if (!categoryToggleTarget) {
      return;
    }

    await toggleCategoryMutation.mutateAsync(categoryToggleTarget);
  }

  return {
    accountSubjects: accountSubjectsQuery.data ?? [],
    canManageReferenceData,
    categories: managedCategories,
    categoryEditorState,
    categoryToggleTarget,
    closeCategoryEditor: () => setCategoryEditorState(null),
    closeCategoryToggle: () => setCategoryToggleTarget(null),
    closeFundingAccountEditor: () => setFundingAccountEditorState(null),
    closeFundingAccountStatusDialog: () =>
      setFundingAccountStatusActionTarget(null),
    confirmCategoryToggle,
    confirmFundingAccountTransition,
    editingCategory,
    editingFundingAccount,
    feedback,
    fundingAccountEditorState,
    fundingAccountStatusActionTarget,
    fundingAccounts: managedFundingAccounts,
    ledgerTransactionTypes: ledgerTransactionTypesQuery.data ?? [],
    openCategoryCreate,
    openCategoryEdit,
    openCategoryToggle,
    openFundingAccountCreate,
    openFundingAccountEdit,
    openFundingAccountTransition,
    queryErrors,
    saveCategoryPending: saveCategoryMutation.isPending,
    saveFundingAccountPending: saveFundingAccountMutation.isPending,
    submitCategory,
    submitFundingAccount,
    toggleCategoryPending: toggleCategoryMutation.isPending,
    transitionFundingAccountPending: transitionFundingAccountMutation.isPending
  };
}
