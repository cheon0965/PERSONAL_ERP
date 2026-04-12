import type {
  AccountSubjectItem,
  AuthenticatedUser,
  CategoryItem,
  CreateInsurancePolicyRequest,
  CreateRecurringRuleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  CreateVehicleRequest,
  FundingAccountItem,
  InsurancePolicyItem,
  LedgerTransactionTypeItem,
  RecurringRuleDetailItem,
  RecurringRuleItem,
  ReferenceDataReadinessSummary,
  UpdateInsurancePolicyRequest,
  UpdateRecurringRuleRequest,
  UpdateVehicleFuelLogRequest,
  UpdateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest,
  VehicleFuelLogItem,
  VehicleItem,
  VehicleMaintenanceLogItem
} from '@personal-erp/contracts';

export type ManagedRecurringRuleItem = RecurringRuleItem & {
  linkedInsurancePolicyId: string | null;
};

export type ManagedRecurringRuleDetailItem = RecurringRuleDetailItem & {
  linkedInsurancePolicyId: string | null;
};
export function createE2ECurrentUser(): AuthenticatedUser {
  return {
    id: 'user-demo',
    email: 'demo@example.com',
    name: 'Demo User',
    currentWorkspace: {
      tenant: {
        id: 'tenant-demo',
        slug: 'demo-tenant',
        name: 'Demo Workspace',
        status: 'ACTIVE'
      },
      membership: {
        id: 'membership-demo',
        role: 'OWNER',
        status: 'ACTIVE'
      },
      ledger: {
        id: 'ledger-demo',
        name: '사업 장부',
        baseCurrency: 'KRW',
        timezone: 'Asia/Seoul',
        status: 'ACTIVE'
      }
    }
  };
}

export function createE2ECurrentUserWithoutWorkspace(): AuthenticatedUser {
  return {
    ...createE2ECurrentUser(),
    currentWorkspace: null
  };
}

export function createE2EFundingAccounts(): FundingAccountItem[] {
  return [
    {
      id: 'acc-main',
      name: '사업 운영 통장',
      type: 'BANK',
      balanceWon: 2_450_000,
      status: 'ACTIVE'
    },
    {
      id: 'acc-reserve',
      name: '비용 예비 통장',
      type: 'BANK',
      balanceWon: 430_000,
      status: 'ACTIVE'
    }
  ];
}

export function createE2ECategories(): CategoryItem[] {
  return [
    {
      id: 'cat-materials',
      name: '원재료비',
      kind: 'EXPENSE',
      isActive: true
    },
    {
      id: 'cat-insurance',
      name: '보험료',
      kind: 'EXPENSE',
      isActive: true
    },
    {
      id: 'cat-sales',
      name: '매출 입금',
      kind: 'INCOME',
      isActive: true
    }
  ];
}

export function createE2EAccountSubjects(): AccountSubjectItem[] {
  return [
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
      id: 'as-4100',
      code: '4100',
      name: '운영수익',
      statementType: 'PROFIT_AND_LOSS',
      normalSide: 'CREDIT',
      subjectKind: 'INCOME',
      isSystem: true,
      isActive: true
    }
  ];
}

export function createE2ELedgerTransactionTypes(): LedgerTransactionTypeItem[] {
  return [
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
    }
  ];
}

export function createE2ERecurringRules(): ManagedRecurringRuleItem[] {
  return [
    {
      id: 'rr-seed-1',
      title: '월세 자동 이체',
      amountWon: 1_200_000,
      frequency: 'MONTHLY',
      nextRunDate: '2026-04-05',
      linkedInsurancePolicyId: null,
      fundingAccountName: '사업 운영 통장',
      categoryName: '원재료비',
      isActive: true
    },
    {
      id: 'rr-insurance-seed-1',
      title: '삼성화재 업무용 차량 보험',
      amountWon: 98_000,
      frequency: 'MONTHLY',
      nextRunDate: '2026-04-25',
      linkedInsurancePolicyId: 'policy-seed-1',
      fundingAccountName: '사업 운영 통장',
      categoryName: '보험료',
      isActive: true
    }
  ];
}

export function createE2EInsurancePolicies(): InsurancePolicyItem[] {
  return [
    {
      id: 'policy-seed-1',
      provider: '삼성화재',
      productName: '업무용 차량 보험',
      monthlyPremiumWon: 98_000,
      paymentDay: 25,
      cycle: 'MONTHLY',
      fundingAccountId: 'acc-main',
      fundingAccountName: '사업 운영 통장',
      categoryId: 'cat-insurance',
      categoryName: '보험료',
      recurringStartDate: '2026-04-25',
      linkedRecurringRuleId: 'rr-insurance-seed-1',
      renewalDate: '2026-11-01',
      maturityDate: null,
      isActive: true
    }
  ];
}

