# 금액 정합성 실행계획

> 보관 상태: `2026-04-11` 기준 실행 완료 후 `docs/completed/`로 이동했다. 현재 운영 기준은 `docs/API.md`, `docs/VALIDATION_NOTES.md`, `docs/ARCHITECTURE.md`, `packages/contracts`, `packages/money`를 우선한다.

## 목적

이 문서는 `PERSONAL_ERP`에서 금액 정합성을 실제 운영 기준으로 끌어올리기 위한 실행계획이다.

이 계획의 목표는 네 가지다.

- 도메인 문서에 이미 정의된 `Money` 정책을 실제 코드 구조와 저장소 타입으로 고정한다.
- MySQL `Int` 기반 금액 컬럼의 범위 한계를 제거한다.
- 수집, 전표, 마감, 재무제표, 대시보드, 예측, 업로드 파싱이 같은 금액 연산 규칙을 사용하게 만든다.
- 이후 기능이 늘어나도 금액 계산이 `임의 number 연산`으로 다시 퍼지지 않도록 공용 모듈과 검증 가드를 남긴다.

## 진행 상태

기준 시점: `2026-04-11`

- `Phase 0` 완료
  - 금액 필드와 합산 경로를 인벤토리로 고정했고, 고액 금액/안전 정수 경계 테스트를 추가했다.
- `Phase 1` 완료
  - 신규 workspace package `packages/money`를 도입했고, `MoneyWon` 공용 파싱/검증/연산 helper를 API와 Web에서 함께 사용하도록 연결했다.
- `Phase 2` 완료
  - 수집 거래, 반복규칙, 보험, 차량, 오프닝 잔액, 전표 정정, 업로드 파싱 경계가 공용 money 검증을 사용하도록 통일했다.
- `Phase 3` 완료
  - Prisma 금액 컬럼을 `Decimal(19,0)`으로 승격했다.
  - 마이그레이션 `20260411143000_money_decimal_precision`를 실제 DB에 적용했다.
  - `Prisma.Decimal -> MoneyWon(number)` 브리지를 repository/mapper/read model 경계에 반영했다.
  - 검증 기준으로 `npm run db:status`, `npm run test:api`, `npm run test:prisma`를 통과했다.
- `Phase 4` 완료
  - 마감, 재무제표, 대시보드, 예측, 업로드 수집, 전표 역분개/정정 합산을 공용 money helper 기준으로 정리했다.
  - `roundMoneyWonHalfUp`, `allocateMoneyWon`을 `decimal.js` 기반 exact arithmetic으로 전환했다.
  - `npm run money:check` 정적 가드를 추가해 money package 밖의 금액 raw `Number(...)`, `+/-`, `+=/-=` 유입을 막는다.
- `Phase 5` 완료
  - contracts/API 응답 의미와 실제 계정과목 기본 코드 체계를 정리했다.
  - 실DB 기준 기본 계정과목 코드는 `1010 / 2100 / 3100 / 4100 / 5100`으로 맞춘다.
  - contracts에 `MoneyWon` 타입 별칭을 추가하고, Swagger 금액 필드 설명을 공용 `moneyWonApiProperty`로 맞췄다.
  - `docs/API.md`, `docs/VALIDATION_NOTES.md`에 `원 단위 정수`, `safe integer`, `Decimal(19,0)`, `HALF_UP`, 정적 가드 기준을 반영했다.
- `Phase 6` 완료
  - 실제 DB 마이그레이션 적용과 Prisma 통합 테스트까지 끝냈다.
  - 이번 후속 변경 이후 `npm run build:money`, `npm run money:check`, `npm run test:api`, `npm run check:quick`, `npm run test`, `npm run build`, `npm run test:e2e:smoke:build`를 재실행해 통과했다.
  - 브라우저 기반 `npm run test:e2e:smoke:build:browser`는 필수 잔여 작업이 아니라 필요 시 별도로 실행하는 심화 smoke로 유지한다.

## 상위 기준

- 비즈니스 정책의 상위 기준은 `docs/domain/business-logic-draft.md`를 우선한다.
- 핵심 엔티티, `Money` 값 객체, 반올림 규칙의 상위 기준은 `docs/domain/core-entity-definition.md`를 우선한다.
- 이 문서는 도메인 정책을 새로 정의하지 않고, 현재 저장소에서 그 정책을 어떤 순서로 구현할지 정리하는 실행 문서다.

