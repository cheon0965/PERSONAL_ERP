# 검증 메모

이 문서는 **현재 구현 상태의 검증 범위**를 기록합니다.  
비즈니스 흐름, 상태, 권한, 엔티티의 최종 기준은 `docs/domain/business-logic-draft.md`, `docs/domain/core-entity-definition.md`를 우선합니다.

## 현재 기본 검증 기준

- `npm run check:quick`
- `npm run test`
- `npm run money:check`

설명:

- `npm run check:quick`는 Prettier, 문서의 `npm run` 명령 정합성 검사, 문서의 Web/API surface 정합성 검사, 금액 raw 연산 가드, lint, typecheck를 함께 확인합니다.
- 현재 문서 정합성 검사는 `npm run docs:check`로도 단독 실행할 수 있습니다.
- `npm run money:check`는 `apps/api/src`, `apps/web/src`, `packages/contracts/src`에서 money package 밖의 금액 필드 `Number(...)`, raw `+/-`, `+=/-=` 유입을 보수적으로 막습니다.
- `npm run docs:check:npm-run`는 `README.md`, `CONTRIBUTING.md`, `ENVIRONMENT_SETUP.md`, `docs/**/*.md`의 `npm run` 표기를 루트/workspace 스크립트와 대조합니다.
- `npm run docs:check:surface`는 `docs/API.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface가 실제 `apps/web/app` 라우트와 controller 기반 Swagger surface와 맞는지 확인합니다.

## 금액 정합성 검증 기준

- HTTP 계약의 금액은 `MoneyWon` 의미의 `number`이며, KRW 원 단위 safe integer만 허용합니다.
- Prisma 금액 컬럼은 `Decimal(19,0)`로 저장하고 mapper 경계에서 `Prisma.Decimal -> MoneyWon(number)`로 변환합니다.
- `HALF_UP` 반올림과 배분 잔차 보정은 `@personal-erp/money`의 `decimal.js` 기반 helper로 고정합니다.
- 금액 합계, 차감, 배분, 업로드 파싱 회귀는 `apps/api/test/money-won.test.ts`와 API/Web 요청 테스트에서 확인합니다.

## 대표 심화 검증

- `npm run test:e2e:smoke:build`
- `npm run test:e2e`
- `npm run test:prisma`
- `npm run audit:runtime:full`

설명:

- `npm run test:e2e:smoke:build`는 CI와 동일하게 in-process `Next.js` production build/start 경로를 올린 뒤 health route 기준 최소 HTTP smoke로 build 결과물과 서버 기동을 확인합니다.
- `npm run test:e2e:smoke:build:browser`는 루트 래퍼 명령이며, 내부적으로 Web workspace의 browser build smoke를 호출합니다.
- 이 명령은 필요할 때 로그인/세션 복원/운영 체크리스트/문맥 fallback까지 포함한 브라우저 build smoke를 별도로 다시 확인합니다.
- `npm run test:e2e`는 기준 데이터 CRUD, 반복 규칙 CRUD까지 포함한 전체 브라우저 대표 흐름 검증입니다.
- `npm run test:prisma`는 기본 루프와 분리된 실DB Prisma/HTTP 통합 검증이며, 로컬에서는 `PRISMA_INTEGRATION_DATABASE_URL`을 우선하고 없으면 `DATABASE_URL`로 fallback 합니다. CI에서는 `PRISMA_INTEGRATION_DATABASE_URL` 전용으로 동작합니다. 현재는 대표적으로 `운영기간 open -> 업로드 배치 -> 수집 -> 전표 확정 -> close`와 `반복규칙 -> plan item 생성 -> import collect 자동 매칭 -> confirm -> 재무제표 생성` 시나리오를 포함합니다.
- `npm run audit:runtime:full`은 `critical` gate 없이 현재 runtime advisory 전체를 다시 확인할 때 사용하는 follow-up 명령입니다.
- 현재 기본 `npm run test`에서는 Prisma 통합 테스트가 안내 문구와 함께 skip됩니다.

## CI 게이트

- `validate`
  `npm run check:quick`와 `npm run test`를 조합해 포맷, 문서 명령 정합성, 문서 Web/API surface 정합성, lint, typecheck, 기본 테스트를 확인합니다.
- `e2e-smoke`
  `npm run test:e2e:smoke:build`로 CI와 같은 in-process production build/start 기준 HTTP smoke를 다시 확인합니다.

- `security-regression`
  `npm run test:security:api`로 인증/세션, 브라우저/API 경계 회귀를 CI에서 다시 확인합니다.
- `prisma-integration`
  `PRISMA_INTEGRATION_DATABASE_URL` secret이 있는 경우 `npm run test:prisma`로 실제 MySQL 경계 시나리오를 수행하고, secret이 없는 경우에는 `DATABASE_URL` 우회 없이 skip 이유를 남깁니다.
- `audit-runtime`
  `npm run audit:runtime`으로 실제 배포 대상인 `api`, `web` workspace의 runtime dependency를 점검하고, 현재 CI 게이트는 `critical` 임계값 기준으로 실패를 판정합니다.
- `semgrep-ce`
  Semgrep CE 정적 분석을 수행합니다.
- `gitleaks`
  저장소 전체 secret 노출 여부를 점검합니다.

설명:

- 로컬 기본 검증은 `check:quick`와 `test`가 맡고, CI는 여기에 품질/보안 게이트를 추가해 회귀를 막습니다.
- Windows에서 `core.autocrlf=true` checkout을 쓰면 `check:quick`의 Prettier 단계가 EOL 차이로 과검출될 수 있으므로, CI와 같은 LF 기준 확인이 필요할 때는 `npm run format:check -- --end-of-line auto`를 함께 봅니다.
- `npm run audit:runtime`은 네트워크가 필요한 명령이라 로컬보다 CI 결과를 기본 증적으로 봅니다.
- `semgrep-ce`, `gitleaks`는 로컬에서 동일하게 재현하려면 Docker가 필요합니다.
- `semgrep-ce`는 build 산출물, test 산출물, migration, 운영 보조 script만 제외하고 애플리케이션 코드는 스캔 대상으로 둡니다.
- 따라서 Web의 공통 인증 fetch 경계인 `apps/web/src/shared/api/fetch-json.ts`도 Semgrep 제외 대상이 아닙니다.

## 현재 테스트 범위

### API

- 인증 로그인 성공/실패
- 인증 세션 생성/회전/로그아웃
- 보호 라우트의 `401`
- `GET /auth/me`
- `GET /funding-accounts`, `GET /categories`, `GET /account-subjects`, `GET /ledger-transaction-types`, `GET /insurance-policies`, `GET /vehicles`
  현재 workspace/ledger 기준 활성 참조 데이터와 운영 보조 자산 데이터만 반환하는지 검증
- `GET /insurance-policies?includeInactive=true`, `POST /insurance-policies`, `PATCH /insurance-policies/:id`
  Owner/Manager 전용 보험 계약 생성, 수정, 비활성화/재활성화와 workspace 범위 접근통제를 검증
- `POST /vehicles`, `PATCH /vehicles/:id`
  Owner/Manager 전용 차량 기본 정보 생성, 수정과 workspace 범위 접근통제를 검증
- `GET /vehicles/fuel-logs`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`
  Owner/Manager 전용 차량 연료 이력 생성, 수정과 workspace 범위 접근통제를 검증
