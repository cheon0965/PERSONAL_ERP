/**
 * HTTP 계약에서 사용하는 금액 값입니다.
 *
 * MoneyWon은 원화 정수 단위의 안전한 정수입니다. 1차 마이그레이션 단계에서는
 * API 페이로드가 `number`를 유지하지만, API 영속 계층은 금액을 Decimal(19,0)으로 저장합니다.
 * Decimal 중간값은 영속화 전에 반드시 HALF_UP으로 반올림해야 합니다.
 */
export type MoneyWon = number;
