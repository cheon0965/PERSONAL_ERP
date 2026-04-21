import type { FundingAccountItem } from '@personal-erp/contracts';
import {
  fromPrismaMoneyWon,
  type PrismaMoneyLike
} from '../../common/money/prisma-money';

type AccountRecord = {
  id: string;
  name: string;
  type: FundingAccountItem['type'];
  balanceWon: PrismaMoneyLike | number;
  status: FundingAccountItem['status'];
};

export function mapFundingAccountRecordToItem(
  account: AccountRecord
): FundingAccountItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balanceWon:
      typeof account.balanceWon === 'number'
        ? account.balanceWon
        : fromPrismaMoneyWon(account.balanceWon),
    status: account.status
  };
}
