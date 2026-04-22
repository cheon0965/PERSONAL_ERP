import type { RequestTestState } from './request-api.test-types';

export function createRequestReferenceDataStateFixtures(): Pick<
  RequestTestState,
  'accountSubjects' | 'accounts' | 'categories'
> {
  return {
    accountSubjects: [
      {
        id: 'as-1-1010',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '1010',
        name: '현금및예금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'DEBIT',
        subjectKind: 'ASSET',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-2100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '2100',
        name: '카드미지급금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'LIABILITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-3100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '3100',
        name: '순자산',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'EQUITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-4100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '4100',
        name: '운영수익',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'CREDIT',
        subjectKind: 'INCOME',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-1-5100',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        code: '5100',
        name: '운영비용',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'DEBIT',
        subjectKind: 'EXPENSE',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-1010',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '1010',
        name: '현금및예금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'DEBIT',
        subjectKind: 'ASSET',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-2100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '2100',
        name: '카드미지급금',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'LIABILITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-3100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '3100',
        name: '순자산',
        statementType: 'BALANCE_SHEET',
        normalSide: 'CREDIT',
        subjectKind: 'EQUITY',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-4100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '4100',
        name: '운영수익',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'CREDIT',
        subjectKind: 'INCOME',
        isSystem: true,
        isActive: true
      },
      {
        id: 'as-2-5100',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        code: '5100',
        name: '운영비용',
        statementType: 'PROFIT_AND_LOSS',
        normalSide: 'DEBIT',
        subjectKind: 'EXPENSE',
        isSystem: true,
        isActive: true
      }
    ],
    accounts: [
      {
        id: 'acc-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Main checking',
        type: 'BANK',
        balanceWon: 2_000_000,
        sortOrder: 0,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-1b',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Emergency savings',
        type: 'BANK',
        balanceWon: 3_500_000,
        sortOrder: 1,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      },
      {
        id: 'acc-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: 'Other account',
        type: 'BANK',
        balanceWon: 9_000_000,
        sortOrder: 0,
        status: 'ACTIVE',
        bootstrapStatus: 'NOT_REQUIRED'
      }
    ],
    categories: [
      {
        id: 'cat-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Fuel',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-1b',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Salary',
        kind: 'INCOME',
        isActive: true
      },
      {
        id: 'cat-1c',
        userId: 'user-1',
        tenantId: 'tenant-1',
        ledgerId: 'ledger-1',
        name: 'Utilities',
        kind: 'EXPENSE',
        isActive: true
      },
      {
        id: 'cat-2',
        userId: 'user-2',
        tenantId: 'tenant-2',
        ledgerId: 'ledger-2',
        name: 'Other category',
        kind: 'EXPENSE',
        isActive: true
      }
    ]
  };
}
