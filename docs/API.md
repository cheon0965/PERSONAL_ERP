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
- Swagger: `/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 공통 운영 메타데이터

- 모든 API 응답에는 `x-request-id` 헤더가 포함됩니다.
- 클라이언트가 `x-request-id`를 보내면 같은 값을 그대로 유지합니다.
- 운영 추적이나 문제 재현 시 이 값을 기준으로 요청 로그를 연결합니다.

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

- 기준/참조 조회 범위는 `auth/me`, `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `insurance-policies`, `vehicles`까지 포함합니다.
- 운영/원장 조회 범위는 `accounting-periods`, `collected-transactions`, `journal-entries`, `plan-items`, `financial-statements`, `carry-forwards`, `import-batches`까지 포함합니다.
- 집계/보고 조회 범위는 `dashboard/summary`, `forecast/monthly`까지 포함합니다.
- 현재 쓰기/명령 범위는 `accounting-periods`, `collected-transactions`, `recurring-rules`, `plan-items`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`까지 확장되어 있습니다.
- 즉, 현재 저장소의 API surface는 초기 reference-data/transactions 수준을 넘어 월 운영, 수집, 전표, 계획, 공식 보고, 차기 이월, 업로드 배치까지 포함합니다.

## 보호 엔드포인트

아래 엔드포인트는 기본적으로 Bearer 토큰이 필요합니다.

### 인증/기준 데이터

- `GET /auth/me`
- `GET /funding-accounts`
- `GET /categories`
- `GET /account-subjects`
- `GET /ledger-transaction-types`
- `GET /insurance-policies`
- `GET /vehicles`

### 월 운영/수집/전표

- `GET /accounting-periods`
- `GET /accounting-periods/current`
- `POST /accounting-periods`
- `POST /accounting-periods/:id/close`
- `POST /accounting-periods/:id/reopen`
- `GET /collected-transactions`
- `POST /collected-transactions`
- `POST /collected-transactions/:id/confirm`
- `GET /import-batches`
- `GET /import-batches/:id`
- `POST /import-batches`
- `POST /import-batches/:id/rows/:rowId/collect`
- `GET /journal-entries`
- `POST /journal-entries/:id/reverse`
- `POST /journal-entries/:id/correct`

### 계획/보고

- `GET /recurring-rules`
- `POST /recurring-rules`
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
- Web `/reference-data` -> API `/funding-accounts`, `/categories`, `/account-subjects`, `/ledger-transaction-types`
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

### `POST /collected-transactions`

- 계약: `CreateCollectedTransactionRequest -> CollectedTransactionItem`
- 현재 수집 가능한 운영 기간 안에서 수집 거래를 생성합니다.
- 현재 API 구현 이름은 `collected-transactions`이고, Web 화면 경로는 shorthand로 `/transactions`를 사용합니다.
- 현재 응답은 `GET /collected-transactions` 목록 아이템 shape와 동일하게 매핑됩니다.

### `POST /collected-transactions/:id/confirm`

- 계약: request body 없음 -> `JournalEntryItem`
- 수집 거래를 확정해 `JournalEntry`를 생성합니다.
- 연결된 `PlanItem`이 있으면 현재 구현은 해당 항목을 `CONFIRMED`로 갱신합니다.

### `POST /recurring-rules`

- 계약: `CreateRecurringRuleRequest -> RecurringRuleItem`
- 반복 규칙을 등록합니다.
- 현재 엔드포인트는 도메인 기준의 `RecurringRule -> PlanItem` 생성 흐름의 입력 단계 구현입니다.

### `POST /plan-items/generate`

- 계약: `GeneratePlanItemsRequest -> GeneratePlanItemsResponse`
- 선택한 운영 기간에 대해 활성 `RecurringRule`로부터 `PlanItem`을 생성합니다.
- 같은 규칙/예정일 조합이 이미 있으면 건너뛰고, 기본 거래유형을 해석할 수 없는 규칙은 제외합니다.

### `POST /import-batches`

- 계약: `CreateImportBatchRequest -> ImportBatchItem`
- 업로드 내용을 파싱해 배치와 행 단위 parse 결과를 저장합니다.

### `POST /import-batches/:id/rows/:rowId/collect`

- 계약: `CollectImportedRowRequest -> CollectedTransactionItem`
- 파싱 완료된 업로드 행을 수집 거래로 승격합니다.
- 현재 구현은 source fingerprint 기반 중복 감지, draft `PlanItem` 자동 매칭, 카테고리/상태 자동 준비를 포함합니다.

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

### `accounting-periods -> collected-transactions -> journal-entries -> financial-statements -> carry-forwards`

1. `POST /accounting-periods`로 운영 기간을 엽니다.
2. `POST /collected-transactions` 또는 `POST /import-batches/:id/rows/:rowId/collect`로 현재 기간의 수집 거래를 만듭니다.
3. `POST /collected-transactions/:id/confirm`로 수집 거래를 `JournalEntry`로 확정합니다.
4. 필요하면 `POST /journal-entries/:id/reverse` 또는 `POST /journal-entries/:id/correct`로 전표 조정을 수행합니다.
5. `POST /accounting-periods/:id/close`로 운영 기간을 잠그고 closing snapshot을 만듭니다.
6. `POST /financial-statements/generate`로 잠금 기간의 공식 재무제표 snapshot을 생성합니다.
7. `POST /carry-forwards/generate`로 다음 기간 opening balance snapshot과 carry-forward record를 생성합니다.
8. 필요하면 `POST /accounting-periods/:id/reopen`로 잠금 기간을 다시 엽니다.

### `recurring-rules -> plan-items -> collected-transactions`

1. `POST /recurring-rules`로 반복 규칙을 등록합니다.
2. `POST /plan-items/generate`로 특정 기간의 draft `PlanItem`을 생성합니다.
3. import collect 단계에서 현재 구현은 draft `PlanItem` 자동 매칭을 수행할 수 있습니다.
4. `POST /collected-transactions/:id/confirm`가 실행되면 매칭된 `PlanItem`은 `CONFIRMED`로 갱신됩니다.
5. `GET /dashboard/summary`와 `GET /forecast/monthly`는 위 운영/계획 데이터를 projection한 읽기 모델이며, 직접 쓰기 흐름에 참여하지 않습니다.

## 접근 범위와 데이터 최소 노출

- 모든 보호 엔드포인트는 `user.currentWorkspace`에서 선택된 `tenantId`, `ledgerId`, `membershipId`, `membershipRole` 문맥을 기준으로 동작합니다.
- 현재 구현은 단순 user-scoped 전단계가 아니라 workspace-scoped tenant/ledger 모델을 사용합니다.
- 조회 엔드포인트는 인증된 workspace 범위 내 데이터만 반환합니다.
- 쓰기 권한은 workspace membership role로 제어합니다.
- `OWNER`, `MANAGER`: `accounting_period.open`, `recurring_rule.create`, `plan_item.generate`, `financial_statement.generate`, `carry_forward.generate`, `journal_entry.reverse`, `journal_entry.correct`
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
