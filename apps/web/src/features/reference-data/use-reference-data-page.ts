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
import { membershipRoleLabelMap } from '@/shared/auth/auth-labels';
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

type ReferenceDataManagementSection =
  | 'funding-accounts'
  | 'categories'
  | 'lookups';

export function useReferenceDataPage(
  section: ReferenceDataManagementSection = 'funding-accounts'
) {
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
  const workspaceLabel = currentWorkspace
    ? `${currentWorkspace.tenant.name} (${currentWorkspace.tenant.slug})`
    : '-';
  const ledgerLabel = currentWorkspace?.ledger?.name ?? '-';
  const membershipRoleLabel = membershipRole
    ? (membershipRoleLabelMap[membershipRole] ?? membershipRole)
    : '-';
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

  useDomainHelp(
    buildReferenceDataHelpContext(section, {
      ledgerLabel,
      membershipRoleLabel,
      workspaceLabel
    })
  );

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
    ledgerLabel,
    toggleCategoryPending: toggleCategoryMutation.isPending,
    transitionFundingAccountPending: transitionFundingAccountMutation.isPending,
    membershipRole,
    workspaceLabel
  };
}

function buildReferenceDataHelpContext(
  section: ReferenceDataManagementSection,
  input: {
    ledgerLabel: string;
    membershipRoleLabel: string;
    workspaceLabel: string;
  }
) {
  const currentHref =
    section === 'funding-accounts'
      ? '/reference-data/funding-accounts'
      : section === 'categories'
        ? '/reference-data/categories'
        : '/reference-data/lookups';
  const currentContextSection = {
    title: '현재 이용 기준',
    description:
      '기준 데이터는 로그인한 사용자의 현재 사업장과 장부 안에서만 조회됩니다.',
    facts: [
      {
        label: '사업장',
        value: input.workspaceLabel
      },
      {
        label: '장부',
        value: input.ledgerLabel
      },
      {
        label: '권한',
        value: input.membershipRoleLabel
      }
    ]
  };
  const navigationSection = {
    title: '이어지는 화면',
    links: [
      {
        title: '자금수단',
        description: '실제 입출금 기준이 되는 통장, 카드, 현금 계정을 관리합니다.',
        href: '/reference-data/funding-accounts',
        actionLabel: '자금수단 보기'
      },
      {
        title: '카테고리',
        description: '수입·지출 분류 이름과 활성 상태를 관리합니다.',
        href: '/reference-data/categories',
        actionLabel: '카테고리 보기'
      },
      {
        title: '공식 참조값',
        description: '계정과목과 거래유형 같은 시스템 제공 기준값을 확인합니다.',
        href: '/reference-data/lookups',
        actionLabel: '공식 참조값 보기'
      }
    ].filter((link) => link.href !== currentHref)
  };

  switch (section) {
    case 'categories':
      return {
        title: '카테고리 도움말',
        description:
          '이 탭은 수입·지출 분류 이름과 활성 상태를 관리하는 화면입니다. 거래 입력과 반복 규칙에서 쓰는 분류 기준을 여기서 정리합니다.',
        primaryEntity: '카테고리',
        relatedEntities: ['수집 거래', '반복 규칙', '계획 항목', '전표'],
        truthSource:
          '현재 사업장과 장부에서 활성 상태인 카테고리만 입력 화면의 선택지로 사용합니다.',
        supplementarySections: [
          currentContextSection,
          {
            title: '이 탭에서 하는 일',
            items: [
              '수입·지출 카테고리를 추가하거나 이름을 정리합니다.',
              '더 이상 새 입력에 쓰지 않을 분류는 비활성 처리해 선택지에서 숨깁니다.',
              '기존 거래 추적을 위해 비활성 카테고리도 목록에서는 계속 관리합니다.'
            ]
          },
          navigationSection
        ],
        readModelNote:
          '카테고리는 거래 분류 기준입니다. 금액이나 잔액을 여기서 직접 조정하지는 않습니다.'
      };
    case 'lookups':
      return {
        title: '공식 참조값 도움말',
        description:
          '이 탭은 계정과목과 거래유형처럼 시스템이 제공하는 공식 기준값을 확인하는 읽기 전용 화면입니다.',
        primaryEntity: '공식 참조값',
        relatedEntities: ['계정과목', '거래유형', '전표', '자동 분류'],
        truthSource:
          '계정과목과 거래유형은 시스템 기준값을 따르며, 입력 화면과 자동 생성 전표가 이 값을 참조합니다.',
        supplementarySections: [
          currentContextSection,
          {
            title: '이 탭에서 하는 일',
            items: [
              '전표 자동 생성이나 거래 입력에 필요한 공식 기준값이 준비되어 있는지 확인합니다.',
              '직접 편집하지 않고, 어떤 기준이 실제 화면에서 참조되는지 읽는 용도로 사용합니다.',
              '선택지가 부족하다면 자금수단 또는 카테고리 탭을 먼저 점검합니다.'
            ]
          },
          navigationSection
        ],
        readModelNote:
          '공식 참조값은 시스템 관리 영역에 가깝습니다. 이 탭은 확인용이며 직접 수정하는 화면이 아닙니다.'
      };
    case 'funding-accounts':
    default:
      return {
        title: '자금수단 도움말',
        description:
          '이 탭은 실제 입출금 기준이 되는 통장, 카드, 현금 계정을 관리하는 화면입니다. 거래 입력과 업로드 등록에서 쓰는 자금수단 기준을 여기서 정리합니다.',
        primaryEntity: '자금수단',
        relatedEntities: ['수집 거래', '업로드 배치', '전표', '차기 이월'],
        truthSource:
          '현재 사업장과 장부에서 활성 상태인 자금수단만 입력 화면의 선택지로 사용합니다.',
        supplementarySections: [
          currentContextSection,
          {
            title: '이 탭에서 하는 일',
            items: [
              '운영 통장, 카드, 현금 같은 실제 입출금 기준을 추가하거나 이름을 정리합니다.',
              '더 이상 쓰지 않는 자금수단은 비활성 또는 종료 상태로 바꿔 새 입력 선택지에서 분리합니다.',
              '기존 거래와 이월 추적을 위해 종료된 자금수단도 읽기 전용 기준으로 남길 수 있습니다.'
            ]
          },
          navigationSection
        ],
        readModelNote:
          '자금수단은 잔액 결과를 보여줄 수 있어도, 이 화면에서 잔액 자체를 직접 수정하지는 않습니다. 잔액 변화는 거래·전표·마감 흐름에서 만들어집니다.'
      };
  }
}
