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

## 보호 엔드포인트

아래 엔드포인트는 기본적으로 Bearer 토큰이 필요합니다.

- `GET /auth/me`
- `GET /funding-accounts`
- `GET /categories`
- `GET /collected-transactions`
- `POST /collected-transactions`
- `GET /recurring-rules`
- `POST /recurring-rules`
- `GET /insurance-policies`
- `GET /vehicles`
- `GET /dashboard/summary`
- `GET /forecast/monthly?month=YYYY-MM`

## 현재 쓰기 엔드포인트

### `POST /collected-transactions`

- 요청 계약: `CreateCollectedTransactionRequest`
- 응답 계약: `CollectedTransactionItem`
- 현재 엔드포인트는 도메인 기준의 `CollectedTransaction -> JournalEntry` 흐름으로 가기 전 입력/수집 단계 구현에 가깝습니다.
- 현재 응답은 `GET /collected-transactions` 목록 아이템 shape와 동일하게 매핑됩니다.
- 계정은 필수이며, 카테고리는 선택입니다.
- 현재 구현에서는 인증 사용자 범위 내 참조만 허용하며, 장기 기준은 Tenant/Membership 접근 범위로 수렴합니다.
- 상위 도메인 기준에서는 손익 성격 거래를 확정(`ReadyToPost`/전표 생성)하려면 Category 확정이 필요합니다.

### `POST /recurring-rules`

- 요청 계약: `CreateRecurringRuleRequest`
- 응답 계약: `RecurringRuleItem`
- 현재 엔드포인트는 도메인 기준의 `RecurringRule -> PlanItem` 생성 흐름의 초기 입력 단계 구현입니다.
- 현재 응답은 `GET /recurring-rules` 목록 아이템 shape와 동일하게 매핑됩니다.
- 계정은 필수이며, 카테고리는 선택입니다.
- 현재 구현에서는 인증 사용자 범위 내 참조만 허용하며, 장기 기준은 Tenant/Membership 접근 범위로 수렴합니다.

## 접근 범위와 데이터 최소 노출

- `GET /collected-transactions`는 현재 구현 기준으로 인증 사용자 범위 데이터만 반환합니다.
- `GET /recurring-rules`는 현재 구현 기준으로 인증 사용자 범위 데이터만 반환합니다.
- 상위 도메인 기준은 Tenant/Membership/Ledger 접근 범위이며, 현재 user-scoped 구현은 그 전단계입니다.
- 두 목록 응답은 `userId`, `tenantId`, `membershipId`, `accountId`, `categoryId`, `memo` 같은 내부 접근 제어/저장 모델 필드를 직접 노출하지 않습니다.
- `GET /dashboard/summary`와 `GET /forecast/monthly`는 집계 결과만 반환합니다.
- 두 read endpoint는 raw read model(`accounts`, `transactions`, `recurringRules`, `settings`)을 직접 응답하지 않습니다.
- 접근통제 실패는 `404` 또는 `401/403`으로 처리하고, 보안 이벤트 로그와 함께 남깁니다.

## 문서화 원칙

- 공유 요청/응답 shape가 바뀌면 `packages/contracts`를 먼저 수정합니다.
- API 구현이 바뀌면 Swagger 노출 상태와 이 문서를 같은 PR에서 함께 맞춥니다.
- 검증 범위가 바뀌면 `docs/VALIDATION_NOTES.md`도 함께 갱신합니다.
- 빠른 시작이나 저장소 진입 설명은 `README.md`, 상세 구현 절차는 `docs/DEVELOPMENT_GUIDE.md`에 유지합니다.
