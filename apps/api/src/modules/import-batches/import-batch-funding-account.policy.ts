import { BadRequestException } from '@nestjs/common';

type FundingAccountLookupClient = {
  account: {
    findFirst(args: {
      where: {
        id: string;
        tenantId: string;
        ledgerId: string;
      };
      select: {
        id: true;
        type: true;
        status: true;
      };
    }): Promise<{
      id: string;
      type: string;
      status: string;
    } | null>;
  };
};

export async function resolveImportBatchFundingAccountId(input: {
  client: FundingAccountLookupClient;
  workspace: {
    tenantId: string;
    ledgerId: string;
  };
  fundingAccountId?: string | null;
  requiredMessage?: string;
}): Promise<string | null> {
  const fundingAccountId = input.fundingAccountId?.trim() ?? '';

  if (!fundingAccountId) {
    if (input.requiredMessage) {
      throw new BadRequestException(input.requiredMessage);
    }

    return null;
  }

  const fundingAccount = await input.client.account.findFirst({
    where: {
      id: fundingAccountId,
      tenantId: input.workspace.tenantId,
      ledgerId: input.workspace.ledgerId
    },
    select: {
      id: true,
      type: true,
      status: true
    }
  });

  if (!fundingAccount) {
    throw new BadRequestException('선택한 계좌/카드를 찾을 수 없습니다.');
  }

  if (!['BANK', 'CARD'].includes(fundingAccount.type)) {
    throw new BadRequestException(
      '업로드 배치에는 계좌 또는 카드 자금수단만 연결할 수 있습니다.'
    );
  }

  if (fundingAccount.status !== 'ACTIVE') {
    throw new BadRequestException(
      '활성 상태의 계좌/카드만 업로드 배치에 연결할 수 있습니다.'
    );
  }

  return fundingAccount.id;
}
