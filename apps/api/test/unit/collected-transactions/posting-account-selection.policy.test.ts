import assert from 'node:assert/strict';
import test from 'node:test';
import { assessPostingAccountSelection } from '../../../src/modules/collected-transactions/domain/posting-account-selection.policy';

test('posting selection requires the second account and direction before transfer is ready', () => {
  assert.deepEqual(
    assessPostingAccountSelection({
      postingPolicyKey: 'TRANSFER_BASIC',
      fundingAccountId: 'bank-1',
      fundingAccountType: 'BANK'
    }),
    {
      status: 'REVIEWED',
      direction: null,
      missingRequirements: [
        'counterpartyFundingAccountId',
        'fundingAccountDirection'
      ],
      validationError: null
    }
  );
});

test('posting selection accepts bank-to-card payment and rejects an invalid direction', () => {
  const ready = assessPostingAccountSelection({
    postingPolicyKey: 'CARD_PAYMENT',
    fundingAccountId: 'bank-1',
    fundingAccountType: 'BANK',
    counterpartyFundingAccountId: 'card-1',
    counterpartyFundingAccountType: 'CARD',
    fundingAccountDirection: 'OUTFLOW'
  });
  assert.equal(ready.status, 'READY_TO_POST');
  assert.equal(ready.validationError, null);

  const invalid = assessPostingAccountSelection({
    postingPolicyKey: 'CARD_PAYMENT',
    fundingAccountId: 'bank-1',
    fundingAccountType: 'BANK',
    counterpartyFundingAccountId: 'card-1',
    counterpartyFundingAccountType: 'CARD',
    fundingAccountDirection: 'INFLOW'
  });
  assert.match(invalid.validationError ?? '', /OUTFLOW/);
});

test('posting selection keeps legacy card expense on the card-spend policy ready', () => {
  const result = assessPostingAccountSelection({
    postingPolicyKey: 'CARD_SPEND',
    fundingAccountId: 'card-1',
    fundingAccountType: 'CARD',
    categoryId: 'category-expense'
  });

  assert.equal(result.status, 'READY_TO_POST');
  assert.equal(result.direction, 'OUTFLOW');
});