- `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`
  Owner/Manager 전용 차량 정비 이력 생성, 수정과 workspace 범위 접근통제를 검증
- `GET /reference-data/readiness`
  현재 workspace 기준 기준 데이터 readiness, ownership 구분, 부족 항목 요약을 검증
- `POST /funding-accounts`, `PATCH /funding-accounts/:id`
  Owner/Manager 전용 자금수단 생성, 이름 변경, 비활성화/재활성화, 비활성 자금수단 종료와 workspace 범위 접근통제를 검증
- `POST /categories`, `PATCH /categories/:id`
  Owner/Manager 전용 카테고리 생성, 이름 변경, 비활성화/재활성화와 workspace 범위 접근통제를 검증
- `GET /accounting-periods`, `GET /accounting-periods/current`, `POST /accounting-periods`, `POST /accounting-periods/:id/close`, `POST /accounting-periods/:id/reopen`
  기간 open/close/reopen, snapshot 생성/정리, role 기반 접근통제를 검증
- `GET /collected-transactions`, `POST /collected-transactions`, `POST /collected-transactions/:id/confirm`
  DTO validation, 현재 workspace 접근 범위 내 참조 검증, 생성/확정 응답 shape와 전표 연계를 검증
- `GET /journal-entries`, `POST /journal-entries/:id/reverse`, `POST /journal-entries/:id/correct`
  최근 전표 조회, reverse/correct 조정 흐름, role 기반 접근통제를 검증
