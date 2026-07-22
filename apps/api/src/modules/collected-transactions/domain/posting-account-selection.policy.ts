type AccountType = 'BANK' | 'CASH' | 'CARD';
type FundingAccountDirection = 'INFLOW' | 'OUTFLOW';
type PostingPolicyKey =
  | 'INCOME_BASIC'
  | 'EXPENSE_BASIC'
  | 'TRANSFER_BASIC'
  | 'CARD_SPEND'
  | 'CARD_PAYMENT'
  | 'OPENING_BALANCE'
  | 'CARRY_FORWARD'
  | 'MANUAL_ADJUSTMENT';

export type PostingAccountSelection = {
  postingPolicyKey: PostingPolicyKey;
  fundingAccountId: string;
  fundingAccountType: AccountType;
  counterpartyFundingAccountId?: string | null;
  counterpartyFundingAccountType?: AccountType | null;
  fundingAccountDirection?: FundingAccountDirection | null;
  categoryId?: string | null;
};

export type PostingAccountSelectionAssessment = {
  status: 'READY_TO_POST' | 'REVIEWED';
  direction: FundingAccountDirection | null;
  missingRequirements: string[];
  validationError: string | null;
};

const isAssetFundingAccount = (type: AccountType) =>
  type === 'BANK' || type === 'CASH';

export function assessPostingAccountSelection(
  input: PostingAccountSelection
): PostingAccountSelectionAssessment {
  const direction =
    input.fundingAccountDirection ?? defaultDirection(input.postingPolicyKey);
  const counterpartyId = normalizeOptionalId(
    input.counterpartyFundingAccountId
  );
  const missingRequirements: string[] = [];

  if (counterpartyId && counterpartyId === input.fundingAccountId) {
    return invalid('출발 자금수단과 도착 자금수단은 서로 달라야 합니다.');
  }

  switch (input.postingPolicyKey) {
    case 'INCOME_BASIC':
      if (!isAssetFundingAccount(input.fundingAccountType)) {
        return invalid(
          '기본 수입은 은행 또는 현금 자금수단만 사용할 수 있습니다.'
        );
      }
      if (counterpartyId) {
        return invalid('기본 수입에는 상대 자금수단을 지정할 수 없습니다.');
      }
      if (direction !== 'INFLOW') {
        return invalid('기본 수입의 자금수단 방향은 INFLOW여야 합니다.');
      }
      if (!normalizeOptionalId(input.categoryId)) {
        missingRequirements.push('categoryId');
      }
      break;
    case 'EXPENSE_BASIC':
      if (!isAssetFundingAccount(input.fundingAccountType)) {
        return invalid(
          '기본 지출은 은행 또는 현금 자금수단만 사용할 수 있습니다.'
        );
      }
      if (counterpartyId) {
        return invalid('기본 지출에는 상대 자금수단을 지정할 수 없습니다.');
      }
      if (direction !== 'OUTFLOW') {
        return invalid('기본 지출의 자금수단 방향은 OUTFLOW여야 합니다.');
      }
      if (!normalizeOptionalId(input.categoryId)) {
        missingRequirements.push('categoryId');
      }
      break;
    case 'CARD_SPEND':
      if (input.fundingAccountType !== 'CARD') {
        return invalid('카드 사용은 카드 자금수단만 사용할 수 있습니다.');
      }
      if (counterpartyId) {
        return invalid('카드 사용에는 상대 자금수단을 지정할 수 없습니다.');
      }
      if (direction !== 'OUTFLOW') {
        return invalid('카드 사용의 자금수단 방향은 OUTFLOW여야 합니다.');
      }
      if (!normalizeOptionalId(input.categoryId)) {
        missingRequirements.push('categoryId');
      }
      break;
    case 'TRANSFER_BASIC':
      if (!isAssetFundingAccount(input.fundingAccountType)) {
        return invalid(
          '계좌 이체는 은행 또는 현금 자금수단만 사용할 수 있습니다.'
        );
      }
      if (!counterpartyId) {
        missingRequirements.push('counterpartyFundingAccountId');
      } else if (
        !input.counterpartyFundingAccountType ||
        !isAssetFundingAccount(input.counterpartyFundingAccountType)
      ) {
        return invalid(
          '계좌 이체의 상대 자금수단도 은행 또는 현금이어야 합니다.'
        );
      }
      if (!input.fundingAccountDirection) {
        missingRequirements.push('fundingAccountDirection');
      }
      if (normalizeOptionalId(input.categoryId)) {
        return invalid('계좌 이체에는 손익 카테고리를 지정할 수 없습니다.');
      }
      break;
    case 'CARD_PAYMENT': {
      if (!counterpartyId) {
        missingRequirements.push('counterpartyFundingAccountId');
      } else {
        const validPair =
          (input.fundingAccountType === 'CARD' &&
            input.counterpartyFundingAccountType != null &&
            isAssetFundingAccount(input.counterpartyFundingAccountType)) ||
          (isAssetFundingAccount(input.fundingAccountType) &&
            input.counterpartyFundingAccountType === 'CARD');
        if (!validPair) {
          return invalid(
            '카드대금 결제는 카드와 은행 또는 현금 자금수단을 한 쌍으로 지정해야 합니다.'
          );
        }
      }
      if (!input.fundingAccountDirection) {
        missingRequirements.push('fundingAccountDirection');
      } else if (
        (input.fundingAccountType === 'CARD' && direction !== 'INFLOW') ||
        (isAssetFundingAccount(input.fundingAccountType) &&
          direction !== 'OUTFLOW')
      ) {
        return invalid(
          '카드대금 결제 방향은 카드 기준 INFLOW, 결제계좌 기준 OUTFLOW여야 합니다.'
        );
      }
      if (normalizeOptionalId(input.categoryId)) {
        return invalid('카드대금 결제에는 손익 카테고리를 지정할 수 없습니다.');
      }
      break;
    }
    case 'MANUAL_ADJUSTMENT':
      break;
    default:
      return invalid('수집 거래에서 지원하지 않는 전표 정책입니다.');
  }

  return {
    status: missingRequirements.length === 0 ? 'READY_TO_POST' : 'REVIEWED',
    direction,
    missingRequirements,
    validationError: null
  };
}

function defaultDirection(
  postingPolicyKey: PostingPolicyKey
): FundingAccountDirection | null {
  switch (postingPolicyKey) {
    case 'INCOME_BASIC':
      return 'INFLOW';
    case 'EXPENSE_BASIC':
    case 'CARD_SPEND':
      return 'OUTFLOW';
    default:
      return null;
  }
}

function invalid(message: string): PostingAccountSelectionAssessment {
  return {
    status: 'REVIEWED',
    direction: null,
    missingRequirements: [],
    validationError: message
  };
}

function normalizeOptionalId(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
