# API 개요

## 기준 우선순위

1. `packages/contracts`
   Web과 API가 함께 쓰는 요청/응답 shape의 1차 기준입니다.
2. Swagger: `/api/docs`
   현재 구현된 엔드포인트, DTO validation, 인증 노출 상태의 1차 기준입니다.
3. `docs/API.md`
   사람이 빠르게 읽는 엔드포인트 요약, 인증 흐름, 쓰기 흐름 설명을 유지합니다.

기능과 운영 범위의 상위 요약은 `docs/CURRENT_CAPABILITIES.md`를 함께 봅니다.

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
- CORS credential 요청에서도 Web이 요청번호를 읽을 수 있도록 `x-request-id`를 노출 헤더로 공개합니다.
- Web 공통 요청 계층은 HTTP 오류를 사용자용 메시지와 개발자 진단 정보로 나눠 표시합니다.
- 개발자 진단 정보에는 `errorCode`, HTTP 상태, 요청 메서드/경로, `requestId`, 서버 오류 항목, validator 원본 항목, 원본 기술 메시지, 원본 응답 본문이 포함될 수 있으며 화면에서는 기본 접힘 상태로 노출합니다.

## 동시성/충돌 응답 원칙

- 현재 구현은 주요 unique 충돌을 Prisma raw 500으로 그대로 내보내지 않고 `409 Conflict`로 정리합니다.
- 전표 번호, 계획 항목 recurring occurrence, 업로드 행 재수집, 반복 수집 거래 흡수, 기간/차기 이월 중복, 주요 마스터 이름 중복이 여기에 포함됩니다.
- 대표 메시지 예:
  - `동시에 다른 전표가 먼저 기록되었습니다. 다시 시도해 주세요.`
  - `해당 반복 규칙과 예정일의 계획 항목이 이미 생성되었습니다.`
  - `이미 수집 거래로 승격된 업로드 행입니다.`
  - `이미 다른 업로드 행과 연결된 반복 수집 거래입니다. 다시 새로고침해 주세요.`
  - `같은 이름의 자금수단이 이미 있습니다.`
  - `같은 구분에 동일한 카테고리 이름이 이미 있습니다.`

## 금액 계약

- HTTP 요청/응답의 금액은 1차 마이그레이션 범위에서 계속 `number`를 사용하되, 의미는 `MoneyWon`으로 고정합니다.
- `MoneyWon`은 KRW `원 단위 정수`이며 `Number.isSafeInteger` 범위를 통과해야 합니다.
- Prisma 영속 금액 컬럼은 `Decimal(19,0)`을 사용하고, API mapper 경계에서 `MoneyWon(number)`로 변환합니다.
- 소수 중간 계산이 필요한 반올림/배분은 `@personal-erp/money`의 `decimal.js` 기반 helper를 사용하며 저장 전 `HALF_UP`과 잔차 보정으로 정수 금액을 확정합니다.
- 대표 필드는 `amountWon`, `balanceWon`, `plannedAmount`, `balanceAmount`, `debitAmount`, `creditAmount`, `monthlyPremiumWon`, `unitPriceWon`입니다. `CollectedTransaction.amount`처럼 DB 컬럼명이 일반적인 경우에도 HTTP 계약에서는 `amountWon` 의미로 노출합니다.

## 인증 흐름

1. 신규 사용자는 `POST /auth/register`로 가입 요청을 만들고 이메일 인증 메일을 받습니다.
2. 인증 링크는 Web `/verify-email?token=<token>`으로 열리고, Web은 `POST /auth/verify-email`로 토큰을 검증합니다.
3. 인증 링크가 만료되었거나 다시 받아야 하면 `POST /auth/resend-verification`을 사용합니다.
4. 사업장 초대 링크는 Web `/accept-invitation?token=<token>`으로 열리고, Web은 `POST /auth/accept-invitation`으로 토큰을 검증합니다.
5. 이메일 인증이나 초대 수락이 끝난 사용자는 `POST /auth/login`으로 access token을 받고, HttpOnly refresh token 쿠키를 설정합니다.
6. 이후 보호 요청에는 `Authorization: Bearer <accessToken>`을 사용합니다.
7. Web은 access token을 메모리 런타임 상태에만 유지합니다.
8. 새로고침이나 `401` 이후 복구가 필요하면 `POST /auth/refresh`로 새 access token을 받습니다.
9. 현재 사용자 확인은 `GET /auth/me`를 사용합니다.
10. 한 사용자가 여러 사업장에 속하면 `GET /auth/workspaces`로 접근 가능한 사업장을 확인하고, `POST /auth/workspaces`, `DELETE /auth/workspaces/:tenantId`, `POST /auth/current-workspace`로 사업장 생성/삭제와 현재 세션 작업 문맥 전환을 처리합니다.

## 브라우저/API 경계 보안

- CORS는 `APP_ORIGIN` 또는 `CORS_ALLOWED_ORIGINS` allowlist만 허용하고, credential 요청을 지원합니다.
- `POST /auth/register`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/accept-invitation`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`은 browser `Origin` 또는 `Referer`가 allowlist에 없으면 `403 Origin not allowed`를 반환합니다.
- 주요 API 응답에는 `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`가 포함됩니다.
- `/api/docs`를 제외한 API 응답에는 기본 `Content-Security-Policy`가 포함됩니다.
- `APP_ORIGIN`이 HTTPS일 때는 `Strict-Transport-Security`를 함께 보냅니다.
- 인증/세션 응답과 Bearer 인증이 포함된 응답에는 `Cache-Control: no-store`가 적용됩니다.

## 공개 엔드포인트

- `GET /health`
- `GET /health/ready`
- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `POST /auth/accept-invitation`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`

`POST /auth/register`는 `email`, `password`, `name`과 함께 필수 동의값
`termsAccepted: true`, `privacyConsentAccepted: true`를 요구합니다. `name`은
가입 시 입력한 닉네임/표시 이름으로 저장되며, 이메일 인증 후 생성되는 기본
워크스페이스의 소유자 표시 이름에도 사용됩니다.

## 현재 구현 범위 요약

- 인증/계정 범위는 회원가입, 이메일 인증, 인증 메일 재발송, 사업장 초대 수락, 로그인, 세션 refresh/logout, `auth/me`, 접근 가능 사업장 목록, 세션 단위 사업장 전환, 계정 보안, 프로필 수정, 비밀번호 변경, 세션 종료까지 독립 use-case 기반으로 운영합니다.
- 설정 범위는 현재 workspace의 사업장/기본 장부 설정 조회와 Owner/Manager 수정까지 포함합니다.
- 관리자 범위는 현재 workspace의 멤버 목록/초대/역할·상태 관리, DB 메뉴 트리/메뉴 권한 관리, workspace 감사 로그 조회, 권한 정책 요약까지 포함합니다. `INITIAL_ADMIN_*`로 시드된 전역 관리자는 일반 사업장 관리자와 분리되어 전체 사용자 관리, 사업장 관리, 사업장 전환/지원 문맥, 운영 상태 점검, 보안 위협 로그, 전체 멤버십 역할·상태 관리를 수행할 수 있습니다.
- 내비게이션 범위는 현재 workspace의 DB 메뉴 트리를 현재 멤버 역할 기준으로 필터링해 반환하는 `navigation/tree`까지 포함합니다.
- 운영 지원 범위는 체크리스트, 예외 처리함, 월 마감 대시보드, 업로드 운영 현황, 시스템 상태, 알림 센터, 수동 CSV 반출, 운영 메모까지 포함합니다.
- 기준/참조 범위는 조회 `reference-data/readiness`, `funding-accounts`, `categories`, `account-subjects`, `ledger-transaction-types`, `insurance-policies`, `liabilities`, `vehicles`, `vehicles/operating-summary`, `vehicles/fuel-logs`, `vehicles/maintenance-logs`와 자금수단/카테고리/보험 계약/부채 계약/차량 관리 `POST /funding-accounts`, `POST /funding-accounts/:id/bootstrap`, `PATCH /funding-accounts/:id`, `DELETE /funding-accounts/:id`, `POST /categories`, `PATCH /categories/:id`, `POST /insurance-policies`, `PATCH /insurance-policies/:id`, `DELETE /insurance-policies/:id`, `POST /liabilities`, `PATCH /liabilities/:id`, `POST /liabilities/:id/archive`, `POST /liabilities/:id/repayments`, `PATCH /liabilities/:id/repayments/:repaymentId`, `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`, `POST /vehicles`, `PATCH /vehicles/:id`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`, `DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`, `DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`까지 포함합니다.
- 운영/원장 조회 범위는 `accounting-periods`, `collected-transactions`, `journal-entries`, `plan-items`, `financial-statements`, `carry-forwards`, `import-batches`까지 포함합니다.
- 집계/보고 조회 범위는 `dashboard/summary`, `funding-account-status/summary`, `forecast/monthly`까지 포함합니다.
- 현재 쓰기/명령 범위는 `funding-accounts`, `categories`, `insurance-policies`, `liabilities`, `vehicles`, `vehicle fuel logs`, `vehicle maintenance logs`, `accounting-periods`, `collected-transactions`, `recurring-rules`, `plan-items`, `import-batches`, `journal-entries`, `financial-statements`, `carry-forwards`까지 확장되어 있습니다.
- 즉, 현재 저장소의 API surface는 초기 reference-data/transactions 수준을 넘어 기준 데이터, 보험/차량 운영 기준, 반복 계획, 수집, 업로드 배치, 전표, 공식 보고, 자금수단별 현황, 차기 이월, 기간 전망까지 포함합니다.

