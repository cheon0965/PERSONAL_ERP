# API 개요

## 기준 우선순위

1. `packages/contracts`
   Web과 API가 함께 쓰는 요청/응답 shape의 1차 기준입니다.
2. Swagger: `/api/docs`
   현재 구현된 엔드포인트, DTO validation, 인증 노출 상태의 1차 기준입니다.
3. `docs/API.md`
   사람이 빠르게 읽는 엔드포인트 요약, 인증 흐름, 쓰기 흐름 설명을 유지합니다.

## 도메인 기준선

- 비즈니스 로직의 시작/끝, 상태, 권한, 마감/이월 정책의 1차 기준은 `docs/domain/business-logic-draft.md`입니다.
- 핵심 엔티티, 불변조건, 트랜잭션 경계, 반올림 정책의 1차 기준은 `docs/domain/core-entity-definition.md`입니다.
- 이 문서는 현재 HTTP surface와 구현 상태를 설명하며, 도메인 정책을 다시 정의하지 않습니다.

## Base URL

- API Prefix: `/api`
- Swagger: `/api/docs` (`SWAGGER_ENABLED=true`일 때, 기본값 `false`)

## 공통 운영 메타데이터

- 모든 API 응답에는 `x-request-id` 헤더가 포함됩니다.
- 클라이언트가 `x-request-id`를 보내면 같은 값을 그대로 유지합니다.
- 운영 추적이나 문제 재현 시 이 값을 기준으로 요청 로그를 연결합니다.

## 금액 계약

- HTTP 요청/응답의 금액은 1차 마이그레이션 범위에서 계속 `number`를 사용하되, 의미는 `MoneyWon`으로 고정합니다.
- `MoneyWon`은 KRW `원 단위 정수`이며 `Number.isSafeInteger` 범위를 통과해야 합니다.
- Prisma 영속 금액 컬럼은 `Decimal(19,0)`을 사용하고, API mapper 경계에서 `MoneyWon(number)`로 변환합니다.
- 소수 중간 계산이 필요한 반올림/배분은 `@personal-erp/money`의 `decimal.js` 기반 helper를 사용하며 저장 전 `HALF_UP`과 잔차 보정으로 정수 금액을 확정합니다.
- 대표 필드는 `amountWon`, `balanceWon`, `plannedAmount`, `balanceAmount`, `debitAmount`, `creditAmount`, `monthlyPremiumWon`, `unitPriceWon`입니다. `CollectedTransaction.amount`처럼 DB 컬럼명이 일반적인 경우에도 HTTP 계약에서는 `amountWon` 의미로 노출합니다.

## 인증 흐름

1. `POST /auth/login`으로 access token을 받고, HttpOnly refresh token 쿠키를 설정합니다.
2. 이후 보호 요청에는 `Authorization: Bearer <accessToken>`을 사용합니다.
3. Web은 access token을 메모리 런타임 상태에만 유지합니다.
4. 새로고침이나 `401` 이후 복구가 필요하면 `POST /auth/refresh`로 새 access token을 받습니다.
5. 현재 사용자 확인은 `GET /auth/me`를 사용합니다.

## 브라우저/API 경계 보안

- CORS는 `APP_ORIGIN` 또는 `CORS_ALLOWED_ORIGINS` allowlist만 허용하고, credential 요청을 지원합니다.
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`은 browser `Origin` 또는 `Referer`가 allowlist에 없으면 `403 Origin not allowed`를 반환합니다.
- 주요 API 응답에는 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`가 포함됩니다.
- `/api/docs`를 제외한 API 응답에는 기본 `Content-Security-Policy`가 포함됩니다.
- `APP_ORIGIN`이 HTTPS일 때는 `Strict-Transport-Security`를 함께 보냅니다.
- 인증/세션 응답과 Bearer 인증이 포함된 응답에는 `Cache-Control: no-store`가 적용됩니다.

## 공개 엔드포인트

- `GET /health`
- `GET /health/ready`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

## 현재 구현 범위 요약