현재 도메인 기준은 이미 아래를 요구한다.

- 영속 금액은 `Ledger.baseCurrency` 기준 최소 통화단위 정수로 저장한다.
- KRW 장부는 `1원` 단위 정수 금액만 저장한다.
- 계산 중간값은 더 높은 정밀도를 쓸 수 있지만, 엔티티 저장 전에는 반올림을 확정한다.
- 기본 반올림 기준은 `HALF_UP`이다.
- 여러 라인으로 분할한 금액의 합은 원본 총액과 정확히 일치해야 한다.

## 작업 전 기준선

계획 작성 당시 저장소는 금액 의미 자체는 비교적 잘 유지하고 있었지만, 구현 계층별 표현이 분산되어 있었다.

- Prisma/MySQL 금액 컬럼은 대부분 `Int`였다.
- API DTO, 서비스, read model, contracts, Web form은 대부분 `number`를 사용했다.
- 업로드 배치 파싱만 `Number.isSafeInteger`를 명시적으로 검사하고, 다른 입력 경계는 `IsInt`, `zod.int()`, `Number()` 변환에 더 많이 의존했다.
- 마감, 재무제표, 대시보드, 예측, 전표 정정, 화면 합계는 raw `+`, `reduce`, `Number()` 변환으로 합산하는 지점이 있었다.
- 차량 영역의 `liters`, `estimatedFuelEfficiencyKmPerLiter`는 이미 `Decimal`을 사용하지만, 금액 영역의 공용 정책과는 분리돼 있었다.

계획 작성 당시 가장 큰 리스크는 아래 두 가지였다.

1. 금액 컬럼이 `Int`라서 범위가 약 `2,147,483,647`로 제한된다.
2. 금액 연산이 공용 값 객체가 아니라 일반 `number` 누적에 퍼져 있어, 향후 배분/반올림/대규모 잔액 처리 시 drift가 생길 여지가 있다.

## 이번 실행계획의 기본 결정

### 1. 영속 금액은 계속 `원 단위 정수`로 유지한다

- 회계 금액의 도메인 의미는 계속 `KRW minor unit integer`다.
- 즉, DB 타입을 승격하더라도 `소수 금액을 저장하자`는 뜻이 아니다.
- 소수점은 계산 중간값에서만 허용하고, 저장 전에는 `HALF_UP`으로 확정한다.

### 2. 공용 금액 모듈은 신규 workspace package로 분리한다

권장 위치는 신규 `packages/money`다.

이 패키지는 최소 아래 책임을 가진다.

- `MoneyWon` 공용 타입
- 입력 파싱과 검증
- 영속 레이어 변환
- 안전한 직렬화와 역직렬화
- 덧셈, 뺄셈, 비교, 합계, 부호 처리
- `HALF_UP` 반올림
- 금액 배분과 잔차 보정

`packages/contracts`는 계속 HTTP 요청/응답 계약의 역할을 우선하고, exact money runtime 로직은 새 패키지로 분리하는 편이 경계가 더 명확하다.

### 3. Prisma 금액 컬럼 승격의 1차 권장안은 `Decimal(19,0)`다

`BigInt`와 `Decimal(19,0)`를 둘 다 검토한 결과, 현재 저장소의 1차 권장안은 `Decimal(19,0)`다.

| 기준                                 | `BigInt`         | `Decimal(19,0)`         | 1차 판단             |
| ------------------------------------ | ---------------- | ----------------------- | -------------------- |
| `원 단위 정수` 의미 표현             | 좋음             | 좋음                    | 둘 다 가능           |
| Prisma 반환값 처리                   | JS `bigint`      | `Prisma.Decimal`        | `Decimal(19,0)` 우세 |
| JSON/Swagger 경계 호환성             | 직접 직렬화 불가 | number/string 변환 용이 | `Decimal(19,0)` 우세 |
| `decimal.js` exact arithmetic 연계   | 브리지 추가 필요 | 직접 연계 쉬움          | `Decimal(19,0)` 우세 |
| 현재 `number` 계약을 단계적으로 유지 | 불편             | 상대적으로 쉬움         | `Decimal(19,0)` 우세 |
| 향후 배분/반올림 정책 확장           | 별도 도구 필요   | 동일 도구로 처리 가능   | `Decimal(19,0)` 우세 |