## 보호 엔드포인트

아래 엔드포인트는 기본적으로 Bearer 토큰이 필요합니다.

### 인증/기준 데이터

- `GET /auth/me`
- `GET /auth/workspaces`
- `POST /auth/workspaces`
- `DELETE /auth/workspaces/:tenantId`
- `POST /auth/current-workspace`
- `GET /auth/account-security`
- `PATCH /auth/account-profile`
- `POST /auth/change-password`
- `DELETE /auth/sessions/:sessionId`
- `GET /settings/workspace`
- `PATCH /settings/workspace`
- `GET /admin/tenants` (전역 관리자 전용)
- `GET /admin/tenants/:tenantId` (전역 관리자 전용)
- `PATCH /admin/tenants/:tenantId/status` (전역 관리자 전용)
- `GET /admin/users` (전역 관리자 전용)
- `GET /admin/users/:userId` (전역 관리자 전용)
- `PATCH /admin/users/:userId/status` (전역 관리자 전용)
- `POST /admin/users/:userId/revoke-sessions` (전역 관리자 전용)
- `PATCH /admin/users/:userId/system-admin` (전역 관리자 전용)
- `PATCH /admin/users/:userId/email-verification` (전역 관리자 전용)
- `GET /admin/support-context` (전역 관리자 전용)
- `POST /admin/support-context` (전역 관리자 전용)
- `DELETE /admin/support-context` (전역 관리자 전용)
- `GET /admin/operations/status` (전역 관리자 전용)
- `GET /admin/members`
- `POST /admin/members/invitations`
- `PATCH /admin/members/:membershipId/role`
- `PATCH /admin/members/:membershipId/status`
- `DELETE /admin/members/:membershipId`
- `GET /admin/navigation`
- `PATCH /admin/navigation/:menuItemId`
- `GET /admin/policy`
- `GET /admin/audit-events`
- `GET /admin/audit-events/:auditEventId`
- `GET /admin/security-threats` (전역 관리자 전용)
- `GET /navigation/tree`
- `GET /reference-data/readiness`
- `GET /funding-accounts`
- `POST /funding-accounts`
- `POST /funding-accounts/:id/bootstrap`
- `PATCH /funding-accounts/:id`
- `DELETE /funding-accounts/:id`
- `GET /categories`
- `POST /categories`
- `PATCH /categories/:id`
- `GET /account-subjects`
- `GET /ledger-transaction-types`
- `GET /insurance-policies`
- `POST /insurance-policies`
- `PATCH /insurance-policies/:id`
- `DELETE /insurance-policies/:id`
- `GET /liabilities`
- `GET /liabilities/overview`
- `POST /liabilities`
- `PATCH /liabilities/:id`
- `POST /liabilities/:id/archive`
- `GET /liabilities/:id/repayments`
- `POST /liabilities/:id/repayments`
- `PATCH /liabilities/:id/repayments/:repaymentId`
- `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`
- `GET /vehicles`
- `GET /vehicles/operating-summary`
- `GET /vehicles/fuel-logs`
- `GET /vehicles/maintenance-logs`
- `POST /vehicles`
- `PATCH /vehicles/:id`
- `POST /vehicles/:id/fuel-logs`
- `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`
- `DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId`
- `POST /vehicles/:id/maintenance-logs`
- `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`
- `DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`

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
- `POST /collected-transactions/confirm-bulk`
- `POST /collected-transactions/:id/confirm`
- `GET /import-batches`
- `GET /import-batches/:id`
- `POST /import-batches`
- `POST /import-batches/files`
- `DELETE /import-batches/:id`
- `POST /import-batches/:id/cancel-collection`
- `POST /import-batches/:id/rows/:rowId/collect-preview`
- `POST /import-batches/:id/rows/:rowId/collect`
- `POST /import-batches/:id/rows/collect`
- `GET /import-batches/:id/collection-jobs/active`
- `GET /import-batches/:id/collection-jobs/:jobId`
- `POST /import-batches/:id/collection-jobs/:jobId/cancel`
- `GET /journal-entries`
- `POST /journal-entries/:id/reverse`
- `POST /journal-entries/:id/correct`

### 운영 지원

- `GET /operations/summary`
- `GET /operations/checklist`
- `GET /operations/exceptions`
- `GET /operations/month-end`
- `GET /operations/import-status`
- `GET /operations/system-status`
- `GET /operations/alerts`
- `GET /operations/exports`
- `POST /operations/exports`
- `GET /operations/notes`
- `POST /operations/notes`

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
- `POST /carry-forwards/:id/cancel`
- `GET /dashboard/summary?periodId=<id>`
- `GET /funding-account-status/summary?basis=COLLECTED_TRANSACTIONS|POSTED_JOURNALS&periodId=<id>&fundingAccountId=<id>`
- `GET /forecast/monthly?periodId=<id>&month=YYYY-MM`

## Web 화면 경로와 API 모듈 대응

