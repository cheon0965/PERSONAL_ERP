import type {
  AccountSubjectItem,
  CategoryItem,
  CreateCategoryRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  LedgerTransactionTypeItem,
  ReferenceDataReadinessCheckItem,
  ReferenceDataReadinessSummary,
  TenantMembershipRole,
  UpdateCategoryRequest,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import { fetchJson, patchJson, postJson } from '@/shared/api/fetch-json';

export const fundingAccountsQueryKey = [
  'reference-data',
  'funding-accounts'
] as const;
export const fundingAccountsManagementQueryKey = [
  'reference-data',
  'funding-accounts',
  'include-inactive'
] as const;
export const categoriesQueryKey = ['reference-data', 'categories'] as const;
export const categoriesManagementQueryKey = [
  'reference-data',
  'categories',
  'include-inactive'
] as const;
export const accountSubjectsQueryKey = [
  'reference-data',
  'account-subjects'
] as const;
export const ledgerTransactionTypesQueryKey = [
  'reference-data',
  'ledger-transaction-types'
] as const;
export const referenceDataReadinessQueryKey = [
  'reference-data',
  'readiness'
] as const;

export const mockFundingAccounts: FundingAccountItem[] = [
  {
    id: 'acc-1',
    name: '사업 운영 통장',
    type: 'BANK',
    balanceWon: 2_450_000,
    status: 'ACTIVE'
  },
  {
    id: 'acc-2',
    name: '비용 예비 통장',
    type: 'BANK',
    balanceWon: 430_000,
    status: 'ACTIVE'
  },
  {
    id: 'acc-3',
    name: '사업용 카드',
    type: 'CARD',
    balanceWon: 300_000,
    status: 'ACTIVE'
  },
  {
    id: 'acc-4',
    name: '이전 운영 현금 계정',
    type: 'CASH',
    balanceWon: 0,
    status: 'INACTIVE'
  },
  {
    id: 'acc-5',
    name: '종료된 정산 카드',
    type: 'CARD',
    balanceWon: 0,
    status: 'CLOSED'
  }
];

export const mockCategories: CategoryItem[] = [
  { id: 'cat-1', name: '매출 입금', kind: 'INCOME', isActive: true },
  { id: 'cat-2', name: '원재료비', kind: 'EXPENSE', isActive: true },
  { id: 'cat-3', name: '사업 보험료', kind: 'EXPENSE', isActive: true },
  { id: 'cat-4', name: '배송 차량 유지비', kind: 'EXPENSE', isActive: true },
  { id: 'cat-5', name: '통신·POS 비용', kind: 'EXPENSE', isActive: true },
  { id: 'cat-6', name: '과거 판촉비', kind: 'EXPENSE', isActive: false }
];

export const mockAccountSubjects: AccountSubjectItem[] = [
  {
    id: 'as-1010',
    code: '1010',
    name: '현금및예금',
    statementType: 'BALANCE_SHEET',
    normalSide: 'DEBIT',
    subjectKind: 'ASSET',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-2100',
    code: '2100',
    name: '카드미지급금',
    statementType: 'BALANCE_SHEET',
    normalSide: 'CREDIT',
    subjectKind: 'LIABILITY',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-3100',
    code: '3100',
    name: '순자산',
    statementType: 'BALANCE_SHEET',
    normalSide: 'CREDIT',
    subjectKind: 'EQUITY',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-4100',
    code: '4100',
    name: '운영수익',
    statementType: 'PROFIT_AND_LOSS',
    normalSide: 'CREDIT',
    subjectKind: 'INCOME',
    isSystem: true,
    isActive: true
  },
  {
    id: 'as-5100',
    code: '5100',
    name: '운영비용',
    statementType: 'PROFIT_AND_LOSS',
    normalSide: 'DEBIT',
    subjectKind: 'EXPENSE',
    isSystem: true,
    isActive: true
  }
];

export const mockLedgerTransactionTypes: LedgerTransactionTypeItem[] = [
  {
    id: 'ltt-income-basic',
    code: 'INCOME_BASIC',
    name: '기본 수입',
    flowKind: 'INCOME',
    postingPolicyKey: 'INCOME_BASIC',
    isActive: true
  },
  {
    id: 'ltt-expense-basic',
    code: 'EXPENSE_BASIC',
    name: '기본 지출',
    flowKind: 'EXPENSE',
    postingPolicyKey: 'EXPENSE_BASIC',
    isActive: true
  },
  {
    id: 'ltt-transfer-basic',
    code: 'TRANSFER_BASIC',
    name: '기본 이체',
    flowKind: 'TRANSFER',
    postingPolicyKey: 'TRANSFER_BASIC',
    isActive: true
  }
];

export const mockReferenceDataReadiness = buildMockReferenceDataReadiness({
  currentRole: 'OWNER',
  fundingAccounts: mockFundingAccounts,
  categories: mockCategories,
  accountSubjects: mockAccountSubjects,
  ledgerTransactionTypes: mockLedgerTransactionTypes
});

export function getFundingAccounts(input?: { includeInactive?: boolean }) {
  const includeInactive = input?.includeInactive ?? false;

  return fetchJson<FundingAccountItem[]>(
    includeInactive
      ? '/funding-accounts?includeInactive=true'
      : '/funding-accounts',
    includeInactive
      ? mockFundingAccounts
      : mockFundingAccounts.filter(
          (fundingAccount) => fundingAccount.status === 'ACTIVE'
        )
  );
}

export function createFundingAccount(
  input: CreateFundingAccountRequest,
  fallback: FundingAccountItem
) {
  return postJson<FundingAccountItem, CreateFundingAccountRequest>(
    '/funding-accounts',
    input,
    fallback
  );
}

export function updateFundingAccount(
  fundingAccountId: string,
  input: UpdateFundingAccountRequest,
  fallback: FundingAccountItem
) {
  return patchJson<FundingAccountItem, UpdateFundingAccountRequest>(
    `/funding-accounts/${fundingAccountId}`,
    input,
    fallback
  );
}

export function getCategories(input?: { includeInactive?: boolean }) {
  const includeInactive = input?.includeInactive ?? false;

  return fetchJson<CategoryItem[]>(
    includeInactive ? '/categories?includeInactive=true' : '/categories',
    includeInactive
      ? mockCategories
      : mockCategories.filter((category) => category.isActive)
  );
}

export function createCategory(
  input: CreateCategoryRequest,
  fallback: CategoryItem
) {
  return postJson<CategoryItem, CreateCategoryRequest>(
    '/categories',
    input,
    fallback
  );
}

export function updateCategory(
  categoryId: string,
  input: UpdateCategoryRequest,
  fallback: CategoryItem
) {
  return patchJson<CategoryItem, UpdateCategoryRequest>(
    `/categories/${categoryId}`,
    input,
    fallback
  );
}

export function getAccountSubjects() {
  return fetchJson<AccountSubjectItem[]>(
    '/account-subjects',
    mockAccountSubjects
  );
}

export function getLedgerTransactionTypes() {
  return fetchJson<LedgerTransactionTypeItem[]>(
    '/ledger-transaction-types',
    mockLedgerTransactionTypes
  );
}

export function getReferenceDataReadiness() {
  return fetchJson<ReferenceDataReadinessSummary>(
    '/reference-data/readiness',
    mockReferenceDataReadiness
  );
}

function buildMockReferenceDataReadiness(input: {
  currentRole: TenantMembershipRole;
  fundingAccounts: FundingAccountItem[];
  categories: CategoryItem[];
  accountSubjects: AccountSubjectItem[];
  ledgerTransactionTypes: LedgerTransactionTypeItem[];
}): ReferenceDataReadinessSummary {
  const activeFundingAccountCount = input.fundingAccounts.filter(
    (fundingAccount) => fundingAccount.status === 'ACTIVE'
  ).length;
  const incomeCategoryCount = input.categories.filter(
    (category) => category.kind === 'INCOME' && category.isActive
  ).length;
  const expenseCategoryCount = input.categories.filter(
    (category) => category.kind === 'EXPENSE' && category.isActive
  ).length;
  const checks: ReferenceDataReadinessCheckItem[] = [
    buildMockUserManagedCheck({
      key: 'funding-accounts',
      label: '자금수단',
      count: activeFundingAccountCount,
      description:
        '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
      operatingImpact:
        '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
      currentRole: input.currentRole,
      inProductEditEnabled: true
    }),
    buildMockUserManagedCheck({
      key: 'income-categories',
      label: '수입 카테고리',
      count: incomeCategoryCount,
      description:
        '수입 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
      operatingImpact:
        '없으면 수입 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
      currentRole: input.currentRole,
      inProductEditEnabled: true
    }),
    buildMockUserManagedCheck({
      key: 'expense-categories',
      label: '지출 카테고리',
      count: expenseCategoryCount,
      description:
        '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
      operatingImpact:
        '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
      currentRole: input.currentRole,
      inProductEditEnabled: true
    }),
    buildMockSystemManagedCheck({
      key: 'account-subjects',
      label: '계정과목',
      count: input.accountSubjects.length,
      description:
        '전표 라인, 월 마감, 재무제표 계산에 공통으로 쓰이는 공식 계정과목 목록입니다.',
      operatingImpact:
        '없으면 전표 확정과 마감 계산이 일관되게 이어질 수 없습니다.'
    }),
    buildMockSystemManagedCheck({
      key: 'ledger-transaction-types',
      label: '거래유형',
      count: input.ledgerTransactionTypes.length,
      description:
        '계획 항목과 수집 거래를 내부 전표 정책에 연결하는 공식 거래유형 목록입니다.',
      operatingImpact:
        '없으면 계획/수집 거래를 전표 정책에 안정적으로 연결할 수 없습니다.'
    })
  ];
  const missingRequirements = checks
    .filter((check) => !check.ready)
    .map((check) => check.label);
  const allChecksReady = missingRequirements.length === 0;

  return {
    status: allChecksReady ? 'READY' : 'ACTION_REQUIRED',
    currentRole: input.currentRole,
    isReadyForMonthlyOperation: allChecksReady,
    isReadyForTransactionEntry: allChecksReady,
    isReadyForImportCollection: allChecksReady,
    isReadyForRecurringRuleSetup: allChecksReady,
    missingRequirements,
    checks
  };
}

function buildMockUserManagedCheck(input: {
  key: ReferenceDataReadinessCheckItem['key'];
  label: string;
  count: number;
  description: string;
  operatingImpact: string;
  currentRole: TenantMembershipRole;
  inProductEditEnabled: boolean;
}): ReferenceDataReadinessCheckItem {
  const currentRoleOwnsPreparation =
    input.currentRole === 'OWNER' || input.currentRole === 'MANAGER';

  return {
    key: input.key,
    label: input.label,
    description: input.description,
    ready: input.count >= 1,
    count: input.count,
    minimumRequiredCount: 1,
    ownershipScope: 'USER_MANAGED',
    responsibleRoles: ['OWNER', 'MANAGER'],
    inProductEditEnabled: input.inProductEditEnabled,
    operatingImpact: input.operatingImpact,
    managementNote: readUserManagedManagementNote({
      currentRoleOwnsPreparation,
      inProductEditEnabled: input.inProductEditEnabled
    })
  };
}

function buildMockSystemManagedCheck(input: {
  key: ReferenceDataReadinessCheckItem['key'];
  label: string;
  count: number;
  description: string;
  operatingImpact: string;
}): ReferenceDataReadinessCheckItem {
  return {
    key: input.key,
    label: input.label,
    description: input.description,
    ready: input.count >= 1,
    count: input.count,
    minimumRequiredCount: 1,
    ownershipScope: 'SYSTEM_MANAGED',
    responsibleRoles: [],
    inProductEditEnabled: false,
    operatingImpact: input.operatingImpact,
    managementNote:
      '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
  };
}

function readUserManagedManagementNote(input: {
  currentRoleOwnsPreparation: boolean;
  inProductEditEnabled: boolean;
}) {
  if (input.inProductEditEnabled) {
    return input.currentRoleOwnsPreparation
      ? '사용자 관리 데이터이며, 현재 제품에서는 직접 생성/이름 수정/활성 상태 관리를 지원합니다.'
      : '사용자 관리 데이터이며, 소유자 또는 관리자가 앱 안에서 직접 생성/이름 수정/활성 상태 관리를 수행할 수 있습니다.';
  }

  return input.currentRoleOwnsPreparation
    ? '사용자 관리 데이터이지만, 현재 제품에서는 직접 생성/수정 UI를 아직 제공하지 않습니다. 준비 상태를 확인하고 운영 준비 절차에 따라 추가/정비 범위를 진행해야 합니다.'
    : '사용자 관리 데이터이며, 소유자 또는 관리자가 준비 상태를 책임집니다. 현재 제품에서는 직접 생성/수정 UI를 아직 제공하지 않습니다.';
}