export function createE2EVehicles(): VehicleItem[] {
  return [
    {
      id: 'vehicle-seed-1',
      name: '배송 밴',
      manufacturer: 'Hyundai',
      fuelType: 'DIESEL',
      initialOdometerKm: 58_200,
      estimatedFuelEfficiencyKmPerLiter: 11.2
    }
  ];
}

export function createE2EVehicleFuelLogs(): VehicleFuelLogItem[] {
  return [
    {
      id: 'fuel-seed-1',
      vehicleId: 'vehicle-seed-1',
      vehicleName: '배송 밴',
      filledOn: '2026-03-05',
      odometerKm: 58_480,
      liters: 42.5,
      amountWon: 72_000,
      unitPriceWon: 1694,
      isFullTank: true
    }
  ];
}

export function createE2EVehicleMaintenanceLogs(): VehicleMaintenanceLogItem[] {
  return [
    {
      id: 'maintenance-seed-1',
      vehicleId: 'vehicle-seed-1',
      vehicleName: '배송 밴',
      performedOn: '2026-03-18',
      odometerKm: 58620,
      category: 'REPAIR',
      vendor: '현대 블루핸즈',
      description: '브레이크 패드 교체',
      amountWon: 185000,
      memo: '전륜 패드 기준'
    }
  ];
}

export function buildRecurringRuleItemFromPayload(
  payload: CreateRecurringRuleRequest | UpdateRecurringRuleRequest,
  input: {
    id: string;
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
  }
): ManagedRecurringRuleItem {
  const fundingAccountName =
    input.fundingAccounts.find(
      (fundingAccount) => fundingAccount.id === payload.fundingAccountId
    )?.name ?? '-';
  const categoryName =
    input.categories.find((category) => category.id === payload.categoryId)
      ?.name ?? '-';

  return {
    id: input.id,
    title: payload.title,
    amountWon: payload.amountWon,
    frequency: payload.frequency,
    nextRunDate: payload.startDate,
    linkedInsurancePolicyId: null,
    fundingAccountName,
    categoryName,
    isActive: payload.isActive ?? true
  };
}

export function buildRecurringRuleDetailFromItem(
  recurringRule: ManagedRecurringRuleItem | null,
  input: {
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
  }
): ManagedRecurringRuleDetailItem | null {
  if (!recurringRule) {
    return null;
  }

  const fundingAccountId =
    input.fundingAccounts.find(
      (fundingAccount) =>
        fundingAccount.name === recurringRule.fundingAccountName
    )?.id ?? input.fundingAccounts[0]?.id;
  const categoryId =
    input.categories.find(
      (category) => category.name === recurringRule.categoryName
    )?.id ?? null;

  if (!fundingAccountId) {
    return null;
  }

  const derivedDayOfMonth = recurringRule.nextRunDate
    ? Number(recurringRule.nextRunDate.slice(8, 10))
    : Number.NaN;

  return {
    id: recurringRule.id,
    title: recurringRule.title,
    fundingAccountId,
    categoryId,
    amountWon: recurringRule.amountWon,
    frequency: recurringRule.frequency,
    dayOfMonth: Number.isNaN(derivedDayOfMonth) ? 15 : derivedDayOfMonth,
    startDate: recurringRule.nextRunDate ?? '2026-04-15',
    endDate: null,
    nextRunDate: recurringRule.nextRunDate,
    linkedInsurancePolicyId: recurringRule.linkedInsurancePolicyId,
    isActive: recurringRule.isActive
  };
}

export function mergeRecurringRulesForE2E(
  current: ManagedRecurringRuleItem[],
  nextItem: ManagedRecurringRuleItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      if (left.isActive !== right.isActive) {
        return Number(right.isActive) - Number(left.isActive);
      }

      return (left.nextRunDate ?? '9999-12-31').localeCompare(
        right.nextRunDate ?? '9999-12-31'
      );
    }
  );
}

export function buildInsuranceRecurringRuleItemFromPolicyPayload(
  payload: CreateInsurancePolicyRequest | UpdateInsurancePolicyRequest,
  input: {
    id: string;
    insurancePolicyId: string;
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
  }
): ManagedRecurringRuleItem {
  const fundingAccountName =
    input.fundingAccounts.find(
      (fundingAccount) => fundingAccount.id === payload.fundingAccountId
    )?.name ?? '-';
  const categoryName =
    input.categories.find((category) => category.id === payload.categoryId)
      ?.name ?? '-';

  return {
    id: input.id,
    title: `${payload.provider} ${payload.productName}`,
    amountWon: payload.monthlyPremiumWon,
    frequency: payload.cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY',
    nextRunDate: payload.recurringStartDate,
    linkedInsurancePolicyId: input.insurancePolicyId,
    fundingAccountName,
    categoryName,
    isActive: payload.isActive ?? true
  };
}