정리하면 다음과 같다.

- 기본 구현 경로는 `Prisma money columns -> Decimal(19,0)`, `공용 연산 -> decimal.js`, `도메인 의미 -> MoneyWon`으로 간다.
- `BigInt`는 이후 HTTP 계약을 string 기반으로 바꾸는 큰 구조 변경을 수용할 때 다시 검토할 수 있다.

### 4. 외부 HTTP 계약은 1차로 `number`를 유지하되, safe integer 상한을 강제한다

1차 단계에서는 Web/API 계약을 한 번에 string 기반으로 바꾸지 않는다.

- 입력과 출력은 우선 `number`를 유지한다.
- 대신 금액 계약은 반드시 `Number.isSafeInteger`를 통과해야 한다.
- 공용 상한은 `Number.MAX_SAFE_INTEGER`로 고정한다.
- 운영 요구가 이 범위를 넘는 시점이 오면 그때 `MoneyWonSerialized = string` 전환을 별도 단계로 수행한다.

이 방식이면 현재 `Int` 한계를 먼저 제거하면서도, Web/API 전체를 한 번에 깨지 않고 순차적으로 이전할 수 있다.

## 범위

### 금액 컬럼 승격 범위

아래 컬럼은 이번 계획의 직접 범위에 포함한다.

| 모델                    | 필드                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `UserSetting`           | `minimumReserveWon`, `monthlySinkingFundWon`                                       |
| `Account`               | `balanceWon`                                                                       |
| `LegacyTransaction`     | `amountWon`                                                                        |
| `RecurringRule`         | `amountWon`                                                                        |
| `PlanItem`              | `plannedAmount`                                                                    |
| `CollectedTransaction`  | `amount`                                                                           |
| `JournalLine`           | `debitAmount`, `creditAmount`                                                      |
| `ClosingSnapshot`       | `totalAssetAmount`, `totalLiabilityAmount`, `totalEquityAmount`, `periodPnLAmount` |
| `BalanceSnapshotLine`   | `balanceAmount`                                                                    |
| `InsurancePolicy`       | `monthlyPremiumWon`                                                                |
| `Vehicle`               | `monthlyExpenseWon`                                                                |
| `FuelLog`               | `amountWon`, `unitPriceWon`                                                        |
| `VehicleMaintenanceLog` | `amountWon`                                                                        |

### 앱 계층 범위

- `apps/api`의 DTO, service, use-case, repository, mapper
- `apps/web`의 form schema, 입력 변환, 합계 표시, 업로드 preview 로직
- `packages/contracts`의 money 관련 계약 타입
- 신규 `packages/money`
- seed, mock, request test, prisma integration test, e2e smoke

### 범위 밖

- 외화 회계
- 세율 엔진
- 부가세 전용 모델
- 영수증 OCR
- `liters`, `estimatedFuelEfficiencyKmPerLiter` 같은 비금액 decimal 필드의 전면 재설계

비금액 decimal 필드는 이번 작업에서 `MoneyWon`으로 흡수하지 않는다.

## 단계별 실행계획

### Phase 0. 기준선 고정과 위험 노출

목적은 “무엇을 바꾸는가”보다 먼저 “무엇을 반드시 깨지지 않게 지킬 것인가”를 고정하는 것이다.

해야 할 일:

- 현재 금액 필드, 금액 계약, 금액 합산 지점을 인벤토리로 고정한다.
- `2_147_483_647` 경계값과 그보다 큰 금액에 대한 회귀 테스트 케이스를 먼저 추가한다.
- `HALF_UP`, 잔차 보정, 차변/대변 합계 일치 규칙을 테스트 이름으로 명시한다.
- `MoneyWon`의 외부 노출 정책이 `1차 number 유지`인지 문서와 테스트에 고정한다.

완료 기준:

- 고액 금액, 배분, 전표 합계, 마감 합계 관련 실패 재현 케이스가 먼저 존재한다.
- 이후 단계에서 실패하면 “어디가 깨졌는지” 바로 보이는 테스트 기준선이 생긴다.

### Phase 1. `MoneyWon` 공용 모듈 도입

권장 파일 구조:

- `packages/money/package.json`
- `packages/money/src/index.ts`
- `packages/money/src/money-won.ts`
- `packages/money/src/rounding.ts`
- `packages/money/src/serialization.ts`
- `packages/money/src/allocation.ts`