- Web `/register` -> API `POST /auth/register`
- Web `/verify-email` -> API `POST /auth/verify-email`, `POST /auth/resend-verification`
- Web `/accept-invitation` -> API `POST /auth/accept-invitation`
- Web `/forgot-password` -> API `POST /auth/forgot-password`
- Web `/reset-password` -> API `POST /auth/reset-password`
- Web `/admin` -> API `/admin/users`, `/admin/tenants`, `/admin/support-context`, `/admin/operations/status`, `/admin/members`, `/admin/audit-events`
- Web `/admin/users` -> API `GET /admin/users`, `GET /admin/users/:userId`, `PATCH /admin/users/:userId/status`, `POST /admin/users/:userId/revoke-sessions`, `PATCH /admin/users/:userId/system-admin`, `PATCH /admin/users/:userId/email-verification`
- Web `/admin/tenants` -> API `GET /admin/tenants`, `GET /admin/tenants/:tenantId`, `PATCH /admin/tenants/:tenantId/status`
- Web `/admin/support-context` -> API `GET /admin/support-context`, `POST /admin/support-context`, `DELETE /admin/support-context`
- Web `/admin/operations` -> API `GET /admin/operations/status`
- Web `/admin/members` -> API `GET /admin/members`, `POST /admin/members/invitations`, `PATCH /admin/members/:membershipId/role`, `PATCH /admin/members/:membershipId/status`, `DELETE /admin/members/:membershipId`
- Web `/admin/navigation` -> API `GET /admin/navigation`, `PATCH /admin/navigation/:menuItemId`
- Web `/admin/logs` -> API `GET /admin/audit-events`, `GET /admin/audit-events/:auditEventId`
- Web `/admin/security-threats` -> API `GET /admin/security-threats`
- Web `/admin/policy` -> API `GET /admin/policy`
- Web `/settings/workspace` -> API `GET /settings/workspace`, `PATCH /settings/workspace`, `GET /auth/workspaces`, `POST /auth/workspaces`, `DELETE /auth/workspaces/:tenantId`
- Web `/settings/account` -> API `GET /auth/account-security`
- Web `/settings/account/profile` -> API `GET /auth/account-security`, `PATCH /auth/account-profile`
- Web `/settings/account/password` -> API `GET /auth/account-security`, `POST /auth/change-password`
- Web `/settings/account/sessions` -> API `GET /auth/account-security`, `DELETE /auth/sessions/:sessionId`
- Web `/settings/account/events` -> API `GET /auth/account-security`
- Web `/operations` -> API `GET /operations/summary`
- Web `/operations/checklist` -> API `GET /operations/checklist`
- Web `/operations/exceptions` -> API `GET /operations/exceptions`
- Web `/operations/month-end` -> API `GET /operations/month-end`
- Web `/operations/imports` -> API `GET /operations/import-status`
- Web `/operations/status` -> API `GET /operations/system-status`
- Web `/operations/alerts` -> API `GET /operations/alerts`
- Web `/operations/exports` -> API `GET /operations/exports`, `POST /operations/exports`
- Web `/operations/notes` -> API `GET /operations/notes`, `POST /operations/notes`
- Web `/dashboard` -> API `GET /dashboard/summary`
- Web `/periods` -> API `/accounting-periods`
- Web `/periods/open` -> API `GET /accounting-periods`, `GET /accounting-periods/current`, `POST /accounting-periods`
- Web `/periods/close` -> API `GET /accounting-periods`, `POST /accounting-periods/:id/close`, `POST /accounting-periods/:id/reopen`
- Web `/periods/history` -> API `GET /accounting-periods`
- Web `/reference-data` -> API `/reference-data/readiness`, `/funding-accounts`, `/categories`, `/account-subjects`, `/ledger-transaction-types`
- Web `/reference-data/manage` -> API `/reference-data/readiness`
- Web `/reference-data/funding-accounts` -> API `/funding-accounts`
- Web `/reference-data/categories` -> API `/categories`
- Web `/reference-data/lookups` -> API `/account-subjects`, `/ledger-transaction-types`
- Web `/recurring` -> API `/recurring-rules`
- Web `/plan-items` -> API `/plan-items`
- Web `/plan-items/generate` -> API `GET /accounting-periods`, `POST /plan-items/generate`
- Web `/transactions` -> API `/collected-transactions`, `POST /collected-transactions/confirm-bulk`
- Web `/imports` -> API `/import-batches`, `POST /import-batches/files`
- Web `/imports/[batchId]` -> API `GET /import-batches/:id`, `DELETE /import-batches/:id`, `POST /import-batches/:id/cancel-collection`, `POST /import-batches/:id/rows/collect`, `GET /import-batches/:id/collection-jobs/active`, `GET /import-batches/:id/collection-jobs/:jobId`, `POST /import-batches/:id/collection-jobs/:jobId/cancel`, `POST /import-batches/:id/rows/:rowId/collect-preview`, `POST /import-batches/:id/rows/:rowId/collect`
- Web `/journal-entries` -> API `/journal-entries`
- Web `/journal-entries/[entryId]` -> API `GET /journal-entries`, `POST /journal-entries/:id/reverse`, `POST /journal-entries/:id/correct`
- Web `/financial-statements` -> API `/financial-statements`
- Web `/financial-statements/[periodId]` -> API `GET /financial-statements?periodId=<id>`, `POST /financial-statements/generate`
- Web `/funding-account-status` -> API `GET /funding-account-status/summary`
- Web `/carry-forwards` -> API `/carry-forwards`
- Web `/carry-forwards/[periodId]` -> API `GET /carry-forwards?fromPeriodId=<id>`, `POST /carry-forwards/generate`
- Web `/insurances` -> API `/insurance-policies`
- Web `/liabilities` -> API `GET /liabilities`, `GET /liabilities/overview`, `POST /liabilities`, `PATCH /liabilities/:id`, `POST /liabilities/:id/archive`
- Web `/liabilities/[agreementId]` -> API `GET /liabilities`, `GET /liabilities/overview`, `GET /liabilities/:id/repayments`, `POST /liabilities/:id/repayments`, `PATCH /liabilities/:id/repayments/:repaymentId`, `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`
- Web `/vehicles` -> API `/vehicles`
- Web `/vehicles/fleet` -> API `GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`
- Web `/vehicles/fuel` -> API `GET /vehicles/fuel-logs`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`, `DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId`
- Web `/vehicles/maintenance` -> API `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`, `DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`
- Web `/forecast` -> API `GET /forecast/monthly`
- Web 라우트의 shorthand 이름과 Swagger/API module 이름이 다를 수 있으며, 계약과 백엔드 모듈명은 API 경로 기준으로 봅니다.

## 현재 쓰기/명령 엔드포인트

### `GET /admin/users`

- 계약: response `AdminUserItem[]`
- 전역 관리자만 전체 사용자 목록, 계정 상태, 이메일 인증 여부, 멤버십 수, 세션 수를 조회합니다.
- 계정 잠금/비활성, 전체 관리자 권한 조정, 세션 만료 작업의 출발점입니다.

### `GET /admin/users/:userId`

- 계약: response `AdminUserDetail`
- 전역 관리자만 특정 사용자의 멤버십, 최근 세션, 최근 보안 위협 이벤트를 함께 조회합니다.
- 비밀번호 hash, refresh token 원문, 세션 token 원문은 노출하지 않습니다.

### `PATCH /admin/users/:userId/status`

- 계약: `UpdateAdminUserStatusRequest -> AdminUserDetail`
- 전역 관리자만 사용자 상태를 `ACTIVE`, `LOCKED`, `DISABLED`로 변경합니다.
- 자기 자신의 계정 잠금과 마지막 활성 전역 관리자 잠금은 막습니다.

### `POST /admin/users/:userId/revoke-sessions`

- 계약: response `RevokeAdminUserSessionsResponse`
- 전역 관리자만 대상 사용자의 활성 세션을 만료합니다.
- 자기 자신을 대상으로 할 때는 현재 요청 세션을 제외하고 다른 세션만 만료합니다.

### `PATCH /admin/users/:userId/system-admin`

- 계약: `UpdateAdminUserSystemAdminRequest -> AdminUserDetail`
- 전역 관리자만 다른 사용자에게 전역 관리자 권한을 부여하거나 회수합니다.
- 자기 자신의 전역 관리자 권한 변경과 마지막 활성 전역 관리자 회수는 막습니다.

### `PATCH /admin/users/:userId/email-verification`

- 계약: `UpdateAdminUserEmailVerificationRequest -> AdminUserDetail`
- 전역 관리자만 이메일 인증 상태를 수동 완료 처리합니다.
- 이메일 인증 해제는 지원하지 않습니다.

### `GET /admin/tenants`

- 계약: response `AdminTenantItem[]`
- 전역 관리자만 전체 사업장 목록, 기본 장부, 멤버 수, 활성 소유자 수를 조회합니다.

### `GET /admin/tenants/:tenantId`

- 계약: response `AdminTenantDetail`
- 전역 관리자만 특정 사업장의 장부 목록과 최근 감사 이벤트를 함께 조회합니다.

### `PATCH /admin/tenants/:tenantId/status`

- 계약: `UpdateAdminTenantStatusRequest -> AdminTenantDetail`
- 전역 관리자만 사업장 상태를 `TRIAL`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`로 변경합니다.
- 활성화 요청은 최소 1개 장부가 있어야 성공합니다.

### `GET /admin/support-context`

- 계약: response `AdminSupportContext`
- 전역 관리자만 현재 로그인 세션에 연결된 지원 문맥을 조회합니다.

### `POST /admin/support-context`

- 계약: `UpdateAdminSupportContextRequest -> AdminSupportContext`
- 전역 관리자 세션에 특정 사업장과 장부를 지원 문맥으로 저장합니다.
- 다른 사용자로 가장하지 않고 실제 전역 관리자 사용자 ID로 모든 작업이 기록됩니다.

### `DELETE /admin/support-context`

- 계약: response `AdminSupportContext`
- 현재 전역 관리자 세션의 지원 문맥을 해제합니다.

### `GET /admin/operations/status`

- 계약: response `AdminOperationsStatus`
- 전역 관리자만 사용자/사업장 수, 잠금 계정, 최근 24시간 보안 위협, 감사 실패/거부, API/DB 점검 상태를 조회합니다.
- Prisma migration 상세 비교는 배포 절차에서 별도 확인하며, 이 응답은 운영 점검판 역할을 합니다.

### `GET /admin/members`

- 계약: response `AdminMemberItem[]`
- 현재 작업 문맥의 Owner/Manager가 현재 Tenant 멤버 목록을 조회합니다.
- 응답에는 멤버십 ID, 사용자 ID, 이름, 이메일, 역할, 상태, 참여일, 마지막 접근 시각, 이메일 인증 여부만 포함하고 비밀번호 hash, session, token 계열 값은 노출하지 않습니다.

### `POST /admin/members/invitations`

- 계약: `InviteTenantMemberRequest -> TenantMemberInvitationItem`
- 현재 작업 문맥의 Owner만 새 멤버 초대 메일을 보낼 수 있습니다.
- 초대 token 원문은 DB에 저장하지 않고 hash만 저장합니다.
- 이미 같은 Tenant에 활성 또는 초대 상태로 연결된 사용자는 중복 초대를 막습니다.
- 초대 성공과 메일 발송 실패는 workspace 감사 이벤트로 기록합니다.

### `POST /auth/accept-invitation`

- 계약: `AcceptInvitationRequest -> AcceptInvitationResponse`
- 초대 메일의 token을 검증하고, 초대 이메일과 일치하는 기존 사용자가 있으면 해당 Tenant membership을 `ACTIVE` 상태로 연결합니다.
- 아직 가입된 사용자가 없으면 `registration_required` 상태를 반환합니다.
- 초대 token 원문은 DB에 저장하지 않고, 소비된 초대는 다시 사용할 수 없습니다.

### `GET /auth/workspaces`

- 계약: response `AuthenticatedWorkspaceListResponse`
- 현재 사용자가 `ACTIVE` 멤버십으로 접근할 수 있는 사업장과 기본 장부, 멤버 역할, 현재 선택 여부를 반환합니다.
- 응답은 현재 로그인 세션의 `currentWorkspace`와 비교한 `isCurrent` 값을 포함합니다.

### `POST /auth/workspaces`

- 계약: `CreateWorkspaceRequest -> CreateWorkspaceResponse`
- 현재 사용자가 추가 사업장과 기본 장부를 만들고, 생성된 사업장을 세션의 작업 문맥으로 즉시 선택합니다.
- 생성 사용자는 새 사업장의 `OWNER` 멤버가 되며 기본 계정과목, 거래 유형, 메뉴 트리가 함께 준비됩니다.
- `tenantSlug`는 전역 unique 값이며 중복이면 `409 Conflict`를 반환합니다.

### `DELETE /auth/workspaces/:tenantId`

- 계약: response `DeleteWorkspaceResponse`
- 삭제 대상 사업장의 `ACTIVE` `OWNER` 멤버십이 있는 사용자만 실행할 수 있습니다.
- 사용자의 마지막 활성 사업장은 삭제할 수 없으며, 대상 사업장에 다른 활성 멤버가 남아 있으면 `409 Conflict`를 반환합니다.
- 현재 선택 중인 사업장을 삭제하면 세션의 작업 문맥은 남아 있는 접근 가능 사업장으로 자동 전환됩니다.

### `POST /auth/current-workspace`

- 계약: `SwitchWorkspaceRequest -> SwitchWorkspaceResponse`
- 현재 사용자가 `ACTIVE` 멤버십으로 연결된 사업장만 세션의 작업 문맥으로 선택할 수 있습니다.
- `ledgerId`를 생략하면 선택 사업장의 기본 장부를 사용하고, 명시한 장부가 해당 사업장에 없으면 전환을 거부합니다.
- 전환 결과는 같은 access token/session으로 이어지며, 이후 보호 API는 새 `currentWorkspace` 기준으로 동작합니다.

### `PATCH /admin/members/:membershipId/role`