export function buildInsurancePolicyItemFromPayload(
  payload: CreateInsurancePolicyRequest | UpdateInsurancePolicyRequest,
  input: {
    id: string;
    fundingAccounts: FundingAccountItem[];
    categories: CategoryItem[];
    linkedRecurringRuleId: string | null;
  }
): InsurancePolicyItem {
  const fundingAccountName =
    input.fundingAccounts.find(
      (fundingAccount) => fundingAccount.id === payload.fundingAccountId
    )?.name ?? null;
  const categoryName =
    input.categories.find((category) => category.id === payload.categoryId)
      ?.name ?? null;

  return {
    id: input.id,
    provider: payload.provider,
    productName: payload.productName,
    monthlyPremiumWon: payload.monthlyPremiumWon,
    paymentDay: payload.paymentDay,
    cycle: payload.cycle,
    fundingAccountId: payload.fundingAccountId,
    fundingAccountName,
    categoryId: payload.categoryId,
    categoryName,
    recurringStartDate: payload.recurringStartDate,
    linkedRecurringRuleId: input.linkedRecurringRuleId,
    renewalDate: payload.renewalDate ?? null,
    maturityDate: payload.maturityDate ?? null,
    isActive: payload.isActive ?? true
  };
}

export function mergeInsurancePoliciesForE2E(
  current: InsurancePolicyItem[],
  nextItem: InsurancePolicyItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      if (left.isActive !== right.isActive) {
        return Number(right.isActive) - Number(left.isActive);
      }

      const paymentDayDiff = left.paymentDay - right.paymentDay;
      if (paymentDayDiff !== 0) {
        return paymentDayDiff;
      }

      const providerDiff = left.provider.localeCompare(right.provider);
      if (providerDiff !== 0) {
        return providerDiff;
      }

      return left.productName.localeCompare(right.productName);
    }
  );
}

export function buildVehicleItemFromPayload(
  payload: CreateVehicleRequest | UpdateVehicleRequest,
  input: {
    id: string;
  }
): VehicleItem {
  return {
    id: input.id,
    name: payload.name,
    manufacturer: payload.manufacturer ?? null,
    fuelType: payload.fuelType,
    initialOdometerKm: payload.initialOdometerKm,
    estimatedFuelEfficiencyKmPerLiter:
      payload.estimatedFuelEfficiencyKmPerLiter ?? null
  };
}

export function mergeVehiclesForE2E(
  current: VehicleItem[],
  nextItem: VehicleItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      const nameDiff = left.name.localeCompare(right.name);
      if (nameDiff !== 0) {
        return nameDiff;
      }

      const manufacturerDiff = (left.manufacturer ?? '').localeCompare(
        right.manufacturer ?? ''
      );
      if (manufacturerDiff !== 0) {
        return manufacturerDiff;
      }

      return left.initialOdometerKm - right.initialOdometerKm;
    }
  );
}

export function buildVehicleFuelLogItemFromPayload(
  payload: CreateVehicleFuelLogRequest | UpdateVehicleFuelLogRequest,
  input: {
    id: string;
    vehicleId: string;
    vehicleName: string;
  }
): VehicleFuelLogItem {
  return {
    id: input.id,
    vehicleId: input.vehicleId,
    vehicleName: input.vehicleName,
    filledOn: payload.filledOn,
    odometerKm: payload.odometerKm,
    liters: payload.liters,
    amountWon: payload.amountWon,
    unitPriceWon: payload.unitPriceWon,
    isFullTank: payload.isFullTank
  };
}

export function mergeVehicleFuelLogsForE2E(
  current: VehicleFuelLogItem[],
  nextItem: VehicleFuelLogItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      const filledOnDiff = right.filledOn.localeCompare(left.filledOn);
      if (filledOnDiff !== 0) {
        return filledOnDiff;
      }

      const odometerDiff = right.odometerKm - left.odometerKm;
      if (odometerDiff !== 0) {
        return odometerDiff;
      }

      return left.vehicleName.localeCompare(right.vehicleName);
    }
  );
}

export function buildVehicleMaintenanceLogItemFromPayload(
  payload:
    | CreateVehicleMaintenanceLogRequest
    | UpdateVehicleMaintenanceLogRequest,
  input: {
    id: string;
    vehicleId: string;
    vehicleName: string;
  }
): VehicleMaintenanceLogItem {
  return {
    id: input.id,
    vehicleId: input.vehicleId,
    vehicleName: input.vehicleName,
    performedOn: payload.performedOn,
    odometerKm: payload.odometerKm,
    category: payload.category,
    vendor: payload.vendor ?? null,
    description: payload.description,
    amountWon: payload.amountWon,
    memo: payload.memo ?? null
  };
}