- 기준/참조 범위는 조회 `auth/me`, `reference-data/readiness`, `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `insurance-policies`, `vehicles`, `vehicles/operating-summary`, `vehicles/maintenance-logs`와 자금수단/카테고리/보험 계약/차량 관리 `POST /funding-accounts`, `PATCH /funding-accounts/:id`, `POST /categories`, `PATCH /categories/:id`, `POST /insurance-policies`, `PATCH /insurance-policies/:id`, `DELETE /insurance-policies/:id`, `POST /vehicles`, `PATCH /vehicles/:id`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`까지 포함합니다.
- 운영/원장 조회 범위는 `accounting-periods`, `collected-transactions`, `journal-entries`, `plan-items`, `financial-statements`, `carry-forwards`, `import-batches`까지 포함합니다.
- 집계/보고 조회 범위는 `dashboard/summary`, `forecast/monthly`까지 포함합니다.
- 현재 쓰기/명령 범위는 `funding-accounts`, `categories`, `insurance-policies`, `vehicles`, `vehicle maintenance logs`, `accounting-periods`, `collected-transactions`, `recurring-rules`, `plan-items`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`까지 확장되어 있습니다.
- 즉, 현재 저장소의 API surface는 초기 reference-data/transactions 수준을 넘어 기준 데이터, 보험/차량 운영 기준, 반복 계획, 수집, 업로드 배치, 전표, 공식 보고, 차기 이월, 기간 전망까지 포함합니다.

## 보호 엔드포인트

아래 엔드포인트는 기본적으로 Bearer 토큰이 필요합니다.

### 인증/기준 데이터

- `GET /auth/me`
- `GET /reference-data/readiness`
- `GET /funding-accounts`
- `POST /funding-accounts`
- `PATCH /funding-accounts/:id`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `GET /account-subjects`
- `GET /ledger-transaction-types`
- `GET /insurance-policies`
- `POST /insurance-policies`
- `PATCH /insurance-policies/:id`
- `DELETE /insurance-policies/:id`
- `GET /vehicles`
- `GET /vehicles/operating-summary`
- `GET /vehicles/fuel-logs`
- `GET /vehicles/maintenance-logs`
- `POST /vehicles`
- `PATCH /vehicles/:id`
- `POST /vehicles/:id/fuel-logs`
- `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`
- `POST /vehicles/:id/maintenance-logs`
- `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`

### 월 운영/수집/전표

- `GET /accounting-periods`
- `GET /accounting-periods/current`
- `POST /accounting-periods`
- `POST /accounting-periods/:id/close`
- `POST /accounting-periods/:id/reopen`
- `GET /collected-transactions`
- `GET /collected-transactions/:id`
- `POST /collected-transactions`
- `PATCH /collected-transactions/:id`
- `DELETE /collected-transactions/:id`
- `POST /collected-transactions/:id/confirm`
- `GET /import-batches`
- `GET /import-batches/:id`
- `POST /import-batches`
- `POST /import-batches/:id/rows/:rowId/collect-preview`
- `POST /import-batches/:id/rows/:rowId/collect`
- `GET /journal-entries`
- `POST /journal-entries/:id/reverse`
- `POST /journal-entries/:id/correct`

### 계획/보고

- `GET /recurring-rules`
- `GET /recurring-rules/:id`
- `POST /recurring-rules`
- `PATCH /recurring-rules/:id`
- `DELETE /recurring-rules/:id`
- `GET /plan-items?periodId=<id>`
- `POST /plan-items/generate`
- `GET /financial-statements?periodId=<id>`
- `POST /financial-statements/generate`
- `GET /carry-forwards?fromPeriodId=<id>`
- `POST /carry-forwards/generate`
- `GET /dashboard/summary?periodId=<id>`
- `GET /forecast/monthly?periodId=<id>&month=YYYY-MM`

## Web 화면 경로와 API 모듈 대응

- Web `/dashboard` -> API `GET /dashboard/summary`
- Web `/periods` -> API `/accounting-periods`
- Web `/reference-data` -> API `/reference-data/readiness`, `/funding-accounts`, `/categories`, `/account-subjects`, `/ledger-transaction-types`
- Web `/reference-data/manage` -> API `/funding-accounts`, `/categories`, `/account-subjects`, `/ledger-transaction-types`
- Web `/recurring` -> API `/recurring-rules`
- Web `/plan-items` -> API `/plan-items`
- Web `/transactions` -> API `/collected-transactions`
- Web `/imports` -> API `/import-batches`
- Web `/journal-entries` -> API `/journal-entries`
- Web `/financial-statements` -> API `/financial-statements`
- Web `/carry-forwards` -> API `/carry-forwards`
- Web `/insurances` -> API `/insurance-policies`
- Web `/vehicles` -> API `/vehicles`
- Web `/forecast` -> API `GET /forecast/monthly`
- Web 라우트의 shorthand 이름과 Swagger/API module 이름이 다를 수 있으며, 계약과 백엔드 모듈명은 API 경로 기준으로 봅니다.

## 현재 쓰기/명령 엔드포인트

### `POST /accounting-periods`

- 계약: `OpenAccountingPeriodRequest -> AccountingPeriodItem`
- 선택한 `month`의 운영 기간을 열고, 필요하면 opening balance 초기화를 시작합니다.

### `POST /accounting-periods/:id/close`

- 계약: `CloseAccountingPeriodRequest -> CloseAccountingPeriodResponse`
- 운영 기간을 잠그고 closing snapshot을 생성합니다.
- 공식 `financial-statements`와 `carry-forwards`의 선행 조건입니다.

### `POST /accounting-periods/:id/reopen`

- 계약: `ReopenAccountingPeriodRequest -> AccountingPeriodItem`
- 잠금된 운영 기간을 사유와 함께 다시 엽니다.

### `GET /reference-data/readiness`

- 계약: response `ReferenceDataReadinessSummary`
- 현재 작업 문맥 기준으로 자금수단, 수입/지출 카테고리, 계정과목, 거래유형 readiness를 서버에서 판정합니다.
- 현재 구현은 기준 데이터 ownership를 `사용자 준비 책임`과 `system-managed`로 구분해 함께 돌려줍니다.
- 현재 `inProductEditEnabled`는 자금수단과 수입/지출 카테고리가 모두 `true`이며, 계정과목/거래유형은 `false`로 유지됩니다.

### `GET /funding-accounts`

- 계약: response `FundingAccountItem[]`
- 현재 작업 문맥 기준 활성 자금수단만 반환합니다.
- `?includeInactive=true`를 주면 비활성/종료 자금수단까지 함께 반환합니다.

### `POST /funding-accounts`

- 계약: `CreateFundingAccountRequest -> FundingAccountItem`
- 현재 작업 문맥의 Owner/Manager만 새 자금수단을 생성할 수 있습니다.
- 현재 범위는 `name`, `type` 생성과 활성 상태 기본값(`ACTIVE`), 초기 잔액 `0원`까지로 한정합니다.

### `PATCH /funding-accounts/:id`

- 계약: `UpdateFundingAccountRequest -> FundingAccountItem`
- 현재 작업 문맥의 Owner/Manager만 자금수단 이름 변경과 `ACTIVE/INACTIVE/CLOSED` 상태 전환을 수행할 수 있습니다.
- 현재 범위에서 `CLOSED` 전환은 `INACTIVE -> CLOSED`일 때만 허용합니다.
- `CLOSED` 자금수단은 기존 거래/반복 규칙 기록 보존용 읽기 전용 상태로 유지하며, 현재 범위에서는 다시 수정하거나 재활성화할 수 없습니다.
- 현재 범위는 `type` 변경, 잔액 직접 수정, 하드 삭제를 지원하지 않습니다.

### `GET /categories`

- 계약: response `CategoryItem[]`
- 현재 작업 문맥 기준 활성 카테고리만 반환합니다.
- `?includeInactive=true`를 주면 비활성 카테고리까지 함께 반환합니다.

### `POST /categories`

- 계약: `CreateCategoryRequest -> CategoryItem`
- 현재 작업 문맥의 Owner/Manager만 새 카테고리를 생성할 수 있습니다.
- 현재 범위는 `name`, `kind` 생성과 활성 상태 기본값(`true`)까지로 한정합니다.

### `PATCH /categories/:id`

- 계약: `UpdateCategoryRequest -> CategoryItem`
- 현재 작업 문맥의 Owner/Manager만 카테고리 이름 변경과 활성/비활성 전환을 수행할 수 있습니다.
- 현재 범위는 `kind` 변경과 하드 삭제를 지원하지 않습니다.

### `GET /insurance-policies`

- 계약: response `InsurancePolicyItem[]`
- 현재 작업 문맥 기준 활성 보험 계약만 반환합니다.
- `?includeInactive=true`를 주면 비활성 보험 계약까지 함께 반환합니다.

### `POST /insurance-policies`

- 계약: `CreateInsurancePolicyRequest -> InsurancePolicyItem`
- 현재 작업 문맥의 Owner/Manager만 새 보험 계약을 생성할 수 있습니다.
- 현재 범위는 `provider`, `productName`, `monthlyPremiumWon`, `paymentDay`, `cycle`, `renewalDate`, `maturityDate`, `isActive`까지의 운영 보조 필드 관리로 한정합니다.

### `PATCH /insurance-policies/:id`

- 계약: `UpdateInsurancePolicyRequest -> InsurancePolicyItem`
- 현재 작업 문맥의 Owner/Manager만 보험 계약 기준 필드와 활성/비활성 상태를 수정할 수 있습니다.
- 현재 범위는 비활성 계약도 `?includeInactive=true` 목록과 수정 흐름에서 계속 관리할 수 있으며, 삭제가 필요하면 별도 `DELETE /insurance-policies/:id` 흐름을 사용합니다.

### `DELETE /insurance-policies/:id`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner/Manager만 보험 계약을 삭제할 수 있습니다.
- 현재 구현은 보험 계약과 연결된 반복 규칙이 있으면 함께 삭제해 이후 자동 생성 기준에서도 제거합니다.

### `GET /vehicles`

- 계약: response `VehicleItem[]`
- 현재 작업 문맥 기준 차량 기본 프로필만 반환합니다.
- 현재 범위는 차량 기본 정보 관리에 집중하며, 운영비/연비 요약은 별도 summary projection으로 분리합니다.
- 연료 이력과 정비 이력은 각각 별도 운영 기록 API로 분리합니다.

### `GET /vehicles/operating-summary`

- 계약: response `VehicleOperatingSummaryView`
- 현재 작업 문맥 기준 차량별 운영 요약 read model을 반환합니다.
- 현재 구현은 연료 이력 비용 합계, 정비 이력 비용 합계, 기록 기반 운영비, 최근 이력 날짜, 입력 기준 연비/기록 기준 연비를 함께 요약합니다.
- 이 응답은 차량 프로필 write model을 대체하지 않고, `/vehicles` 화면 상단 카드와 차트 같은 운영 보조 지표를 분리해 읽기 위한 projection입니다.

### `POST /vehicles`

- 계약: `CreateVehicleRequest -> VehicleItem`
- 현재 작업 문맥의 Owner/Manager만 새 차량 기본 정보를 생성할 수 있습니다.
- 현재 범위는 `name`, `manufacturer`, `fuelType`, `initialOdometerKm`, `estimatedFuelEfficiencyKmPerLiter`까지의 차량 기본 프로필 관리로 한정하며 연료/정비 이력 생성은 별도 계약으로 분리합니다.
- 운영비 요약은 `VehicleItem`이 아니라 `/vehicles/operating-summary` projection에서 읽습니다.

### `PATCH /vehicles/:id`

- 계약: `UpdateVehicleRequest -> VehicleItem`
- 현재 작업 문맥의 Owner/Manager만 차량 기본 정보를 수정할 수 있습니다.
- 현재 범위는 차량 프로필 필드만 조정하며, 차량 세부 운영 이력과 하드 삭제는 지원하지 않습니다.
- 즉, 현재 수정 흐름은 차량 프로필 관리에만 집중하고, 연료/정비 이력은 별도 운영 모델로 관리합니다.
- 운영비/연비 보조 지표는 수정 응답이 아니라 별도 summary projection에서 해석합니다.

### `GET /vehicles/fuel-logs`

- 계약: response `VehicleFuelLogItem[]`
- 현재 작업 문맥 기준 차량 연료 이력을 workspace 범위로 모아 반환합니다.
- 연료 이력은 차량 기본 정보 응답과 분리된 별도 운영 기록 모델이며, 차량명은 read model 편의를 위해 함께 내려갑니다.

### `POST /vehicles/:id/fuel-logs`

- 계약: `CreateVehicleFuelLogRequest -> VehicleFuelLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량에 연료 이력을 추가할 수 있습니다.
- 현재 범위는 `filledOn`, `odometerKm`, `liters`, `amountWon`, `unitPriceWon`, `isFullTank`까지의 최소 운영 기록 필드만 지원합니다.

