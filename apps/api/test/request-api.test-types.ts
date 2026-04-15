import type { FinancialStatementPayload } from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  CollectedTransactionStatus,
  FinancialStatementKind,
  ImportBatchParseStatus,
  ImportedRowParseStatus,
  ImportSourceKind,
  LedgerTransactionFlowKind,
  OperationalNoteKind,
  RecurrenceFrequency,
  OpeningBalanceSourceKind,
  PlanItemStatus,
  WorkspaceNavigationMenuItemType,
  WorkspaceNavigationMenuMatchMode
} from '@prisma/client';

export type RequestTestUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  settings?: {
    minimumReserveWon: number | null;
    monthlySinkingFundWon: number | null;
    timezone: string;
  };
};

export type RequestTestState = {
  databaseReady: boolean;
  failOpeningBalanceSnapshotCreate: boolean;
  simulateCollectedTransactionAlreadyPostedOnNextTransactionId: string | null;
  simulateCollectedTransactionAlreadyLinkedOnNextImportClaimId: string | null;
  users: RequestTestUser[];
  tenants: Array<{
    id: string;
    slug: string;
    name: string;
    status: 'ACTIVE' | 'TRIAL' | 'SUSPENDED' | 'ARCHIVED';
    defaultLedgerId: string | null;
  }>;
  memberships: Array<{
    id: string;
    tenantId: string;
    userId: string;
    role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
    status: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
    joinedAt: Date;
    invitedByMembershipId: string | null;
    lastAccessAt: Date | null;
  }>;
  ledgers: Array<{
    id: string;
    tenantId: string;
    name: string;
    baseCurrency: string;
    timezone: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
    createdAt: Date;
  }>;
  ledgerTransactionTypes: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    code: string;
    name?: string;
    flowKind: LedgerTransactionFlowKind;
    postingPolicyKey?:
      | 'INCOME_BASIC'
      | 'EXPENSE_BASIC'
      | 'TRANSFER_BASIC'
      | 'CARD_SPEND'
      | 'CARD_PAYMENT'
      | 'OPENING_BALANCE'
      | 'CARRY_FORWARD'
      | 'MANUAL_ADJUSTMENT';
    isActive: boolean;
  }>;
  accountingPeriods: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    year: number;
    month: number;
    startDate: Date;
    endDate: Date;
    status: AccountingPeriodStatus;
    nextJournalEntrySequence?: number;
    openedAt: Date;
    lockedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  periodStatusHistory: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    fromStatus: AccountingPeriodStatus | null;
    toStatus: AccountingPeriodStatus;
    eventType:
      | 'OPEN'
      | 'MOVE_TO_REVIEW'
      | 'START_CLOSING'
      | 'LOCK'
      | 'REOPEN'
      | 'FORCE_LOCK';
    reason: string | null;
    actorType: AuditActorType;
    actorMembershipId: string | null;
    changedAt: Date;
  }>;
  openingBalanceSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    effectivePeriodId: string;
    sourceKind: OpeningBalanceSourceKind;
    createdAt: Date;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
  }>;
  closingSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    lockedAt: Date;
    totalAssetAmount: number;
    totalLiabilityAmount: number;
    totalEquityAmount: number;
    periodPnLAmount: number;
    createdAt: Date;
  }>;
  balanceSnapshotLines: Array<{
    id: string;
    snapshotKind: 'OPENING' | 'CLOSING';
    openingSnapshotId: string | null;
    closingSnapshotId: string | null;
    accountSubjectId: string;
    fundingAccountId: string | null;
    balanceAmount: number;
  }>;
  financialStatementSnapshots: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    statementKind: FinancialStatementKind;
    currency: string;
    payload: FinancialStatementPayload;
    createdAt: Date;
    updatedAt: Date;
  }>;
  carryForwardRecords: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    fromPeriodId: string;
    toPeriodId: string;
    sourceClosingSnapshotId: string;
    createdJournalEntryId: string | null;
    createdAt: Date;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
  }>;
  importBatches: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string | null;
    sourceKind: ImportSourceKind;
    fileName: string;
    fileHash: string;
    rowCount: number;
    parseStatus: ImportBatchParseStatus;
    uploadedByMembershipId: string;
    uploadedAt: Date;
  }>;
  importedRows: Array<{
    id: string;
    batchId: string;
    rowNumber: number;
    rawPayload: Record<string, unknown>;
    parseStatus: ImportedRowParseStatus;
    parseError: string | null;
    sourceFingerprint: string | null;
  }>;
  accountSubjects: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    code: string;
    name: string;
    statementType?: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS';
    normalSide?: 'DEBIT' | 'CREDIT';
    subjectKind?: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
    isSystem?: boolean;
    isActive: boolean;
  }>;
  authSessions: Array<{
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  emailVerificationTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    consumedAt: Date | null;
    createdAt: Date;
  }>;
  tenantMembershipInvitations: Array<{
    id: string;
    tenantId: string;
    email: string;
    normalizedEmail: string;
    role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
    tokenHash: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
    invitedByMembershipId: string;
    createdAt: Date;
  }>;
  workspaceAuditEvents: Array<{
    id: string;
    tenantId: string;
    ledgerId: string | null;
    actorUserId: string | null;
    actorMembershipId: string | null;
    actorRole: string | null;
    eventCategory: string;
    eventName: string;
    action: string | null;
    resourceType: string | null;
    resourceId: string | null;
    result: 'SUCCESS' | 'DENIED' | 'FAILED';
    reason: string | null;
    requestId: string | null;
    path: string | null;
    clientIpHash: string | null;
    metadata: Record<string, string | number | boolean | null> | null;
    occurredAt: Date;
  }>;
  workspaceNavigationMenuItems: Array<{
    id: string;
    tenantId: string;
    parentId: string | null;
    key: string;
    itemType: WorkspaceNavigationMenuItemType;
    label: string;
    description: string | null;
    href: string | null;
    iconKey: string | null;
    matchMode: WorkspaceNavigationMenuMatchMode;
    sortOrder: number;
    isVisible: boolean;
  }>;
  workspaceNavigationMenuRoles: Array<{
    menuItemId: string;
    role: 'OWNER' | 'MANAGER' | 'EDITOR' | 'VIEWER';
  }>;
  workspaceOperationalNotes: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string | null;
    authorMembershipId: string;
    kind: OperationalNoteKind;
    title: string;
    body: string;
    relatedHref: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  sentEmails: Array<{
    to: string;
    subject: string;
    text: string;
    html?: string;
  }>;
  accounts: Array<{
    id: string;
    userId: string;
    tenantId: string;
    ledgerId: string;
    name: string;
    normalizedName?: string;
    type?: 'BANK' | 'CASH' | 'CARD';
    balanceWon: number;
    sortOrder?: number;
    status: 'ACTIVE' | 'INACTIVE' | 'CLOSED';
  }>;
  categories: Array<{
    id: string;
    userId: string;
    tenantId: string;
    ledgerId: string;
    name: string;
    normalizedName?: string;
    kind?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    isActive: boolean;
  }>;
  collectedTransactions: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    matchedPlanItemId: string | null;
    importBatchId: string | null;
    importedRowId: string | null;
    sourceFingerprint: string | null;
    title: string;
    occurredOn: Date;
    amount: number;
    status: CollectedTransactionStatus;
    memo: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  recurringRules: Array<{
    id: string;
    userId: string;
    tenantId: string;
    ledgerId: string;
    accountId: string;
    categoryId: string;
    title: string;
    amountWon: number;
    frequency: RecurrenceFrequency;
    dayOfMonth: number;
    startDate: Date;
    endDate: Date | null;
    isActive: boolean;
    nextRunDate: Date;
    createdAt: Date;
    updatedAt: Date;
  }>;
  planItems: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    recurringRuleId: string | null;
    ledgerTransactionTypeId: string;
    fundingAccountId: string;
    categoryId: string | null;
    title: string;
    plannedAmount: number;
    plannedDate: Date;
    status: PlanItemStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  journalEntries: Array<{
    id: string;
    tenantId: string;
    ledgerId: string;
    periodId: string;
    entryNumber: string;
    entryDate: Date;
    sourceKind:
      | 'COLLECTED_TRANSACTION'
      | 'PLAN_SETTLEMENT'
      | 'OPENING_BALANCE'
      | 'CARRY_FORWARD'
      | 'MANUAL_ADJUSTMENT';
    sourceCollectedTransactionId: string | null;
    reversesJournalEntryId?: string | null;
    correctsJournalEntryId?: string | null;
    correctionReason?: string | null;
    status: 'POSTED' | 'REVERSED' | 'SUPERSEDED';
    memo: string | null;
    createdByActorType: AuditActorType;
    createdByMembershipId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      lineNumber: number;
      accountSubjectId: string;
      fundingAccountId: string | null;
      debitAmount: number;
      creditAmount: number;
      description: string | null;
    }>;
  }>;
  insurancePolicies: Array<{
    id: string;
    userId: string;
    tenantId: string;
    ledgerId: string;
    provider: string;
    normalizedProvider?: string;
    productName: string;
    normalizedProductName?: string;
    monthlyPremiumWon: number;
    paymentDay: number;
    cycle: 'MONTHLY' | 'YEARLY';
    accountId: string | null;
    categoryId: string | null;
    recurringStartDate: Date | null;
    linkedRecurringRuleId: string | null;
    renewalDate: Date | null;
    maturityDate: Date | null;
    isActive: boolean;
  }>;
  vehicles: Array<{
    id: string;
    userId: string;
    tenantId: string;
    ledgerId: string;
    name: string;
    normalizedName?: string;
    manufacturer: string | null;
    fuelType: 'GASOLINE' | 'DIESEL' | 'LPG' | 'HYBRID' | 'ELECTRIC';
    initialOdometerKm: number;
    estimatedFuelEfficiencyKmPerLiter: number | null;
    createdAt: Date;
    fuelLogs: Array<{
      id: string;
      filledOn: Date;
      odometerKm: number;
      liters: number;
      amountWon: number;
      unitPriceWon: number;
      isFullTank: boolean;
    }>;
  }>;
  vehicleMaintenanceLogs: Array<{
    id: string;
    vehicleId: string;
    performedOn: Date;
    odometerKm: number;
    category:
      | 'INSPECTION'
      | 'REPAIR'
      | 'CONSUMABLE'
      | 'TIRE'
      | 'ACCIDENT'
      | 'OTHER';
    vendor: string | null;
    description: string;
    amountWon: number;
    memo: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export type RequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type RequestResult = {
  status: number;
  body: unknown;
  headers: Headers;
};

export type RequestTestContext = {
  state: RequestTestState;
  securityEvents: Array<{
    level: 'log' | 'warn' | 'error';
    event: string;
    details: Record<string, unknown>;
  }>;
  request: (path: string, options?: RequestOptions) => Promise<RequestResult>;
  authHeaders: (userId?: string) => Record<string, string>;
  close: () => Promise<void>;
};

export type RequestTestOptions = RequestOptions;
export type RequestTestResult = RequestResult;