export function mergeVehicleMaintenanceLogsForE2E(
  current: VehicleMaintenanceLogItem[],
  nextItem: VehicleMaintenanceLogItem
) {
  return [nextItem, ...current.filter((item) => item.id !== nextItem.id)].sort(
    (left, right) => {
      const performedOnDiff = right.performedOn.localeCompare(left.performedOn);
      if (performedOnDiff !== 0) {
        return performedOnDiff;
      }

      const odometerDiff = right.odometerKm - left.odometerKm;
      if (odometerDiff !== 0) {
        return odometerDiff;
      }

      return left.vehicleName.localeCompare(right.vehicleName);
    }
  );
}

export function buildReferenceDataReadinessSummary(input: {
  fundingAccounts: FundingAccountItem[];
  categories: CategoryItem[];
}): ReferenceDataReadinessSummary {
  const activeFundingAccountCount = input.fundingAccounts.filter(
    (fundingAccount) => fundingAccount.status === 'ACTIVE'
  ).length;
  const activeIncomeCategoryCount = input.categories.filter(
    (category) => category.kind === 'INCOME' && category.isActive
  ).length;
  const activeExpenseCategoryCount = input.categories.filter(
    (category) => category.kind === 'EXPENSE' && category.isActive
  ).length;

  const missingRequirements: string[] = [];
  if (activeFundingAccountCount < 1) {
    missingRequirements.push('자금수단');
  }
  if (activeIncomeCategoryCount < 1) {
    missingRequirements.push('수입 카테고리');
  }
  if (activeExpenseCategoryCount < 1) {
    missingRequirements.push('지출 카테고리');
  }
  const allChecksReady = missingRequirements.length === 0;

  return {
    status: allChecksReady ? 'READY' : 'ACTION_REQUIRED',
    currentRole: 'OWNER',
    isReadyForMonthlyOperation: allChecksReady,
    isReadyForTransactionEntry: allChecksReady,
    isReadyForImportCollection: allChecksReady,
    isReadyForRecurringRuleSetup: allChecksReady,
    missingRequirements,
    checks: [
      {
        key: 'funding-accounts',
        label: '자금수단',
        description:
          '수집 거래, 반복 규칙, 업로드 승격에서 실제 자금 흐름 계정으로 선택하는 기준 목록입니다.',
        ready: activeFundingAccountCount >= 1,
        count: activeFundingAccountCount,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 수집 거래 등록과 업로드 행 승격에서 자금수단을 고를 수 없습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'income-categories',
        label: '수입 카테고리',
        description:
          '수입 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        ready: activeIncomeCategoryCount >= 1,
        count: activeIncomeCategoryCount,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 수입 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'expense-categories',
        label: '지출 카테고리',
        description:
          '지출 거래를 계획 항목, 수집 거래, 업로드 자동 판정에서 분류할 때 쓰는 기준 목록입니다.',
        ready: activeExpenseCategoryCount >= 1,
        count: activeExpenseCategoryCount,
        minimumRequiredCount: 1,
        ownershipScope: 'USER_MANAGED',
        responsibleRoles: ['OWNER', 'MANAGER'],
        inProductEditEnabled: true,
        operatingImpact:
          '없으면 지출 흐름을 계획/수집 단계에서 안정적으로 분류하기 어렵습니다.',
        managementNote:
          '사용자 관리 데이터이며 소유자 또는 관리자가 앱 안에서 직접 생성, 이름 수정, 활성 상태 관리를 진행할 수 있습니다.'
      },
      {
        key: 'account-subjects',
        label: '계정과목',
        description:
          '전표 라인, 월 마감, 재무제표 계산에 공통으로 쓰이는 공식 계정과목 목록입니다.',
        ready: true,
        count: 2,
        minimumRequiredCount: 1,
        ownershipScope: 'SYSTEM_MANAGED',
        responsibleRoles: [],
        inProductEditEnabled: false,
        operatingImpact:
          '없으면 전표 확정과 마감 계산이 일관되게 이어질 수 없습니다.',
        managementNote:
          '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
      },
      {
        key: 'ledger-transaction-types',
        label: '거래유형',
        description:
          '계획 항목과 수집 거래를 내부 전표 정책에 연결하는 공식 거래유형 목록입니다.',
        ready: true,
        count: 2,
        minimumRequiredCount: 1,
        ownershipScope: 'SYSTEM_MANAGED',
        responsibleRoles: [],
        inProductEditEnabled: false,
        operatingImpact:
          '없으면 계획/수집 거래를 전표 정책에 안정적으로 연결할 수 없습니다.',
        managementNote:
          '초기 범위에서는 system-managed/seed-managed 데이터로 유지합니다. 운영자는 직접 편집하지 않고 존재 여부와 활성 상태만 확인합니다.'
      }
    ]
  };
}