- 계약: `UpdateTenantMemberRoleRequest -> AdminMemberItem`
- 현재 작업 문맥의 Owner만 멤버 역할을 변경할 수 있습니다.
- 마지막 활성 Owner를 다른 역할로 낮추는 요청은 `400 Bad Request`로 막습니다.
- 역할 변경 성공은 workspace 감사 이벤트로 기록합니다.

### `PATCH /admin/members/:membershipId/status`

- 계약: `UpdateTenantMemberStatusRequest -> AdminMemberItem`
- 현재 작업 문맥의 Owner만 멤버 상태를 `ACTIVE`, `SUSPENDED`, `REMOVED`로 변경할 수 있습니다.
- 마지막 활성 Owner를 중지 또는 제거 상태로 바꾸는 요청은 `400 Bad Request`로 막습니다.
- 상태 변경 성공은 workspace 감사 이벤트로 기록합니다.

### `DELETE /admin/members/:membershipId`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner만 멤버를 하드 삭제하지 않고 `REMOVED` 상태로 전환합니다.
- 마지막 활성 Owner 제거 요청은 `400 Bad Request`로 막습니다.
- 제거 성공은 workspace 감사 이벤트로 기록합니다.

### `GET /admin/audit-events`

- 계약: `AdminAuditEventQuery -> AdminAuditEventListResponse`
- 현재 작업 문맥의 Owner만 현재 Tenant 감사 이벤트 목록을 조회할 수 있습니다.
- `eventCategory`, `action`, `result`, `actorMembershipId`, `requestId`, `from`, `to`, `offset`, `limit` query를 지원합니다.
- 조회 응답은 민감정보를 제외한 allowlist metadata만 포함합니다.

### `GET /admin/audit-events/:auditEventId`

- 계약: response `AdminAuditEventItem`
- 현재 작업 문맥의 Owner만 현재 Tenant에 속한 감사 이벤트 상세를 조회할 수 있습니다.

### `GET /admin/security-threats`

- 계약: response `AdminSecurityThreatEventListResponse`
- 전역 관리자만 로그인 실패, 가입 제한, 세션 재사용 감지, 출처 차단, 권한 거부 같은 보안 위협 이벤트 목록을 조회할 수 있습니다.
- `severity`, `eventCategory`, `eventName`, `requestId`, `clientIpHash`, `userId`, `from`, `to`, `offset`, `limit` query를 지원합니다.
- IP는 원문이 아니라 hash 형태로 저장하며, 조회 응답의 `metadata`도 allowlist 가능한 평탄 값만 포함합니다.

### `POST /accounting-periods`

- 계약: `OpenAccountingPeriodRequest -> AccountingPeriodItem`
- 선택한 `month`의 운영 기간을 열고, 필요하면 opening balance 초기화를 시작합니다.
- 월 오픈은 월별 운영 사이클의 시작이며, 이미 존재하는 가장 최근 운영 기간이 `LOCKED` 상태일 때만 이후 월을 열 수 있습니다.
- 운영 중에는 하나의 최신 진행월만 열어 두는 것을 기본 정책으로 삼습니다.
- 첫 월의 opening balance와 이후 차기 이월 opening balance는 거래 등록 예외가 아니라 해당 월 시작 잔액 기준입니다.

### `POST /accounting-periods/:id/close`

- 계약: `CloseAccountingPeriodRequest -> CloseAccountingPeriodResponse`
- 운영 기간을 잠그고 closing snapshot을 생성합니다.
- 공식 `financial-statements`와 `carry-forwards`의 선행 조건입니다.

### `POST /accounting-periods/:id/reopen`

- 계약: `ReopenAccountingPeriodRequest -> AccountingPeriodItem`
- 잠금된 운영 기간을 사유와 함께 다시 엽니다.
- 재오픈 시 해당 기간의 공식 재무제표 snapshot과 closing snapshot을 정리하고 상태를 `OPEN`으로 되돌립니다.
- 재오픈은 최신 잠금 운영월에만 허용합니다.
- 이미 차기 이월 record가 생성되었거나 다음 운영 기간에 opening balance snapshot이 있으면 `409 Conflict`로 막습니다.

### `GET /reference-data/readiness`

- 계약: response `ReferenceDataReadinessSummary`
- 현재 작업 문맥 기준으로 자금수단, 수입/지출 카테고리, 계정과목, 거래유형 readiness를 서버에서 판정합니다.
- 현재 구현은 기준 데이터 ownership를 `사용자 준비 책임`과 `system-managed`로 구분해 함께 돌려줍니다.
- 현재 `inProductEditEnabled`는 자금수단과 수입/지출 카테고리가 모두 `true`이며, 계정과목/거래유형은 `false`로 유지됩니다.

### `GET /funding-accounts`

- 계약: response `FundingAccountItem[]`
- 현재 작업 문맥 기준 활성 자금수단만 반환합니다.
- `?includeInactive=true`를 주면 비활성/종료 자금수단까지 함께 반환합니다.
- 응답의 `bootstrapStatus`는 신규 계좌/카드의 시작 잔액 초기화가 아직 닫히지 않았는지 표시합니다. `PENDING`인 활성 `BANK`/`CARD`만 업로드 배치의 신규 계좌/카드 bootstrap 후보가 될 수 있습니다.

### `POST /funding-accounts`

- 계약: `CreateFundingAccountRequest -> FundingAccountItem`
- 현재 작업 문맥의 Owner/Manager만 새 자금수단을 생성할 수 있습니다.
- 현재 범위는 `name`, `type`, 선택 `initialBalanceWon` 생성을 지원하며 활성 상태 기본값은 `ACTIVE`입니다.
- `initialBalanceWon`이 없거나 `0`이면 새 `BANK`/`CARD` 자금수단은 `bootstrapStatus=PENDING`으로 생성되어 등록 직후 시작 잔액 초기화 후보가 됩니다. `CASH`는 `NOT_REQUIRED`로 생성됩니다.
- `initialBalanceWon`이 `0`보다 크면 열린 운영월에 `OPENING_BALANCE` 전표를 자동 발행하고, 해당 자금수단은 `bootstrapStatus=COMPLETED`와 입력 잔액으로 생성됩니다.
- 이름은 trim/lower 기준 normalized key로 중복을 판정하며, 동시 생성 충돌은 `409 Conflict`로 정리합니다.

### `POST /funding-accounts/:id/bootstrap`

- 계약: `CompleteFundingAccountBootstrapRequest -> FundingAccountItem`
- 현재 작업 문맥의 Owner/Manager만 기초 업로드 대기 자금수단의 기초 처리를 완료할 수 있습니다.
- 대상은 `bootstrapStatus=PENDING`인 활성 `BANK`/`CARD` 자금수단입니다.
- `initialBalanceWon`이 `0`보다 크면 열린 운영월에 기초전표(`OPENING_BALANCE`)를 발행하고 자금수단 잔액을 해당 금액으로 설정한 뒤 `COMPLETED`로 전환합니다.
- `initialBalanceWon`이 없거나 `0`이면 기초전표 없이 `COMPLETED`로 전환합니다.
- 기초금액 전표는 해당 자금수단에 기존 업로드 배치, 수집 거래, 전표 라인, opening/closing snapshot line이 없을 때만 발행합니다.

### `PATCH /funding-accounts/:id`

- 계약: `UpdateFundingAccountRequest -> FundingAccountItem`
- 현재 작업 문맥의 Owner/Manager만 자금수단 이름 변경과 `ACTIVE/INACTIVE/CLOSED` 상태 전환을 수행할 수 있습니다.
- 현재 범위에서 `CLOSED` 전환은 `INACTIVE -> CLOSED`일 때만 허용합니다.
- `bootstrapStatus`는 `PENDING -> COMPLETED` 직접 전환만 허용합니다. 금액 없이 닫는 호환 경로이며, 기초금액 입력과 기초전표 발행은 `POST /funding-accounts/:id/bootstrap`을 사용합니다.
- `CLOSED` 자금수단은 기존 거래/반복 규칙 기록 보존용 읽기 전용 상태로 유지하며, 현재 범위에서는 다시 수정하거나 재활성화할 수 없습니다.
- 현재 범위는 `type` 변경과 잔액 직접 수정을 지원하지 않습니다.
- 이름 중복이나 상태 경합은 `409 Conflict`로 응답합니다.

### `DELETE /funding-accounts/:id`

- 현재 작업 문맥의 Owner/Manager만 미사용 자금수단을 삭제할 수 있습니다.
- 삭제 전 현재 장부의 반복 규칙, 보험 계약, 계획 항목, 업로드 배치, 수집 거래, 전표 라인, 잔액 스냅샷, 차량 기본값 참조를 확인합니다.
- 연결된 항목이 하나라도 있으면 `409 Conflict`를 반환하고, 거래내역이나 관련 설정을 먼저 정리하도록 안내합니다.
- 참조가 없는 깨끗한 자금수단은 `ACTIVE/INACTIVE/CLOSED` 상태와 무관하게 삭제할 수 있습니다.

### `GET /categories`

- 계약: response `CategoryItem[]`
- 현재 작업 문맥 기준 활성 카테고리만 반환합니다.
- `?includeInactive=true`를 주면 비활성 카테고리까지 함께 반환합니다.

### `POST /categories`

- 계약: `CreateCategoryRequest -> CategoryItem`
- 현재 작업 문맥의 Owner/Manager만 새 카테고리를 생성할 수 있습니다.
- 현재 범위는 `name`, `kind` 생성과 활성 상태 기본값(`true`)까지로 한정합니다.
- 이름은 `kind + normalizedName` 기준으로 중복을 판정하며, 동시 생성 충돌은 `409 Conflict`로 정리합니다.

