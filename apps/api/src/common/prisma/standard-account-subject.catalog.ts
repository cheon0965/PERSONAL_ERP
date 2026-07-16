import {
  AccountNormalSide,
  AccountSubjectKind,
  AccountSubjectStatementType,
  CategoryKind
} from '@prisma/client';

export const STANDARD_ACCOUNT_SUBJECT_CODES = {
  CASH_AND_DEPOSITS: '1010',
  CARD_PAYABLE: '2100',
  NET_ASSETS: '3100',
  OPERATING_INCOME: '4100',
  SALES_INCOME: '4110',
  OTHER_OPERATING_INCOME: '4190',
  OPERATING_EXPENSE: '5100',
  RAW_MATERIALS: '5110',
  PERSONNEL_EXPENSE: '5120',
  RENT_EXPENSE: '5130',
  SERVICE_FEES: '5140',
  INSURANCE_EXPENSE: '5150',
  VEHICLE_EXPENSE: '5160',
  COMMUNICATION_EXPENSE: '5170',
  SUPPLIES_EXPENSE: '5180',
  ADVERTISING_EXPENSE: '5190',
  DELIVERY_EXPENSE: '5200',
  INTEREST_EXPENSE: '5210',
  TAXES_AND_DUES: '5220'
} as const;

export const STANDARD_ACCOUNT_SUBJECT_CATALOG = [
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.CASH_AND_DEPOSITS,
    name: '현금및예금',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.ASSET,
    isSystem: true,
    sortOrder: 10
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.CARD_PAYABLE,
    name: '카드미지급금',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.LIABILITY,
    isSystem: true,
    sortOrder: 20
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.NET_ASSETS,
    name: '순자산',
    statementType: AccountSubjectStatementType.BALANCE_SHEET,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.EQUITY,
    isSystem: true,
    sortOrder: 30
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_INCOME,
    name: '운영수익',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.INCOME,
    isSystem: true,
    sortOrder: 40
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.SALES_INCOME,
    name: '매출수익',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.INCOME,
    isSystem: true,
    sortOrder: 41
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.OTHER_OPERATING_INCOME,
    name: '기타운영수익',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.CREDIT,
    subjectKind: AccountSubjectKind.INCOME,
    isSystem: true,
    sortOrder: 49
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_EXPENSE,
    name: '운영비용',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 50
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.RAW_MATERIALS,
    name: '원재료비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 51
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.PERSONNEL_EXPENSE,
    name: '인건비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 52
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.RENT_EXPENSE,
    name: '임차료',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 53
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.SERVICE_FEES,
    name: '지급수수료',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 54
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.INSURANCE_EXPENSE,
    name: '보험료',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 55
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.VEHICLE_EXPENSE,
    name: '차량유지비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 56
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.COMMUNICATION_EXPENSE,
    name: '통신비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 57
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.SUPPLIES_EXPENSE,
    name: '소모품비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 58
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.ADVERTISING_EXPENSE,
    name: '광고선전비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 59
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.DELIVERY_EXPENSE,
    name: '운반비',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 60
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.INTEREST_EXPENSE,
    name: '이자비용',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 61
  },
  {
    code: STANDARD_ACCOUNT_SUBJECT_CODES.TAXES_AND_DUES,
    name: '세금과공과',
    statementType: AccountSubjectStatementType.PROFIT_AND_LOSS,
    normalSide: AccountNormalSide.DEBIT,
    subjectKind: AccountSubjectKind.EXPENSE,
    isSystem: true,
    sortOrder: 62
  }
] as const;

export function readGenericAccountSubjectCode(
  categoryKind: CategoryKind
): string | null {
  switch (categoryKind) {
    case CategoryKind.INCOME:
      return STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_INCOME;
    case CategoryKind.EXPENSE:
      return STANDARD_ACCOUNT_SUBJECT_CODES.OPERATING_EXPENSE;
    case CategoryKind.TRANSFER:
    default:
      return null;
  }
}
