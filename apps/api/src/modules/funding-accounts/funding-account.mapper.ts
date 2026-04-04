import type { FundingAccountItem } from '@personal-erp/contracts';

type AccountRecord = Pick<
  FundingAccountItem,
  'id' | 'name' | 'type' | 'balanceWon' | 'status'
>;

export function mapFundingAccountRecordToItem(
  account: AccountRecord
): FundingAccountItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceWon: account.balanceWon,
    status: account.status
  };
}