### `PATCH /categories/:id`

- 계약: `UpdateCategoryRequest -> CategoryItem`
- 현재 작업 문맥의 Owner/Manager만 카테고리 이름 변경과 활성/비활성 전환을 수행할 수 있습니다.
- 현재 범위는 `kind` 변경과 하드 삭제를 지원하지 않습니다.
- 같은 구분 안의 이름 중복이나 경합은 `409 Conflict`로 응답합니다.

### `GET /insurance-policies`

- 계약: response `InsurancePolicyItem[]`
- 현재 작업 문맥 기준 활성 보험 계약만 반환합니다.
- `?includeInactive=true`를 주면 비활성 보험 계약까지 함께 반환합니다.

### `POST /insurance-policies`

- 계약: `CreateInsurancePolicyRequest -> InsurancePolicyItem`
- 현재 작업 문맥의 Owner/Manager만 새 보험 계약을 생성할 수 있습니다.
- 현재 범위는 `provider`, `productName`, `monthlyPremiumWon`, `paymentDay`, `cycle`, `renewalDate`, `maturityDate`, `isActive`까지의 운영 보조 필드 관리로 한정합니다.
- 보험 중복은 `normalizedProvider + normalizedProductName` 기준으로 막으며, 동시 생성 충돌은 `409 Conflict`로 정리합니다.

### `PATCH /insurance-policies/:id`

- 계약: `UpdateInsurancePolicyRequest -> InsurancePolicyItem`
- 현재 작업 문맥의 Owner/Manager만 보험 계약 기준 필드와 활성/비활성 상태를 수정할 수 있습니다.
- 현재 범위는 비활성 계약도 `?includeInactive=true` 목록과 수정 흐름에서 계속 관리할 수 있으며, 삭제가 필요하면 별도 `DELETE /insurance-policies/:id` 흐름을 사용합니다.
- 같은 보험사/상품명 조합 충돌은 `409 Conflict`로 응답합니다.

### `DELETE /insurance-policies/:id`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner/Manager만 보험 계약을 삭제할 수 있습니다.
- 현재 구현은 보험 계약과 연결된 반복 규칙이 있으면 함께 삭제해 이후 자동 생성 기준에서도 제거합니다.

### `GET /liabilities`

- 계약: response `LiabilityAgreementItem[]`
- 현재 작업 문맥 기준 부채 계약을 반환합니다.
- 기본 응답은 보관 계약을 제외하고, `?includeArchived=true`를 주면 보관 계약까지 함께 반환합니다.

### `GET /liabilities/overview`

- 계약: response `LiabilityOverviewResponse`
- 현재 작업 문맥의 활성/비보관 부채 계약, 남은 원금 추정치, 최신 진행월 상환 예정액, 다음 상환일을 요약합니다.
- 이 값은 운영 보조 read model이며, 공식 부채 잔액은 전표와 재무제표 경계에서 확정됩니다.

### `POST /liabilities`

- 계약: `CreateLiabilityAgreementRequest -> LiabilityAgreementItem`
- 현재 작업 문맥의 Owner/Manager/Editor가 새 부채 계약을 생성할 수 있습니다.
- 대출 기관, 상품명, 원금, 실행일, 만기일, 금리, 상환 방식, 기본 출금 자금수단, 부채 계정과목, 이자/수수료 카테고리를 관리합니다.
- 같은 장부 안의 금융기관/상품명 조합은 normalized key 기준으로 중복을 막습니다.

### `PATCH /liabilities/:id`

- 계약: `UpdateLiabilityAgreementRequest -> LiabilityAgreementItem`
- 현재 작업 문맥의 Owner/Manager/Editor가 부채 계약 기준 필드를 수정할 수 있습니다.
- 이미 생성된 상환 일정이나 확정 전표는 이 계약 수정으로 소급 삭제하지 않습니다.

### `POST /liabilities/:id/archive`

- 계약: response `LiabilityAgreementItem`
- 부채 계약을 물리 삭제하지 않고 `ARCHIVED` 상태로 전환합니다.
- 보관된 계약은 이후 월별 계획 항목 자동 생성 대상에서 제외됩니다.

### `GET /liabilities/:id/repayments`

- 계약: response `LiabilityRepaymentScheduleItem[]`
- 선택한 부채 계약의 상환 일정을 예정일 오름차순으로 반환합니다.
- 응답에는 연결 계획 항목, 매칭 수집 거래, 확정 전표 요약이 함께 포함됩니다.

### `POST /liabilities/:id/repayments`

- 계약: `CreateLiabilityRepaymentScheduleRequest -> LiabilityRepaymentScheduleItem`
- 원금 상환액, 이자, 수수료, 예정일을 입력해 상환 일정을 추가합니다.
- 총액은 원금+이자+수수료 합계로 계산하며, 하나 이상의 금액은 0보다 커야 합니다.

### `PATCH /liabilities/:id/repayments/:repaymentId`

- 계약: `UpdateLiabilityRepaymentScheduleRequest -> LiabilityRepaymentScheduleItem`
- 아직 계획 항목과 연결되지 않았고 전표 확정되지 않은 상환 일정만 수정할 수 있습니다.
- 이미 전표 확정된 일정은 수정을 차단하고, 회계 조정은 전표 반전/정정 흐름을 사용합니다.

### `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`

- 계약: response `GenerateLiabilityPlanItemResponse`
- 상환 예정일이 최신 진행월 범위 안이면 계획 항목과 전표 준비 수집 거래를 함께 생성합니다.
- 이후 수집 거래 확정 시 원금 상환은 부채 차변, 이자/수수료는 비용 차변, 출금 자금수단은 자산 대변으로 분리됩니다.

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
- 현재 범위는 `name`, `manufacturer`, `fuelType`, `initialOdometerKm`, `estimatedFuelEfficiencyKmPerLiter`와 차량별 기본 자금수단/연료 카테고리/정비 카테고리, 차량 운영비 계획 opt-in까지의 차량 기본 프로필 관리로 한정하며 연료/정비 이력 생성은 별도 계약으로 분리합니다.
- 운영비 요약은 `VehicleItem`이 아니라 `/vehicles/operating-summary` projection에서 읽습니다.
- 차량 이름은 normalized key 기준으로 중복을 막고, 동시 생성 충돌은 `409 Conflict`로 정리합니다.

### `PATCH /vehicles/:id`

- 계약: `UpdateVehicleRequest -> VehicleItem`
- 현재 작업 문맥의 Owner/Manager만 차량 기본 정보를 수정할 수 있습니다.
- 현재 범위는 차량 프로필 필드와 차량별 운영비 기본값을 조정하며, 차량 프로필 하드 삭제는 지원하지 않습니다.
- 즉, 현재 수정 흐름은 차량 프로필 관리에만 집중하고, 연료/정비 이력은 별도 운영 모델로 관리합니다.
- 운영비/연비 보조 지표는 수정 응답이 아니라 별도 summary projection에서 해석합니다.
- 같은 이름 충돌은 `409 Conflict`로 응답합니다.

### `GET /vehicles/fuel-logs`

- 계약: response `VehicleFuelLogItem[]`
- 현재 작업 문맥 기준 차량 연료 이력을 workspace 범위로 모아 반환합니다.
- 연료 이력은 차량 기본 정보 응답과 분리된 별도 운영 기록 모델이며, 차량명과 `linkedCollectedTransaction` 요약은 read model 편의를 위해 함께 내려갑니다.
- `linkedCollectedTransaction`이 있으면 차량 화면에서 회계 연동 상태, 연결 수집거래 ID, 자금수단, 카테고리, 전표 확정 여부를 확인할 수 있습니다.

### `POST /vehicles/:id/fuel-logs`

- 계약: `CreateVehicleFuelLogRequest -> VehicleFuelLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량에 연료 이력을 추가할 수 있습니다.
- 현재 범위는 `filledOn`, `odometerKm`, `liters`, `amountWon`, `unitPriceWon`, `isFullTank`와 선택적 `accountingLink`를 지원합니다.
- `accountingLink`를 보내면 같은 요청 안에서 표준 지출 수집거래를 함께 생성합니다. 거래일은 `filledOn`, 금액은 `amountWon`, 제목/메모는 차량명과 연료 세부값을 기준으로 생성됩니다.
- 회계 연동을 켠 연료 기록은 0원 금액을 허용하지 않으며, 거래일이 최신 진행월 범위 안에 있어야 합니다.
- 카테고리가 있으면 연결 수집거래는 전표 준비 상태까지 올라갈 수 있고, 카테고리가 없으면 검토 상태로 남아 이후 차량 연료 기록 수정 화면에서 보완할 수 있습니다.

### `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`

- 계약: `UpdateVehicleFuelLogRequest -> VehicleFuelLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 연료 이력을 수정할 수 있습니다.
- 미확정 연결 수집거래가 있으면 연료 기록 수정 시 날짜, 금액, 자금수단, 카테고리, 제목/메모를 함께 동기화합니다.
- `accountingLink: null`로 저장하면 미확정 연결 수집거래를 삭제하고 연동을 해제합니다. 이미 전표 확정/정정/잠금된 연결은 해제할 수 없습니다.
- 연결 수집거래가 `POSTED`, `CORRECTED`, `LOCKED`이면 연료 기록 수정 자체를 거절합니다. 이 경우 차량 기록은 과거 사실로 보존하고, 회계 조정은 전표 반전/정정 흐름에서 처리합니다.