모듈이 제공해야 하는 최소 기능:

- `parseMoneyWon`
- `assertMoneyWon`
- `addMoneyWon`
- `subtractMoneyWon`
- `sumMoneyWon`
- `compareMoneyWon`
- `isZeroMoneyWon`
- `roundMoneyWonHalfUp`
- `allocateMoneyWon`
- `toApiMoneyWon`
- `fromApiMoneyWon`
- `toPrismaMoneyWon`
- `fromPrismaMoneyWon`

설계 원칙:

- business logic는 `Prisma.Decimal`를 직접 다루지 않는다.
- ORM 변환은 adapter/helper에만 둔다.
- display formatter는 money package가 아니라 Web formatter에 둔다.
- `MoneyWon`은 immutable하게 취급한다.

완료 기준:

- API와 Web이 같은 money helper를 import할 수 있다.
- 금액 파싱과 합계 계산을 새 helper로 작성하는 최소 예제가 저장소에 생긴다.

### Phase 2. 입력 경계와 검증 통일

목적은 “어디서 들어오든 같은 금액 검증을 적용한다”는 상태를 만드는 것이다.

우선 적용 범위:

- 수집 거래 생성/수정
- 반복규칙 생성/수정
- 보험 생성/수정
- 차량 연료/정비 입력
- 운영 기간 오프닝 잔액 입력
- 전표 정정 입력
- 업로드 배치 수집 preview/collect 파싱

실행 원칙:

- DTO의 `@IsInt()`, Web의 `z.coerce.number().int()`, 수입 파서의 `Number()`를 그대로 중복 확장하지 않는다.
- 공용 parser와 safe integer 검사를 우선 사용하고, DTO/Zod는 그 경계를 보조하는 역할로만 둔다.
- 금액 에러 메시지도 가능한 범위에서 공용 정책을 따르도록 맞춘다.

완료 기준:

- 수동 입력과 업로드 파싱이 같은 금액 허용 기준을 사용한다.
- `Number()` 직접 변환이 금액 입력 경계에서 대부분 제거된다.

### Phase 3. Prisma 금액 컬럼 승격

이 단계는 `schema first`가 아니라 `adapter first`로 진행한다.

권장 순서:

1. repository/mapper가 `number | Prisma.Decimal` 양쪽을 모두 받아도 동작하도록 먼저 적응시킨다.
2. 그 다음 Prisma schema의 금액 컬럼을 `Decimal @db.Decimal(19, 0)`으로 승격한다.
3. migration SQL과 seed, mock, prisma integration test를 같이 맞춘다.

주의사항:

- `CollectedTransaction.amount`처럼 이름이 일반적인 필드는 물리 rename보다 타입 승격을 먼저 한다.
- `liters`, `estimatedFuelEfficiencyKmPerLiter`는 이번 migration 대상이 아니다.
- JSON payload에 들어가는 재무제표 금액은 별도 컬럼이 아니므로, mapper/serializer 단계에서 정합성을 맞춘다.

완료 기준:

- 금액 컬럼이 더 이상 MySQL `Int` 한계에 묶이지 않는다.
- Prisma client 타입 변경 후에도 request test와 prisma integration test가 통과한다.

### Phase 4. 집계, 전표, 마감, 보고 연산 통일

이 단계에서 raw `number` 누적을 공용 연산으로 걷어낸다.

우선 적용 대상:

- `accounting-periods` closing snapshot 집계
- `financial-statements` payload 생성
- `journal-entries` 정정과 합계 일치 검증
- `import-batches` 금액 파싱과 collect 흐름
- `dashboard`, `forecast`, `reporting` 요약 집계
- Web의 오프닝 잔액 합계, 전표 정정 합계, 업로드 preview 금액 처리

도입 원칙:

- 영속 금액은 integer `MoneyWon`만 저장한다.
- 비율, 배분, 잔차 보정 같은 중간 계산은 `decimal.js`로 exact arithmetic를 사용한다.
- 저장 직전에는 `HALF_UP`과 잔차 보정 정책을 명시적으로 적용한다.
- 보고/조회 화면은 이미 확정된 금액을 그대로 사용하고, 화면에서 재반올림하지 않는다.

정적 가드:

