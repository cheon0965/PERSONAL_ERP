import type { ApiPropertyOptions } from '@nestjs/swagger';
import { MAX_MONEY_WON } from '@personal-erp/money';

const MONEY_WON_DESCRIPTION =
  'MoneyWon: KRW amount expressed as a whole-won safe integer. Persistent money columns use Decimal(19,0); decimal intermediate values are rounded HALF_UP before persistence.';

export function moneyWonApiProperty(
  options: ApiPropertyOptions = {}
): ApiPropertyOptions {
  const description = options.description
    ? `${MONEY_WON_DESCRIPTION} ${options.description}`
    : MONEY_WON_DESCRIPTION;

  return {
    type: Number,
    format: 'safe-integer',
    maximum: MAX_MONEY_WON,
    ...options,
    description
  };
}