### `DELETE /vehicles/:vehicleId/fuel-logs/:fuelLogId`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 연료 이력을 삭제할 수 있습니다.
- 연결 수집거래가 없으면 연료 기록만 삭제합니다.
- 연결 수집거래가 미확정(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)이면 같은 transaction에서 연결 수집거래도 함께 삭제합니다.
- 연결 수집거래가 `POSTED`, `CORRECTED`, `LOCKED`이거나 이미 전표와 연결되어 있으면 삭제를 거절합니다. 이 경우 차량 기록은 과거 사실로 보존하고, 회계 조정은 전표 반전/정정 흐름에서 처리합니다.
- 현재 범위는 연료 이력 생성/수정/회계 연동까지 지원하며, 연료 이력 삭제는 후속 단계로 남겨 둡니다.

### `GET /vehicles/maintenance-logs`

- 계약: response `VehicleMaintenanceLogItem[]`
- 현재 작업 문맥 기준 차량 정비 이력을 workspace 범위로 모아 반환합니다.
- 정비 이력은 차량 기본 정보 응답과 분리된 별도 운영 기록 모델이며, 차량명과 `linkedCollectedTransaction` 요약은 read model 편의를 위해 함께 내려갑니다.
- `linkedCollectedTransaction`이 있으면 차량 화면에서 회계 연동 상태, 연결 수집거래 ID, 자금수단, 카테고리, 전표 확정 여부를 확인할 수 있습니다.

### `POST /vehicles/:id/maintenance-logs`

- 계약: `CreateVehicleMaintenanceLogRequest -> VehicleMaintenanceLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량에 정비 이력을 추가할 수 있습니다.
- 현재 범위는 `performedOn`, `odometerKm`, `category`, `vendor`, `description`, `amountWon`, `memo`와 선택적 `accountingLink`를 지원합니다.
- `accountingLink`를 보내면 같은 요청 안에서 표준 지출 수집거래를 함께 생성합니다. 거래일은 `performedOn`, 금액은 `amountWon`, 제목/메모는 차량명과 정비 세부값을 기준으로 생성됩니다.
- 회계 연동을 켠 정비 기록은 0원 금액을 허용하지 않으며, 거래일이 최신 진행월 범위 안에 있어야 합니다.

### `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`

- 계약: `UpdateVehicleMaintenanceLogRequest -> VehicleMaintenanceLogItem`
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 정비 이력을 수정할 수 있습니다.
- 미확정 연결 수집거래가 있으면 정비 기록 수정 시 날짜, 금액, 자금수단, 카테고리, 제목/메모를 함께 동기화합니다.
- `accountingLink: null`로 저장하면 미확정 연결 수집거래를 삭제하고 연동을 해제합니다. 이미 전표 확정/정정/잠금된 연결은 해제할 수 없습니다.
- 연결 수집거래가 `POSTED`, `CORRECTED`, `LOCKED`이면 정비 기록 수정 자체를 거절합니다. 이 경우 차량 기록은 과거 사실로 보존하고, 회계 조정은 전표 반전/정정 흐름에서 처리합니다.

### `DELETE /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner/Manager만 특정 차량의 정비 이력을 삭제할 수 있습니다.
- 연결 수집거래가 없으면 정비 기록만 삭제합니다.
- 연결 수집거래가 미확정(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)이면 같은 transaction에서 연결 수집거래도 함께 삭제합니다.
- 연결 수집거래가 `POSTED`, `CORRECTED`, `LOCKED`이거나 이미 전표와 연결되어 있으면 삭제를 거절합니다. 이 경우 차량 기록은 과거 사실로 보존하고, 회계 조정은 전표 반전/정정 흐름에서 처리합니다.
- 현재 범위는 정비 이력 생성/수정/회계 연동까지 지원하며, 정비 이력 삭제는 후속 단계로 남겨 둡니다.

### `POST /collected-transactions`

- 계약: `CreateCollectedTransactionRequest -> CollectedTransactionItem`
- 최신 진행월 범위 안의 거래일에 수집 거래를 생성합니다.
- 현재 API 구현 이름은 `collected-transactions`이고, Web 화면 경로는 shorthand로 `/transactions`를 사용합니다.
- 현재 응답은 `GET /collected-transactions` 목록 아이템 shape와 동일하게 매핑됩니다.
- 기준 데이터 readiness가 부족한 경우에도 현재 구현은 저장 요청 자체를 일괄 차단하지는 않지만, Web은 `reference-data/readiness`를 기준으로 준비 부족 안내와 이동 링크를 함께 노출합니다.

### `GET /collected-transactions/:id`

- 계약: response `CollectedTransactionDetailItem`
- 특정 수집 거래의 상세 값을 읽습니다.
- 현재 Web 드로어 수정 흐름은 이 상세 응답을 기준으로 초기값을 채웁니다.
- 차량 연료/정비 기록에서 생성된 연결 수집거래는 `sourceKind=VEHICLE_LOG`와 `sourceVehicleLog` 원본 정보를 함께 내려줍니다. 조회는 가능하지만, 수정과 삭제의 소유 진입점은 차량 운영 화면입니다.

### `PATCH /collected-transactions/:id`

- 계약: `UpdateCollectedTransactionRequest -> CollectedTransactionItem`
- 미확정 상태(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)의 수집 거래를 수정합니다.
- 수정 후 거래일도 최신 진행월 범위 안에 있어야 하며, 이미 전표로 확정된 거래는 수정할 수 없습니다.
- 차량 연료/정비 기록에서 생성된 연결 수집거래는 이 엔드포인트에서 직접 수정할 수 없습니다. 날짜/금액/분류 변경은 차량 연료/정비 수정 화면에서만 동기화합니다.

### `DELETE /collected-transactions/:id`

- 계약: response body 없음 (`204 No Content`)
- 미확정 상태(`COLLECTED`, `REVIEWED`, `READY_TO_POST`)의 수집 거래를 삭제합니다.
- 이미 전표로 이어진 거래는 삭제 대신 전표 정정/반전 흐름으로 처리해야 합니다.
- 차량 연료/정비 기록에서 생성된 연결 수집거래는 이 엔드포인트에서 직접 삭제할 수 없습니다. 미확정 연결 해제는 차량 연료/정비 수정 화면에서 `accountingLink: null`로 처리하거나 차량 연료/정비 삭제 API에서 차량 기록과 함께 정리합니다.

### `POST /collected-transactions/:id/confirm`

- 계약: request body 없음 -> `JournalEntryItem`
- 수집 거래를 확정해 `JournalEntry`를 생성합니다.
- 연결된 `PlanItem`이 있으면 현재 구현은 해당 항목을 `CONFIRMED`로 갱신합니다.
- 전표 번호는 현재 운영 기간의 원자적 sequence로 할당합니다.
- 같은 수집 거래 재확정, 전표 번호 경합, 잠금/상태 경합은 `409 Conflict` 또는 `400 Bad Request`로 정리합니다.

### `POST /collected-transactions/confirm-bulk`

- 계약: `BulkConfirmCollectedTransactionsRequest -> BulkConfirmCollectedTransactionsResponse`
- `transactionIds`를 보내면 선택한 수집 거래 중 `READY_TO_POST` 상태만 전표로 일괄 확정합니다.
- `transactionIds`를 비우면 현재 작업공간의 `READY_TO_POST` 수집 거래 전체를 거래일/생성일 순서로 확정합니다.
- 처리 결과는 행별 `CONFIRMED`, `SKIPPED`, `FAILED`와 생성된 전표 번호를 함께 반환하며, 선택 항목 중 전표 준비 상태가 아닌 거래는 `SKIPPED`로 남깁니다.

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
- 최종 중복 방지는 `periodId + recurringRuleId + plannedDate` DB unique 기준으로 수행하며, 경합 시 응답 집계는 실제 commit 결과를 반영합니다.
- 대상 기간은 최신 진행월이어야 합니다. 잠금월, 과거 열린월, 최신이 아닌 리뷰/마감 진행월에는 계획 항목을 생성하지 않습니다.

### `POST /import-batches`

- 계약: `CreateImportBatchRequest -> ImportBatchItem`
- UTF-8 CSV/TSV 또는 붙여넣기 텍스트 업로드 내용을 파싱해 배치와 행 단위 parse 결과를 저장합니다.
- `fundingAccountId`를 함께 보내면 활성 계좌/카드 자금수단과 배치를 연결합니다. 빈 값이면 기존처럼 배치만 생성합니다.
- 현재 row read model은 이미 등록된 행이면 수집 거래 상태, 연결된 계획 항목, 적용 카테고리 요약까지 함께 돌려줍니다.

### `POST /import-batches/files`

- 계약: `multipart/form-data(sourceKind, fundingAccountId, file, password?) -> ImportBatchItem`
- 현재 파일첨부 업로드는 `IM_BANK_PDF`, `WOORI_BANK_HTML`, `WOORI_CARD_HTML` 원본 형식을 지원합니다.
- `WOORI_BANK_HTML`과 `WOORI_CARD_HTML`은 브라우저에서 열어 저장한 정적 HTML과 암호화된 VestMail 원본을 지원합니다. 암호화 원본은 `password` 숫자 6자리로 서버에서 동적 스크립트 실행 없이 SEED/CBC 복호화만 수행하며, 비밀번호와 원본 파일은 저장하지 않습니다.
- `fundingAccountId`는 필수이며, 현재 워크스페이스의 활성 계좌/카드 자금수단이어야 합니다.
- IM뱅크 PDF 거래내역은 raw bytes SHA-256 `fileHash`를 계산하고, PDF 텍스트 레이어와 좌표를 읽어 `ImportedRow.rawPayload.original/parsed` 구조로 변환합니다.
- 텍스트 레이어가 없는 스캔/이미지 PDF는 OCR 미도입 범위로 명시 차단하며, `400 Bad Request`와 `code=SCANNED_PDF_TEXT_LAYER_MISSING`를 반환합니다.
- 원본 PDF 파일 자체는 저장하지 않고, 파일명, 해시, 파싱된 행, 행 단위 원본/정규화 payload만 저장합니다.
- PDF magic bytes, 확장자, content-type, 10MB 크기 제한을 검증합니다.