### `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`

- 계약: `UpdateVehicleFuelLogRequest -> VehicleFuelLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 연료 이력을 수정할 수 있습니다.
- 현재 범위는 연료 이력 수정만 지원하며, 삭제와 회계 자동 매칭은 후속 단계로 남겨 둡니다.

### `GET /vehicles/maintenance-logs`

- 계약: response `VehicleMaintenanceLogItem[]`
- 현재 작업 문맥 기준 차량 정비 이력을 workspace 범위로 모아 반환합니다.
- 정비 이력은 차량 기본 정보 응답과 분리된 별도 운영 기록 모델이며, 차량명은 read model 편의를 위해 함께 내려갑니다.

### `POST /vehicles/:id/maintenance-logs`

- 계약: `CreateVehicleMaintenanceLogRequest -> VehicleMaintenanceLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량에 정비 이력을 추가할 수 있습니다.
- 현재 범위는 `performedOn`, `odometerKm`, `category`, `vendor`, `description`, `amountWon`, `memo`까지의 최소 운영 기록 필드만 지원합니다.

### `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`

- 계약: `UpdateVehicleMaintenanceLogRequest -> VehicleMaintenanceLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 정비 이력을 수정할 수 있습니다.
- 현재 범위는 정비 이력 수정만 지원하며, 삭제와 회계 자동 매칭은 후속 단계로 남겨 둡니다.

### `POST /collected-transactions`

- 계약: `CreateCollectedTransactionRequest -> CollectedTransactionItem`
- 현재 수집 가능한 운영 기간 안에서 수집 거래를 생성합니다.
- 현재 API 구현 이름은 `collected-transactions`이고, Web 화면 경로는 shorthand로 `/transactions`를 사용합니다.
- 현재 응답은 `GET /collected-transactions` 목록 아이템 shape와 동일하게 매핑됩니다.
- 기준 데이터 readiness가 부족한 경우에도 현재 구현은 저장 요청 자체를 일괄 차단하지는 않지만, Web은 `reference-data/readiness`를 기준으로 준비 부족 안내와 이동 링크를 함께 노출합니다.

### `GET /collected-transactions/:id`

- 계약: response `CollectedTransactionDetailItem`
- 특정 수집 거래의 상세 값을 읽습니다.
- 현재 Web 드로어 수정 흐름은 이 상세 응답을 기준으로 초기값을 채웁니다.

### `PATCH /collected-transactions/:id`

- 계약: `UpdateCollectedTransactionRequest -> CollectedTransactionItem`
- 미확정 상태(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)의 수집 거래를 수정합니다.
- 현재 운영 기간 안의 거래일만 허용하며, 이미 전표로 확정된 거래는 수정할 수 없습니다.

### `DELETE /collected-transactions/:id`

- 계약: response body 없음 (`204 No Content`)
- 미확정 상태(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)의 수집 거래를 삭제합니다.
- 이미 전표로 이어진 거래는 삭제 대신 전표 정정/반전 흐름으로 처리해야 합니다.

### `POST /collected-transactions/:id/confirm`

- 계약: request body 없음 -> `JournalEntryItem`
- 수집 거래를 확정해 `JournalEntry`를 생성합니다.
- 연결된 `PlanItem`이 있으면 현재 구현은 해당 항목을 `CONFIRMED`로 갱신합니다.

### `POST /recurring-rules`

- 계약: `CreateRecurringRuleRequest -> RecurringRuleItem`
- 반복 규칙을 등록합니다.
- 현재 엔드포인트는 도메인 기준의 `RecurringRule -> PlanItem` 생성 흐름의 입력 단계 구현입니다.

### `GET /recurring-rules/:id`

- 계약: response `RecurringRuleDetailItem`
- 특정 반복 규칙의 상세 값을 읽습니다.
- 현재 Web 드로어 수정 흐름은 이 상세 응답을 기준으로 초기값을 채웁니다.

### `PATCH /recurring-rules/:id`

- 계약: `UpdateRecurringRuleRequest -> RecurringRuleItem`
- 반복 규칙의 제목, 금액, 주기, 기준 계정을 수정합니다.
- 수정 결과는 이후 생성되는 `PlanItem` 기준에 반영됩니다.

### `DELETE /recurring-rules/:id`

- 계약: response body 없음 (`204 No Content`)
- 반복 규칙을 삭제하고 이후 자동 생성 기준에서 제외합니다.
- 현재 구현은 이미 생성된 `PlanItem` 자체를 삭제하지 않고, 규칙 참조만 분리합니다.

### `POST /plan-items/generate`

- 계약: `GeneratePlanItemsRequest -> GeneratePlanItemsResponse`
- 선택한 운영 기간에 대해 활성 `RecurringRule`로부터 `PlanItem`을 생성합니다.
- 같은 규칙/예정일 조합이 이미 있으면 건너뛰고, 기본 거래유형을 해석할 수 없는 규칙은 제외합니다.

### `POST /import-batches`

- 계약: `CreateImportBatchRequest -> ImportBatchItem`
- 업로드 내용을 파싱해 배치와 행 단위 parse 결과를 저장합니다.
- 현재 row read model은 이미 승격된 행이면 수집 거래 상태, 연결된 계획 항목, 적용 카테고리 요약까지 함께 돌려줍니다.

### `POST /import-batches/:id/rows/:rowId/collect-preview`

- 계약: `CollectImportedRowRequest -> CollectImportedRowPreview`
- 파싱 완료된 업로드 행을 실제 승격 전에 평가합니다.
- 현재 구현은 계획 항목 자동 매칭 후보, 적용 카테고리, 예상 다음 상태, duplicate fingerprint 보류 여부, 설명용 decision reason 목록을 함께 반환합니다.

### `POST /import-batches/:id/rows/:rowId/collect`

- 계약: `CollectImportedRowRequest -> CollectImportedRowResponse`
- 파싱 완료된 업로드 행을 수집 거래로 승격합니다.
- 현재 응답은 생성된 `CollectedTransactionItem`뿐 아니라, 같은 요청 기준의 자동 판정 preview도 함께 돌려줍니다.
- 현재 구현은 source fingerprint 기반 중복 감지, 미확정 계획 항목(`PlanItem`) 자동 매칭, 카테고리/상태 자동 준비를 포함합니다.

### `POST /journal-entries/:id/reverse`

- 계약: `ReverseJournalEntryRequest -> JournalEntryItem`
- 기존 전표에 대한 reversal adjustment 전표를 생성합니다.

### `POST /journal-entries/:id/correct`

- 계약: `CorrectJournalEntryRequest -> JournalEntryItem`
- 수정 사유와 line 입력으로 correction 전표를 생성합니다.

### `POST /financial-statements/generate`

- 계약: `GenerateFinancialStatementSnapshotsRequest -> FinancialStatementsView`
- 잠금된 운영 기간과 closing snapshot이 있을 때 공식 재무제표 snapshot을 생성하거나 갱신합니다.

### `POST /carry-forwards/generate`

- 계약: `GenerateCarryForwardRequest -> CarryForwardView`
- 잠금된 운영 기간의 closing snapshot을 다음 기간 opening balance snapshot으로 이월합니다.
- 현재 구현은 `carryForwardRecord`와 opening balance snapshot 생성까지 포함하며, `createdJournalEntryId`는 아직 `null`일 수 있습니다.

## 현재 구현 흐름

### `reference-data -> accounting-periods -> insurance/vehicles -> recurring-rules -> plan-items -> collected-transactions/imports -> journal-entries -> financial-statements -> carry-forwards -> forecast`

1. `GET /reference-data/readiness`, `POST /funding-accounts`, `POST /categories`로 기준 데이터 준비 상태를 확인하고 필요한 자금수단/카테고리를 정리합니다.
2. `POST /accounting-periods`로 운영 기간을 엽니다.
3. `POST /insurance-policies`, `POST /vehicles`, `POST /vehicles/:id/fuel-logs`, `POST /vehicles/:id/maintenance-logs`로 보험 계약과 차량 운영 기준을 정리합니다.
4. `POST /recurring-rules`와 `POST /plan-items/generate`로 반복 규칙을 현재 월 계획 항목으로 펼치고, 계획 기반 수집 거래까지 생성합니다.
5. `POST /collected-transactions` 또는 `POST /import-batches/:id/rows/:rowId/collect`로 현재 기간의 수집 거래를 만들거나 업로드 행을 계획 기반 수집 거래에 흡수/매칭합니다.
6. 필요하면 `GET/PATCH/DELETE /collected-transactions/:id`로 미확정(`COLLECTED`, `REVIEWED`, `READY_TO_POST`) 수집 거래를 상세 조회, 수정, 삭제합니다.
7. `POST /collected-transactions/:id/confirm`로 수집 거래를 `JournalEntry`로 확정합니다. 계획 항목 화면의 바로 확정도 내부적으로 이 경로를 사용합니다.
8. 필요하면 `POST /journal-entries/:id/reverse` 또는 `POST /journal-entries/:id/correct`로 전표 조정을 수행합니다.
9. `POST /accounting-periods/:id/close`로 운영 기간을 잠그고 closing snapshot을 만듭니다.
10. `POST /financial-statements/generate`로 잠금 기간의 공식 재무제표 snapshot을 생성합니다.
11. `POST /carry-forwards/generate`로 다음 기간 opening balance snapshot과 carry-forward record를 생성합니다.
12. `GET /forecast/monthly`로 현재 월과 다음 달 전망을 확인합니다.
13. 필요하면 `POST /accounting-periods/:id/reopen`로 잠금 기간을 다시 엽니다.

### `recurring-rules -> plan-items -> collected-transactions`

1. `POST /recurring-rules`로 반복 규칙을 등록합니다.
2. 필요하면 `GET/PATCH/DELETE /recurring-rules/:id`로 기존 반복 규칙을 상세 조회, 수정, 삭제합니다.
3. `POST /plan-items/generate`로 특정 기간의 `PlanItem`과 연결된 반복성 수집 거래를 생성합니다.
4. 현재 `PlanItemsView.items[]`는 매칭된 수집 거래 ID/제목/상태와 생성된 전표 ID/번호까지 함께 실어 보냅니다.
5. import collect 단계에서 현재 구현은 `collect-preview`와 `collect` 모두에서 미확정 계획 항목(`PlanItem`) 자동 매칭을 수행할 수 있습니다.
6. `POST /collected-transactions/:id/confirm`가 실행되면 매칭된 `PlanItem`은 `CONFIRMED`로 갱신됩니다.
7. `GET /dashboard/summary`와 `GET /forecast/monthly`는 위 운영/계획 데이터를 projection한 읽기 모델이며, 직접 쓰기 흐름에 참여하지 않습니다.

## 접근 범위와 데이터 최소 노출

- 모든 보호 엔드포인트는 `user.currentWorkspace`에서 선택된 `tenantId`, `ledgerId`, `membershipId`, `membershipRole` 문맥을 기준으로 동작합니다.
- 현재 구현은 단순 user-scoped 전단계가 아니라 workspace-scoped tenant/ledger 모델을 사용합니다.
- 조회 엔드포인트는 인증된 workspace 범위 내 데이터만 반환합니다.
- `insurance-policies`, `vehicles`도 개인 생활용 고정 데이터가 아니라 현재 workspace/ledger 기준 사업 운영 보조 자산 데이터만 반환합니다.
- 쓰기 권한은 workspace membership role로 제어합니다.
- `OWNER`, `MANAGER`: `funding_account.create`, `funding_account.update`, `category.create`, `category.update`, `insurance_policy.create`, `insurance_policy.update`, `insurance_policy.delete`, `vehicle.create`, `vehicle.update`, `accounting_period.open`, `recurring_rule.create`, `plan_item.generate`, `financial_statement.generate`, `carry_forward.generate`, `journal_entry.reverse`, `journal_entry.correct`
- `OWNER`: `accounting_period.close`, `accounting_period.reopen`
- `OWNER`, `MANAGER`, `EDITOR`: `collected_transaction.create`, `collected_transaction.confirm`, `import_batch.upload`
- `CollectedTransactionItem`, `RecurringRuleItem`, `JournalEntryItem`, `PlanItemsView`, `FinancialStatementsView`, `CarryForwardView`, `DashboardSummary`, `ForecastResponse`는 raw table 전체가 아니라 API view/projection shape를 응답합니다.
- 예외적으로 `ImportBatchItem.rows[].rawPayload`는 업로드 검수 목적상 현재 응답에 포함됩니다.
- 접근통제 실패는 `404` 또는 `401/403`으로 처리하고, 보안 이벤트 로그와 함께 남깁니다.

## 문서화 원칙

- 공유 요청/응답 shape가 바뀌면 `packages/contracts`를 먼저 수정합니다.
- API 구현이 바뀌면 Swagger 노출 상태와 이 문서를 같은 PR에서 함께 맞춥니다.
- 검증 범위가 바뀌면 `docs/VALIDATION_NOTES.md`도 함께 갱신합니다.
- 빠른 시작이나 저장소 진입 설명은 `README.md`, 상세 구현 절차는 `docs/DEVELOPMENT_GUIDE.md`에 유지합니다.
