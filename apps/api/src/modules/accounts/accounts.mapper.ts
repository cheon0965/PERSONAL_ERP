import type { AccountItem } from '@personal-erp/contracts';

type AccountRecord = Pick<AccountItem, 'id' | 'name' | 'type' | 'balanceWon'>;

export function mapAccountToItem(account: AccountRecord): AccountItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceWon: account.balanceWon
  };
}