### `DELETE /import-batches/:id`

- 계약: response body 없음 (`204 No Content`)
- 현재 작업 문맥의 Owner/Manager/Editor만 업로드 배치를 삭제할 수 있습니다.
- 이미 수집 거래와 연결된 배치는 source trace 보존을 위해 삭제를 막고 `409 Conflict`를 반환합니다.

### `POST /import-batches/:id/cancel-collection`

- 계약: request body 없음 -> `CancelImportBatchCollectionResponse`
- 업로드 배치 원본과 파싱 행은 유지하고, 해당 배치에서 생성된 미확정 수집 거래만 전체 취소합니다.
- 취소 가능한 상태는 `COLLECTED`, `REVIEWED`, `READY_TO_POST`이며, 이미 전표 확정 또는 정정 흐름에 들어간 거래가 있으면 `409 Conflict`로 차단합니다.
- 연결된 계획 항목이 있으면 취소와 함께 `DRAFT`로 되돌리고, 진행 중인 일괄 등록 Job이 있으면 취소할 수 없습니다.

### `POST /import-batches/:id/rows/:rowId/collect-preview`

- 계약: `CollectImportedRowRequest -> CollectImportedRowPreview`
- 파싱 완료된 업로드 행을 실제 승격 전에 평가합니다.
- 현재 구현은 계획 항목 자동 매칭 후보, 적용 카테고리, 예상 다음 상태, duplicate fingerprint 보류 여부, 설명용 decision reason 목록을 함께 반환합니다.
- 대상 운영월을 등록 과정에서 만들 예정이면 `willCreateTargetPeriod`, `targetPeriodMonthLabel`, `targetPeriodCreationReason(INITIAL_SETUP | NEW_FUNDING_ACCOUNT)`을 함께 반환합니다.
- 중복 후보는 같은 현재 배치 안의 미승격 행끼리만으로 막지 않고, 이미 수기 입력됐거나 다른 배치에서 반영된 기존 수집 거래와 겹칠 때 확인 대상으로 봅니다.
- 운영 중에는 최신 진행월 범위 밖의 행 또는 임의의 신규 운영월 자동 생성을 preview 단계에서 차단합니다.

### `POST /import-batches/:id/rows/:rowId/collect`

- 계약: `CollectImportedRowRequest -> CollectImportedRowResponse`
- 파싱 완료된 업로드 행을 수집 거래로 등록합니다.
- 현재 응답은 생성된 `CollectedTransactionItem`뿐 아니라, 같은 요청 기준의 자동 판정 preview도 함께 돌려줍니다.
- 현재 구현은 source fingerprint 기반 중복 감지, 미확정 계획 항목(`PlanItem`) 자동 매칭, 카테고리/상태 자동 준비를 포함합니다.
- 운영 중에는 최신 진행월 범위의 행만 수집 거래로 등록할 수 있습니다.
- 운영월 자동 생성은 일반 거래 입력 예외가 아니라 초기화 지원입니다. 아직 운영 기간이 없는 최초 시작월 또는 최신 잠금 월 바로 다음 월에 대한 신규 활성 계좌/카드 bootstrap일 때만 허용합니다.
- 과거월 여러 개를 업로드로 다시 열거나 최신 진행월 밖 거래를 수집하는 용도로는 사용할 수 없습니다.
- 운영월 자동 생성이 발생한 업로드 행은 수집 거래 생성과 자금수단 `COMPLETED` 전환까지 처리합니다. 기초금액 자체를 수동으로 확정하고 기초전표를 발행하려면 `POST /funding-accounts/:id/bootstrap`을 사용합니다.
- 신규 계좌/카드 bootstrap 수집은 해당 자금수단이 `bootstrapStatus=PENDING`이고 기존 수집거래, 다른 import batch, 전표 line, opening/closing snapshot line이 없을 때만 열립니다. 첫 수집 성공 후에는 `COMPLETED`로 전환됩니다.
- 같은 업로드 행 재수집은 `importedRowId` 기준으로 막고, 반복 수집 거래 흡수는 조건부 claim으로 덮어쓰기를 방지합니다.
- 일괄 등록 Job이 같은 workspace에서 실행 중이면 단건 collect도 같은 배치/다른 배치 여부에 따라 `409 Conflict`로 막습니다.
- 중복/경합은 `409 Conflict`로 정리합니다.

### `POST /import-batches/:id/rows/collect`

- 계약: `BulkCollectImportedRowsRequest -> BulkCollectImportedRowsResponse`
- 선택 행이 없으면 현재 요청 배치의 등록 가능 행 전체를 대상으로 하고, 선택 행이 있으면 선택 목록만 처리합니다.
- 요청에서 `type`을 비우면 현재 구현은 파싱된 입출금 방향으로 `DEPOSIT -> INCOME`, `WITHDRAWAL -> EXPENSE`를 자동 판정합니다.
- `categoryId`와 `memo`는 일괄 기본값으로 쓰이며, `typeOptions[]`에 `{ type, categoryId?, memo? }`를 넘기면 실제 적용 거래유형별로 카테고리와 메모를 별도 지정할 수 있습니다.
- 일괄 등록도 단건 collect와 같은 최신 진행월/초기화 지원 규칙을 따릅니다.
- 응답은 `202 Accepted`와 함께 일괄 등록 Job 상태를 반환합니다. 서버는 Job/행별 결과를 저장하며, 같은 워크스페이스에서는 동시에 하나의 일괄 등록 Job만 실행됩니다.
- Job 실행 루프는 현재 API 프로세스 안에서 시작되고, 진행률과 결과는 DB에 남긴 뒤 배치 작업대에서 폴링합니다.
- 운영월 자동 생성이 발생한 행의 Job 결과 메시지는 `운영 시작 전 기초 입력`과 `신규 계좌/카드 bootstrap` 사유를 구분해 남깁니다.

### `GET /import-batches/:id/collection-jobs/active`

- 계약: `void -> ImportBatchCollectionJobItem | null`
- 선택한 업로드 배치에서 아직 `PENDING` 또는 `RUNNING` 상태인 일괄 등록 Job을 조회합니다.
- 배치 상세 작업대는 이 응답을 폴링해 새로고침 이후에도 진행 중 작업을 다시 표시합니다.

### `GET /import-batches/:id/collection-jobs/:jobId`

- 계약: `void -> ImportBatchCollectionJobItem`
- 특정 일괄 등록 Job의 전체 진행률(`requestedRowCount`, `processedRowCount`, `succeededCount`, `failedCount`)과 행별 결과를 조회합니다.
- Job 상태는 `PENDING`, `RUNNING`, `SUCCEEDED`, `PARTIAL`, `FAILED`, `CANCELLED` 중 하나입니다.

### `POST /import-batches/:id/collection-jobs/:jobId/cancel`

- 계약: request body 없음 -> `ImportBatchCollectionJobItem`
- 아직 대기 중이거나 실행 중인 일괄 등록 Job을 `CANCELLED`로 표시하고, 더 이상 새 업로드 행을 처리하지 않도록 중단을 요청합니다.
- 이미 처리 중인 단일 행은 트랜잭션 경계가 끝난 뒤 반영될 수 있으며, 이후 runner가 lock을 정리하고 최종 처리 건수를 갱신합니다.
- 완료, 실패, 부분 완료 등 이미 종료된 Job에는 추가 데이터 변경 없이 현재 Job 상태를 반환합니다.

### `POST /journal-entries/:id/reverse`

- 계약: `ReverseJournalEntryRequest -> JournalEntryItem`
- 기존 전표에 대한 reversal adjustment 전표를 생성합니다.
- reversal 전표 번호는 period-local sequence로 할당하며, 이미 역분개된 전표나 경합은 `409 Conflict`로 정리합니다.

### `POST /journal-entries/:id/correct`

- 계약: `CorrectJournalEntryRequest -> JournalEntryItem`
- 수정 사유와 line 입력으로 correction 전표를 생성합니다.
- correction 전표 번호는 period-local sequence로 할당하며, 상태/경합 충돌은 `409 Conflict`로 정리합니다.

### `POST /financial-statements/generate`

- 계약: `GenerateFinancialStatementSnapshotsRequest -> FinancialStatementsView`
- 잠금된 운영 기간과 closing snapshot이 있을 때 공식 재무제표 snapshot을 생성하거나 갱신합니다.

### `POST /carry-forwards/generate`

- 계약: `GenerateCarryForwardRequest -> CarryForwardView`
- 잠금된 운영 기간의 closing snapshot을 다음 기간 opening balance snapshot으로 이월합니다.
- 현재 구현은 opening balance snapshot 전용 정책입니다. `CarryForwardRecord.createdJournalEntryId`는 의도적으로 `null`이며, 별도 `CARRY_FORWARD` 전표는 생성하지 않습니다.
- `replaceExisting=true`를 보내면 기존 차기 이월을 안전 취소한 뒤 현재 closing snapshot 기준으로 다시 생성합니다. 이 경우 취소 권한까지 필요합니다.