- `POST /recurring-rules`
  DTO validation, 현재 workspace 접근 범위 내 계정/카테고리 검증, 생성 응답 shape
- 계획 항목 생성 정책과 service/view 조합
- 계획 항목 view에 매칭 수집 거래 제목/상태와 전표 번호가 함께 실리는지 검증
- 거래/반복규칙 use-case 생성 로직
- `GET /import-batches`, `GET /import-batches/:id`, `POST /import-batches`, `POST /import-batches/:id/rows/:rowId/collect-preview`, `POST /import-batches/:id/rows/:rowId/collect`
  UTF-8 텍스트 업로드 파싱, row collect preview, duplicate fingerprint 처리, 자동 계획 매칭/카테고리 보완 설명, role 기반 접근통제를 검증
- `POST /financial-statements/generate`, `GET /financial-statements`
  잠금 기간 공식 snapshot 생성/조회와 비교 view 조합을 검증
- `POST /carry-forwards/generate`, `GET /carry-forwards`
  closing snapshot 기반 차기 이월 생성과 조회를 검증
- 대시보드 요약 계산
- 예측 잔액 계산
- `GET /health`, `GET /health/ready`
- `x-request-id` 헤더 전달
- 허용된 origin에 대한 CORS/security header 적용
- 인증/민감 응답의 `Cache-Control: no-store`
- allowlist 밖 origin의 cookie-auth 요청 차단(`403 Origin not allowed`)
- 로그인 실패, refresh 재사용, bearer 누락, scope 거부, readiness 실패에 대한 보안 이벤트 로그 기록
- `test:prisma`
  실제 MySQL 기준으로 현재 workspace 접근 범위 확인, 수집 거래 저장소 경계, 실제 API를 통한 기간/업로드/수집/전표/보고 대표 시나리오를 함께 검증
- `GET /collected-transactions`
  현재 구현 기준 current workspace 범위만 반환하는지, 내부 접근 제어 필드를 노출하지 않는지 검증
- `GET /recurring-rules`
  현재 구현 기준 current workspace 범위만 반환하는지, 내부 접근 제어 필드를 노출하지 않는지 검증
- `GET /dashboard/summary`
  다른 workspace/ledger 데이터가 집계에 섞이지 않고 raw read model을 노출하지 않는지 검증
- `GET /forecast/monthly`
  현재 구현 기준 current workspace 집계만 사용하고 month query를 그대로 반영하는지 검증

### Web

- env 파싱
- demo fallback 활성화/비활성화 정책
- 보호 요청의 Bearer 토큰 주입
- `401` 응답 시 세션 정리 정책
- mutation 요청의 JSON body 직렬화
- 요청 실패 메시지 안내
- 브라우저에서 `/transactions` 보호 라우트(Collected Transactions 화면) 리다이렉트
- 브라우저 기준 로그인 후 세션 복원
- 실제 브라우저 상호작용으로 거래 Quick Add 성공 및 목록 갱신
- `/transactions` 진입 시 기준 데이터 readiness API가 함께 조회되어도 브라우저 스모크가 계속 통과하는지 검증
- 실제 브라우저 상호작용으로 `/reference-data`에서 자금수단 생성, 수정, 비활성화/재활성화, 비활성 자금수단 종료와 카테고리 생성/수정/비활성화/재활성화가 동작하는지 검증
- 실제 브라우저 상호작용으로 `/recurring`에서 반복 규칙 생성, 수정, 삭제와 목록 반영이 동작하는지 검증
- 실제 브라우저 상호작용으로 `/insurances`에서 보험 계약 생성, 수정, 비활성화와 목록 반영이 동작하는지 검증
- 실제 브라우저 상호작용으로 `/vehicles`에서 차량 생성, 수정, 연료 이력 생성/수정, 정비 이력 생성/수정과 목록 반영이 동작하는지 검증
- `npm run test:e2e:smoke:build`로 in-process production build/start 경로에 결과물을 올린 뒤 health route 응답 기준 최소 HTTP smoke를 자동 검증
- `npm run test:e2e:smoke:build:browser`로는 로그인/세션 복원, 운영 체크리스트 핵심 CTA, 작업 문맥 fallback 같은 브라우저 build smoke를 루트 래퍼 경로로 필요 시 별도로 검증
- CI의 `e2e-smoke` 잡은 개발 서버가 아니라 build 결과물 기준 HTTP smoke를 실행
- 실제 브라우저 상호작용으로 `dashboard`, `transactions`, `reference-data`, `financial-statements`, `carry-forwards`, `settings`의 대표 운영 체크리스트 empty state, readiness 경고, fallback CTA가 유지되는지 검증
- 기준 데이터 CRUD, 반복 규칙 CRUD, 보험 계약 CRUD, 차량 기본 정보 CRUD 브라우저 검증은 현재 `npm run test:e2e` 전체 브라우저 회귀 범위에 남기고, CI smoke에서는 제외합니다.

