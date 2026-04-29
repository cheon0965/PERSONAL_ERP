'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { CategoryItem, FundingAccountItem } from '@personal-erp/contracts';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import {
  categoriesManagementQueryKey,
  categoriesQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  referenceDataReadinessQueryKey
} from './reference-data.api';

export type FeedbackState = FeedbackAlertValue;

export type CategoryEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; categoryId: string }
  | null;

export type FundingAccountEditorState =
  | { mode: 'create' }
  | { mode: 'edit'; fundingAccountId: string }
  | null;

export type FundingAccountStatusActionTarget = {
  fundingAccount: FundingAccountItem;
  nextStatus: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
} | null;

export type FundingAccountBootstrapTarget = FundingAccountItem | null;

export type FundingAccountDeleteTarget = FundingAccountItem | null;

export async function invalidateReferenceDataQueries(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: fundingAccountsQueryKey }),
    queryClient.invalidateQueries({
      queryKey: fundingAccountsManagementQueryKey
    }),
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
    queryClient.invalidateQueries({
      queryKey: categoriesManagementQueryKey
    }),
    queryClient.invalidateQueries({
      queryKey: referenceDataReadinessQueryKey
    })
  ]);
}

export function readFundingAccountTypeLabel(type: string) {
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

export function readFundingAccountStatusLabel(
  status: FundingAccountItem['status']
) {
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

export function readFundingAccountStatusColor(
  status: FundingAccountItem['status']
) {
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

export function readFundingAccountBootstrapStatusLabel(
  status: FundingAccountItem['bootstrapStatus']
) {
  switch (status) {
    case 'PENDING':
      return '기초 업로드 대기';
    case 'COMPLETED':
      return '기초 업로드 완료';
    case 'NOT_REQUIRED':
      return '대상 아님';
    default:
      return status;
  }
}

export function readFundingAccountBootstrapStatusColor(
  status: FundingAccountItem['bootstrapStatus']
) {
  switch (status) {
    case 'PENDING':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'NOT_REQUIRED':
    default:
      return 'default';
  }
}

export function readFundingAccountTransitionTitle(
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

export function readFundingAccountTransitionDescription(
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

export function readFundingAccountTransitionConfirmLabel(
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

export function readFundingAccountTransitionConfirmColor(
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

export function readFundingAccountTransitionSuccessMessage(
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

export function readFundingAccountDeleteDescription(
  target: FundingAccountDeleteTarget
) {
  if (!target) {
    return '';
  }

  return `"${target.name}" 자금수단을 삭제할까요? 수집 거래, 전표, 계획, 반복 규칙, 보험, 업로드, 이월, 차량 기본값에서 사용한 기록이 있으면 삭제되지 않습니다. 먼저 연결된 거래내역과 관련 설정을 정리해 주세요.`;
}

export function readFundingAccountBootstrapSuccessMessage(
  fundingAccountName: string,
  initialBalanceWon?: number | null
) {
  const amount = initialBalanceWon ?? 0;

  if (amount > 0) {
    return `${fundingAccountName} 자금수단의 기초금액을 등록하고 기초전표를 발행했습니다.`;
  }

  return `${fundingAccountName} 자금수단의 기초 업로드 대기를 완료했습니다.`;
}

export function readCategoryKindLabel(kind: string) {
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

export function readCategoryToggleTitle(category: CategoryItem | null) {
  return category?.isActive ? '카테고리 비활성화' : '카테고리 재활성화';
}

export function readCategoryToggleDescription(category: CategoryItem | null) {
  if (!category) {
    return '';
  }

  return category.isActive
    ? `"${category.name}" 카테고리를 비활성화할까요? 기존 거래 기록은 유지되지만 새 입력 화면의 기본 선택지에서는 빠집니다.`
    : `"${category.name}" 카테고리를 다시 활성화할까요? 이후 입력 화면의 공식 선택지에 다시 포함됩니다.`;
}

export function readCategoryToggleConfirmLabel(category: CategoryItem | null) {
  return category?.isActive ? '비활성화' : '재활성화';
}

export function readCategoryToggleSuccessMessage(saved: CategoryItem) {
  return saved.isActive
    ? `${saved.name} 카테고리를 다시 활성화했습니다.`
    : `${saved.name} 카테고리를 비활성화했습니다.`;
}