### `POST /carry-forwards/:id/cancel`

- 계약: `CancelCarryForwardRequest -> CancelCarryForwardResponse`
- 생성된 차기 이월 record와 다음 기간 opening balance snapshot 및 opening balance line을 취소합니다.
- 안전 조건: 다음 운영 기간이 `OPEN`이고, opening balance 출처가 `CARRY_FORWARD`이며, 다음 기간에 수집 거래, 업로드 배치, 전표, 재무제표 snapshot, closing snapshot이 없어야 합니다.
- 취소 후에는 원 기간의 `POST /accounting-periods/:id/reopen` 차단 조건도 해소됩니다.

### `GET /funding-account-status/summary`

- 계약: response `FundingAccountOverviewResponse | null`
- 쿼리: `basis`, `periodId`, `fundingAccountId`
- `basis=COLLECTED_TRANSACTIONS`는 월중 운영 판단용으로 수집 거래 기준 수입/지출/이체와 미확정 거래를 포함해 봅니다.
- `basis=POSTED_JOURNALS`는 확정 전표 기준으로 POSTED 전표 라인만 읽어 공식 숫자에 반영된 자금 흐름을 확인합니다.
- 응답은 선택 기간, 선택 자금수단, 전체/선택 합계, 자금수단별 현황, 최근 월 추이, 카테고리별 breakdown, 거래 내역, 해석 경고를 포함합니다.
- 자금수단 잔액은 opening/closing snapshot, 전표, 미확정 수집 거래를 조합한 현재 read model과 기간 기준 흐름을 분리해 제공합니다.

## 현재 구현 흐름

### `reference-data -> accounting-periods -> insurance/liabilities/vehicles -> recurring-rules -> plan-items -> collected-transactions/imports -> journal-entries -> financial-statements -> funding-account-status -> carry-forwards -> forecast`

1. `GET /reference-data/readiness`, `POST /funding-accounts`, `POST /categories`로 기준 데이터 준비 상태를 확인하고 필요한 자금수단/카테고리를 정리합니다.
2. `POST /accounting-periods`로 운영 기간을 엽니다. 다음 월은 최근 월을 마감한 뒤 열며, 운영 중에는 하나의 최신 진행월만 열어 둡니다.
3. `POST /insurance-policies`, `POST /liabilities`, `POST /liabilities/:id/repayments`, `POST /vehicles`, `POST /vehicles/:id/fuel-logs`, `POST /vehicles/:id/maintenance-logs`로 보험 계약, 부채 상환 기준, 차량 운영 기준을 정리합니다. 부채 상환 일정은 계획 항목/수집 거래로 연결하고, 차량 연료/정비 저장 시 회계 연동을 켜면 같은 요청에서 표준 수집 거래를 함께 생성합니다.
4. `POST /recurring-rules`와 `POST /plan-items/generate`로 반복 규칙을 현재 월 계획 항목으로 펼치고, 계획 기반 수집 거래까지 생성합니다.
5. `POST /collected-transactions` 또는 `POST /import-batches/:id/rows/:rowId/collect`로 최신 진행월 범위의 수집 거래를 만들거나 업로드 행을 계획 기반 수집 거래에 흡수/매칭합니다.
6. 필요하면 `GET/PATCH/DELETE /collected-transactions/:id`로 미확정(`COLLECTED`, `REVIEWED`, `READY_TO_POST`) 수집 거래를 상세 조회, 수정, 삭제합니다. 단, 차량 연료/정비 화면에서 생성된 연결 수집거래는 차량 화면에서만 수정하거나 연결 해제합니다.
7. `POST /collected-transactions/:id/confirm`로 수집 거래를 `JournalEntry`로 확정합니다. 계획 항목 화면의 바로 확정도 내부적으로 이 경로를 사용합니다.
8. 필요하면 `POST /journal-entries/:id/reverse` 또는 `POST /journal-entries/:id/correct`로 전표 조정을 수행합니다.
9. `POST /accounting-periods/:id/close`로 운영 기간을 잠그고 closing snapshot을 만듭니다.
10. `POST /financial-statements/generate`로 잠금 기간의 공식 재무제표 snapshot을 생성합니다.
11. 차기 이월 전 수정이 필요하면 `POST /accounting-periods/:id/reopen`로 잠금 기간을 다시 열고 재무제표/마감 snapshot을 정리합니다.
12. `POST /carry-forwards/generate`로 다음 기간 opening balance snapshot과 carry-forward record를 생성합니다.
13. 차기 이월 후 정정이 필요하고 다음 기간 사용 이력이 없다면 `POST /carry-forwards/:id/cancel` 또는 `POST /carry-forwards/generate`의 `replaceExisting=true`로 안전 취소/재생성을 수행합니다.
14. `GET /funding-account-status/summary`로 자금수단별 수입, 지출, 이체, 잔액 흐름을 수집 거래 기준과 확정 전표 기준으로 비교합니다.
15. `GET /forecast/monthly`로 현재 월과 다음 달 전망을 확인합니다.

### `recurring-rules -> plan-items -> collected-transactions`

1. `POST /recurring-rules`로 반복 규칙을 등록합니다.
2. 필요하면 `GET/PATCH/DELETE /recurring-rules/:id`로 기존 반복 규칙을 상세 조회, 수정, 삭제합니다.
3. `POST /plan-items/generate`로 특정 기간의 `PlanItem`과 연결된 반복성 수집 거래를 생성합니다.
4. 현재 `PlanItemsView.items[]`는 매칭된 수집 거래 ID/제목/상태와 생성된 전표 ID/번호까지 함께 실어 보냅니다.
5. import collect 단계에서 현재 구현은 `collect-preview`와 `collect` 모두에서 미확정 계획 항목(`PlanItem`) 자동 매칭을 수행할 수 있습니다.
6. `POST /collected-transactions/:id/confirm`가 실행되면 매칭된 `PlanItem`은 `CONFIRMED`로 갱신됩니다.
7. `GET /dashboard/summary`, `GET /funding-account-status/summary`, `GET /forecast/monthly`는 위 운영/계획 데이터를 projection한 읽기 모델이며, 직접 쓰기 흐름에 참여하지 않습니다.

## 접근 범위와 데이터 최소 노출

- 모든 보호 엔드포인트는 `user.currentWorkspace`에서 선택된 `tenantId`, `ledgerId`, `membershipId`, `membershipRole` 문맥을 기준으로 동작합니다.
- 현재 구현은 단순 user-scoped 전단계가 아니라 workspace-scoped tenant/ledger 모델을 사용합니다.
- 조회 엔드포인트는 인증된 workspace 범위 내 데이터만 반환합니다.
- `insurance-policies`, `liabilities`, `vehicles`도 개인 생활용 고정 데이터가 아니라 현재 workspace/ledger 기준 사업 운영 보조 자산 데이터만 반환합니다.
- 쓰기 권한은 workspace membership role로 제어합니다.
- `OWNER`, `MANAGER`: `admin_member.read`
- `OWNER`: `admin_member.invite`, `admin_member.update_role`, `admin_member.update_status`, `admin_member.remove`, `admin_audit_log.read`
- `OWNER`, `MANAGER`: `workspace_settings.update`, `admin_policy.read`, `operations_export.run`
- `OWNER`, `MANAGER`, `EDITOR`, `VIEWER`: `workspace_settings.read`, `account_security.read`, `account_profile.update`, `account_security.change_password`, `account_security.revoke_session`, `operations_console.read`
- `OWNER`, `MANAGER`: `funding_account.create`, `funding_account.update`, `category.create`, `category.update`, `insurance_policy.create`, `insurance_policy.update`, `insurance_policy.delete`, `vehicle.create`, `vehicle.update`, `accounting_period.open`, `recurring_rule.create`, `plan_item.generate`, `financial_statement.generate`, `carry_forward.generate`, `journal_entry.reverse`, `journal_entry.correct`
- `OWNER`: `accounting_period.close`, `accounting_period.reopen`, `carry_forward.cancel`
- `OWNER`, `MANAGER`, `EDITOR`: `collected_transaction.create`, `collected_transaction.confirm`, `import_batch.upload`, `import_batch.delete`, `operations_note.create`
- `CollectedTransactionItem`, `RecurringRuleItem`, `JournalEntryItem`, `PlanItemsView`, `FinancialStatementsView`, `CarryForwardView`, `DashboardSummary`, `FundingAccountOverviewResponse`, `ForecastResponse`는 raw table 전체가 아니라 API view/projection shape를 응답합니다.
- 예외적으로 `ImportBatchItem.rows[].rawPayload`는 업로드 검수 목적상 현재 응답에 포함됩니다.
- 접근통제 실패는 `404` 또는 `401/403`으로 처리하고, 보안 이벤트 로그와 함께 남깁니다.

## 문서화 원칙

- 공유 요청/응답 shape가 바뀌면 `packages/contracts`를 먼저 수정합니다.
- API 구현이 바뀌면 Swagger 노출 상태와 이 문서를 같은 PR에서 함께 맞춥니다.
- 검증 범위가 바뀌면 `docs/VALIDATION_NOTES.md`도 함께 갱신합니다.
- 빠른 시작이나 저장소 진입 설명은 `README.md`, 상세 구현 절차는 `docs/DEVELOPMENT_GUIDE.md`에 유지합니다.