## 현재 남아 있는 공백

- 차량 연료/정비 이력 분리와 `monthlyExpenseWon` 전환 기준 고정은 끝났지만, `monthlyExpenseWon` 물리 필드 제거와 `VehicleOperatingSummary` read model의 실제 projection 구현은 후속 작업으로 남아 있음
- `.github/workflows/ci.yml`의 `prisma-integration` job wiring은 반영되었지만, 실제 GitHub 저장소/조직 secret `PRISMA_INTEGRATION_DATABASE_URL` 등록과 첫 통과 증적 확보는 저장소 밖 후속 작업으로 남아 있음
- Docker가 없는 개발 PC에서는 `semgrep-ce`, `gitleaks`를 로컬에서 CI와 동일하게 재현하기 어려움
- Windows `core.autocrlf=true` checkout에서는 `npm run check:quick`의 Prettier 단계가 CI(Ubuntu LF 기준)와 다르게 보일 수 있음
- `npm run audit:runtime`는 현재 `critical` 기준으로 gate를 걸고 있으며, 2026-04-05 재검증 기준 runtime `high` 4건은 upstream Nest 패키지의 exact dependency pin으로 남아 있어 예외 추적으로 관리 중임

## 2026-04-05 Runtime Audit Follow-up

- 실행: `npm run audit:runtime:full`과 동등한 runtime `npm audit --omit=dev --workspace @personal-erp/api --workspace @personal-erp/web --json`
- 결과: `critical 0`, `high 4`
- 분류:
  - `@nestjs/config@4.0.3 -> lodash@4.17.23`
  - `@nestjs/swagger@11.2.6 -> lodash@4.17.23`
  - `@nestjs/swagger@11.2.6 -> path-to-regexp@8.3.0`
  - `express -> router@2.2.0 -> path-to-regexp@8.3.0`
- 같은 날 npm registry 기준 최신 배포 버전도 `@nestjs/config 4.0.3`, `@nestjs/swagger 11.2.6`이며, 패키지 내부 dependency가 각각 `lodash 4.17.23`, `path-to-regexp 8.3.0`으로 고정돼 있어 로컬 비파괴 업그레이드 경로가 확인되지 않았습니다.
- 결론: 현재 CI gate는 `npm run audit:runtime`의 `critical` 기준을 유지하고, 위 4건은 upstream 릴리스 또는 안전한 대체 경로가 나올 때까지 `tracked exception`으로 관리합니다.

## 해석

현재 검증체계는 성공 경로 계약, 인증, DTO validation, 접근 범위 검증, readiness/request-id 같은 운영 신호, 핵심 쓰기 흐름, 대표 브라우저 사용자 흐름까지를 자동으로 막는 상태입니다.
`npm run test:e2e`, `npm run test:prisma`는 빠른 기본 테스트와 분리된 대표 심화 검증으로 유지합니다.
다음 보강 우선순위는 `PRISMA_INTEGRATION_DATABASE_URL` GitHub secret 등록과 첫 `prisma-integration` 통과 증적 확보, Docker 기반 로컬 CI 재현성 보강입니다.
