import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedUser } from '@personal-erp/contracts';
import { LiabilitiesService } from '../src/modules/liabilities/liabilities.service';

const authenticatedUser: AuthenticatedUser = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Owner',
  currentWorkspace: {
    tenant: {
      id: 'tenant-1',
      slug: 'tenant-1',
      name: 'Tenant 1',
      status: 'ACTIVE'
    },
    membership: {
      id: 'membership-1',
      role: 'OWNER',
      status: 'ACTIVE'
    },
    ledger: {
      id: 'ledger-1',
      name: 'Main ledger',
      baseCurrency: 'KRW',
      timezone: 'Asia/Seoul',
      status: 'ACTIVE'
    }
  }
};

const baseAgreementInput = {
  lenderName: 'Bank',
  productName: 'Loan',
  principalAmount: 10_000_000,
  borrowedAt: '2026-02-28',
  maturityDate: null,
  interestRateType: 'FIXED' as const,
  repaymentMethod: 'MANUAL' as const,
  defaultFundingAccountId: 'account-1'
};

test('LiabilitiesService rejects non-existent calendar dates for agreements', async () => {
  const service = new LiabilitiesService({} as never, {} as never);

  await assert.rejects(
    () =>
      service.createAgreement(authenticatedUser, {
        ...baseAgreementInput,
        borrowedAt: '2026-02-31'
      }),
    BadRequestException
  );

  await assert.rejects(
    () =>
      service.createAgreement(authenticatedUser, {
        ...baseAgreementInput,
        maturityDate: '2026-04-31'
      }),
    BadRequestException
  );
});

test('LiabilitiesService rejects non-existent calendar dates for repayment schedules', async () => {
  const agreementId = ['liability', 'agreement', '1'].join('-');
  const service = new LiabilitiesService(
    {
      liabilityAgreement: {
        findFirst: async () => ({ id: agreementId })
      }
    } as never,
    {} as never
  );

  await assert.rejects(
    () =>
      service.createRepayment(authenticatedUser, agreementId, {
        dueDate: '2026-02-31',
        principalAmount: 1
      }),
    BadRequestException
  );
});
