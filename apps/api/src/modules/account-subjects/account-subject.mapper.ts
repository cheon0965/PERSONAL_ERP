import type { AccountSubjectItem } from '@personal-erp/contracts';

type AccountSubjectRecord = AccountSubjectItem;

export function mapAccountSubjectRecordToItem(
  accountSubject: AccountSubjectRecord
): AccountSubjectItem {
  return {
    id: accountSubject.id,
    code: accountSubject.code,
    name: accountSubject.name,
    statementType: accountSubject.statementType,
    normalSide: accountSubject.normalSide,
    subjectKind: accountSubject.subjectKind,
    isSystem: accountSubject.isSystem,
    isActive: accountSubject.isActive
  };
}