- money package 밖에서 money field에 대한 raw `+`, `-`, `Number()`가 새로 들어오지 않게 lint 또는 스크립트 가드를 둔다.
- 후보 방식은 `scripts/check-money-ops.cjs` 또는 ESLint `no-restricted-syntax` 기반 규칙이다.

완료 기준:

- 전표 합계, 스냅샷 합계, 보고서 합계가 공용 money helper를 통해 계산된다.
- 배분/반올림/잔차 처리 규칙이 테스트와 코드에서 한 군데로 모인다.

### Phase 5. 계약 정리와 의미 이름 정돈

이 단계는 기능보다 가독성과 장기 유지성을 위한 정리 단계다.

해야 할 일:

- contracts에서 금액 필드 설명을 `MoneyWon` 정책과 맞춘다.
- Swagger 예시와 설명에 `원 단위 정수`, `safe integer`, `HALF_UP` 기준을 반영한다.
- 내부적으로 `amount`와 `amountWon`이 섞인 지점은 최소한 mapper 이름과 주석에서 의미를 분명히 한다.
- 필요하면 `MoneyWonSerialized` 전환 조건을 별도 문서화한다.

완료 기준:

- 새 팀원이 봐도 “어떤 값이 money인지, 어떤 값이 일반 number인지” 코드와 문서에서 구분된다.
- 문서, contracts, Swagger, 테스트 용어가 서로 어긋나지 않는다.

### Phase 6. 검증, 롤아웃, 운영 기준 고정

필수 검증:

- `npm run check:quick`
- `npm run test`
- `npm run build`
- `npm run test:e2e:smoke:build`
- `npm run test:prisma`

추가해야 할 대표 회귀 시나리오:

- `2_147_483_648원` 이상 금액이 입력, 저장, 조회, 집계에서 보존되는지
- `1000원 / 3` 같은 배분에서 `HALF_UP`과 잔차 보정으로 총액이 정확히 유지되는지
- 전표 정정 시 차변/대변 합이 exact equality로 맞는지
- closing snapshot의 `periodPnLAmount`가 음수인 경우도 합계가 보존되는지
- 업로드 배치의 콤마 포함 금액과 큰 금액이 같은 parser 기준으로 처리되는지

롤아웃 순서:

1. 공용 money package
2. API/Web 입력 경계 통일
3. repository adapter 준비
4. Prisma schema migration
5. exact arithmetic 전환
6. 문서와 CI 가드 마감

롤백 원칙:

- schema migration 전까지는 코드 롤백만으로 충분해야 한다.
- schema migration 후에도 값 의미가 바뀌지 않으므로, 문제 발생 시 우선 adapter와 serializer를 되돌리고 데이터 자체는 건드리지 않는다.
- 외부 계약을 string으로 바꾸는 단계는 이번 1차 범위에 넣지 않아, 롤백 범위를 불필요하게 넓히지 않는다.

## 권장 PR 묶음

실제 실행은 아래 정도의 PR 단위로 나누는 것을 권장한다.

1. `money-baseline-and-shared-module`
2. `money-validation-unification`
3. `money-schema-promotion`
4. `money-exact-arithmetic`
5. `money-docs-and-guards`

각 PR은 최소 `코드 + 테스트 + 문서` 세트를 같이 남긴다.

## 완료 기준

이 실행계획이 끝났다고 판단하는 기준은 아래와 같다.

- 핵심 금액 컬럼이 더 이상 `Int`에 머물지 않는다.
- 금액 입력 경계가 공용 parser와 safe integer 검사를 사용한다.
- 전표, 마감, 재무제표, 대시보드, 예측, 업로드 파싱의 금액 합산이 공용 money helper를 사용한다.
- `HALF_UP`과 잔차 보정 정책이 테스트로 고정된다.
- 문서, contracts, Swagger, seed, mock, prisma integration test, e2e smoke가 같은 money 정책을 설명한다.

## 후속 문서 반영 대상

실제 구현이 시작되면 최소 아래 문서를 같이 맞춘다.

- `docs/API.md`
- `docs/VALIDATION_NOTES.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_PLAN.md`
- 필요 시 `docs/adr/`

이 문서는 `2026-04-11` 완료 후 보관한 실행 이력 문서이며, 현재 운영 기준은 상단의 보관 상태에 적은 기준 문서를 우선한다.
