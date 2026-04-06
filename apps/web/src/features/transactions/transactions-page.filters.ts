'use client';

import type {
  AccountingPeriodItem,
  CollectedTransactionItem
} from '@personal-erp/contracts';
import { isBusinessDateWithinPeriod } from './transactions-page.shared';

export function buildFundingAccountOptions(data: CollectedTransactionItem[]) {
  return Array.from(new Set(data.map((item) => item.fundingAccountName)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function buildCategoryOptions(data: CollectedTransactionItem[]) {
  return Array.from(new Set(data.map((item) => item.categoryName)))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function filterTransactions(input: {
  data: CollectedTransactionItem[];
  currentPeriod: AccountingPeriodItem | null;
  keyword: string;
  fundingAccountName: string;
  categoryName: string;
  postingStatus: string;
}) {
  const normalizedKeyword = input.keyword.trim().toLowerCase();

  return input.data.filter((item) => {
    const matchesCurrentPeriod =
      !input.currentPeriod ||
      isBusinessDateWithinPeriod(item.businessDate, input.currentPeriod);
    const matchesKeyword =
      normalizedKeyword.length === 0 ||
      [item.title, item.categoryName, item.fundingAccountName]
        .join(' ')
        .toLowerCase()
        .includes(normalizedKeyword);
    const matchesFundingAccount =
      input.fundingAccountName.length === 0 ||
      item.fundingAccountName === input.fundingAccountName;
    const matchesCategory =
      input.categoryName.length === 0 ||
      item.categoryName === input.categoryName;
    const matchesPostingStatus =
      input.postingStatus.length === 0 ||
      item.postingStatus === input.postingStatus;

    return (
      matchesCurrentPeriod &&
      matchesKeyword &&
      matchesFundingAccount &&
      matchesCategory &&
      matchesPostingStatus
    );
  });
}

export function prioritizeVisibleTransactions(input: {
  filteredTransactions: CollectedTransactionItem[];
  highlightedTransactionId: string | null;
  highlightedPlanItemId: string | null;
}) {
  if (input.highlightedTransactionId) {
    const highlighted = input.filteredTransactions.find(
      (item) => item.id === input.highlightedTransactionId
    );

    if (highlighted) {
      return [
        highlighted,
        ...input.filteredTransactions.filter(
          (item) => item.id !== highlighted.id
        )
      ];
    }
  }

  if (input.highlightedPlanItemId) {
    const linked = input.filteredTransactions.filter(
      (item) => item.matchedPlanItemId === input.highlightedPlanItemId
    );

    if (linked.length > 0) {
      return [
        ...linked,
        ...input.filteredTransactions.filter(
          (item) => item.matchedPlanItemId !== input.highlightedPlanItemId
        )
      ];
    }
  }

  return input.filteredTransactions;
}
