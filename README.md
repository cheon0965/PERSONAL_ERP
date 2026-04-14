# PERSONAL_ERP Starter

1인 사업자와 소상공인이 월별 재무 운영 사이클을 ERP처럼 관리할 수 있도록 구성한 워크스페이스형 스타터입니다.
실제 거래, 반복규칙, 업로드 배치, 월 운영, 공식 보고까지 한 구조 안에서 다루도록 설계했습니다.
프로젝트 이름은 `PERSONAL_ERP`이며, README 상단의 `Starter` 표기는 아직 진행 중인 현재 단계와 프로젝트 성격을 설명하기 위한 표현입니다.
저장소/패키지 식별자와 환경 변수 키는 기존 identifier 규칙에 맞춰 `personal-erp`, `PERSONAL_ERP_*` 형태를 계속 사용합니다.

## 포트폴리오 리뷰 포인트: 회계 경계 정리 결과

리뷰어가 가장 빠르게 확인해야 하는 점은 "레거시 `Transaction`을 어떻게 정리했는가"와 "현재 공식 회계 원장이 무엇인가"입니다.
이 저장소의 공식 회계 흐름은 `CollectedTransaction -> JournalEntry / JournalLine -> ClosingSnapshot -> FinancialStatementSnapshot -> CarryForwardRecord`로 고정했고, 레거시 Prisma `Transaction` 모델과 관련 관계는 제거를 완료했습니다.
현재는 pre-phase1 정합성 보조 backbone과 경계 회귀 테스트만 남겨 두고, 신규 기능이 다시 레거시 표면을 도입하지 못하도록 막고 있습니다.

| 단계                | 목표                                                                            | 현재 상태 |
| ------------------- | ------------------------------------------------------------------------------- | --------- |
| 1. 의존성 동결      | 신규 입력, 확정, 마감, 공식 보고를 모두 신규 회계 흐름에만 올린다               | 완료      |
| 2. 브리지 표면 축소 | shorthand 명칭, 문서, 테스트/호환 레이어에 남은 흔적만 줄인다                   | 완료      |
| 3. 제거 준비        | Prisma migration, seed/test 정리, backfill/rollback 기준과 삭제 순서를 확정한다 | 완료      |
| 4. 스키마 제거      | 레거시 `Transaction` 및 관련 관계를 제거하고 문서/검증 기준을 함께 맞춘다       | 완료      |

상세 기준과 제거 게이트는 [`docs/ACCOUNTING_MODEL_BOUNDARY.md`](./docs/ACCOUNTING_MODEL_BOUNDARY.md)에 유지합니다.

## 현재 상태

- 프론트엔드: Next.js App Router + TypeScript + MUI
- 백엔드: NestJS + Prisma + MySQL
- 공용 계약 계층: `packages/contracts`
- 공용 금액 계층: `packages/money`의 `MoneyWon` parser/helper를 기준으로 원 단위 safe integer, `Decimal(19,0)` 영속 컬럼, `HALF_UP` 반올림/배분 잔차 보정을 통일
- 인증 기본 정책: `auth/register`, `auth/verify-email`, `auth/resend-verification`, `auth/login`, `auth/refresh`, `auth/logout`, `health`, `health/ready`를 제외한 API는 기본적으로 보호
- Web 인증 세션: `/register`, `/verify-email`, `/login`, 메모리 기반 access token 유지, `POST /auth/refresh` 기반 사용자 복원
- 핵심 운영 흐름: 기준 데이터 준비 -> 월 운영 시작 -> 보험/차량 운영 기준 정리 -> 반복규칙 -> 계획 항목 -> 수집 거래/업로드 배치 -> 전표 확정/반전/정정 -> 월 마감 -> 재무제표 -> 차기 이월 -> 기간 전망까지 한 달 사이클로 연결됨
- 기준 데이터 운영: readiness 요약, 자금수단/카테고리 제한적 관리, 자금수단 `ACTIVE/INACTIVE/CLOSED` lifecycle 일부 지원
- 요청 단위 검증: auth, reference-data, accounting-periods, collected-transactions/journal-entries, import-batches, financial-statements/carry-forwards, dashboard/forecast의 현재 workspace 접근 범위와 계약 검증 포함
- 대표 브라우저 E2E: 보호 라우트, 로그인/세션 복원, 거래 저장, 기준 데이터 관리, 반복 규칙 관리, 운영 체크리스트 empty state와 fallback CTA까지 대표 smoke 자동 검증
- 운영 신호: 모든 API 응답에 `x-request-id` 헤더 부여, `GET /api/health/ready` 준비 상태 확인 지원
- CI 게이트: `validate`, `e2e-smoke`(build 결과물 기준), `security-regression`, `prisma-integration`, `audit-runtime`, `Semgrep CE`, `Gitleaks`
- 프론트 fallback 정책: 개발 환경에서 명시적으로 켠 경우에만 demo fallback 허용
- 검증 기준: `npm run check:quick`, `npm run test`

## 빠른 시작

먼저 참고할 예시 파일:

- 루트 secret-dir 예시: [`env-examples/secret-dir.local.example`](./env-examples/secret-dir.local.example)
- API env 예시: [`env-examples/api.env.example`](./env-examples/api.env.example)
- Web env 예시: [`env-examples/web.env.example`](./env-examples/web.env.example)

### 1. SECRET 폴더 경로 확인

현재 프로젝트는 셸/CI의 `PERSONAL_ERP_SECRET_DIR` 또는 루트의 [`.secret-dir.local`](./.secret-dir.local) 파일을 기준으로 외부 SECRET 폴더를 읽습니다.

현재 기준 경로:

```env
PERSONAL_ERP_SECRET_DIR=C:\secrets\personal-erp
```

위 경로는 Windows 예시입니다. macOS/Linux에서는 같은 의미로 아래처럼 절대 경로를 사용하면 됩니다.

```env
PERSONAL_ERP_SECRET_DIR=/Users/<name>/secrets/personal-erp
```

즉, 실제로 수정해야 하는 파일은 저장소 안이 아니라 아래 두 파일입니다.

```text
C:\secrets\personal-erp\api.env
C:\secrets\personal-erp\web.env
```

Windows 편의용으로 `.bat` 스크립트를 함께 두고 있지만, 기본 실행 흐름은 `npm` 명령과 [`scripts/run-with-root-env.cjs`](./scripts/run-with-root-env.cjs) 기준이라 macOS/Linux에서도 그대로 따라갈 수 있습니다.

경로를 바꾸고 싶다면 `.secret-dir.local`의 값만 바꾸면 됩니다.

### 2. env 파일 준비

현재 구조에서 실제 기준 파일은 아래 두 개입니다.

- `C:\secrets\personal-erp\api.env`
- `C:\secrets\personal-erp\web.env`

프로젝트는 실행 시 아래 순서로 값을 읽습니다.

1. 셸/CI 환경변수
2. `PERSONAL_ERP_SECRET_DIR`가 가리키는 외부 SECRET 파일
3. 앱 로컬 fallback 파일

fallback 경로:

- API: `apps/api/.env`
- Web: `apps/web/.env.local`

빠르게 시작하려면:

- 루트 SECRET 폴더 포인터가 필요하면 `env-examples/secret-dir.local.example`을 `.secret-dir.local`로 복사
- 외부 SECRET 폴더를 쓰면 `env-examples/api.env.example`을 `<PERSONAL_ERP_SECRET_DIR>/api.env`로, `env-examples/web.env.example`을 `<PERSONAL_ERP_SECRET_DIR>/web.env`로 복사
- 앱 로컬 fallback이 필요하면 같은 예시 파일을 `apps/api/.env`, `apps/web/.env.local`로 복사

### 3. 의존성 설치

```bash
npm install
```

### 4. MySQL 실행

```bash
npm run db:up
```

`npm run db:up`는 [docker-compose.yml](./docker-compose.yml)에 정의된 폐기 가능한 로컬 개발 전용 MySQL bootstrap 기본값을 사용합니다.
이 값은 로컬 단일 개발자 환경에서 바로 실행되도록 둔 고정 기본값이며, shared/staging/production 자격정보로 재사용하지 않습니다.
기존 로컬 volume을 이전 기본값으로 이미 초기화했다면, 새 기본값을 쓰려면 로컬 MySQL volume을 한 번 비우고 다시 올려야 합니다.

### 5. 마이그레이션과 시드 실행

```bash
npm run db:migrate
npm run db:seed
```

### 6. 개발 서버 실행

```bash
npm run dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 주소와 노출 설정에서 중요한 값

- `web.env`의 `NEXT_PUBLIC_API_BASE_URL`
  프론트가 호출할 API 주소입니다.
- `api.env`의 `APP_ORIGIN`
  API가 CORS로 허용할 프론트 주소입니다.
- `api.env`의 `CORS_ALLOWED_ORIGINS`
  브라우저 요청을 허용할 origin allowlist입니다. 비워두면 `APP_ORIGIN` 하나만 사용합니다.
- `api.env`의 `SWAGGER_ENABLED`
  `/api/docs` 노출 여부를 제어하는 토글이며 기본값은 `false`입니다.

로컬 예시:

```env
# C:\secrets\personal-erp\web.env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

```env
# C:\secrets\personal-erp\api.env
APP_ORIGIN=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
SWAGGER_ENABLED=true
```

## 주요 명령

```bash
npm run check:quick
npm run test
npm run test:security:api
npm run test:prisma
npm run test:e2e
npm run test:e2e:smoke:build
npm run ci:local:core
npm run ci:local:prisma
npm run ci:local:docker
npm run audit:runtime
npm run audit:runtime:full
npm run build
npm run db:status
npm run db:deploy
```

- `npm run check:quick`에는 문서의 `npm run` 표기가 실제 루트/workspace 스크립트와 맞는지 보는 `npm run docs:check:npm-run`이 포함됩니다.
- `npm run check:quick`에는 `npm run docs:check`도 포함되며, 여기서 문서의 `npm run` 표기와 `docs/API.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface가 실제 라우트와 controller 기반 Swagger surface와 맞는지 함께 확인합니다.
- `npm run audit:runtime`는 CI gate용 `critical` 기준 점검이고, `npm run audit:runtime:full`은 남아 있는 `high` advisory까지 포함한 상세 재검토용입니다.
- `npm run test:prisma`는 로컬에서는 `PRISMA_INTEGRATION_DATABASE_URL` 우선, `DATABASE_URL` fallback을 허용하지만 CI에서는 `PRISMA_INTEGRATION_DATABASE_URL` 전용으로 동작합니다.
- `npm run ci:local:core`는 `validate + e2e-smoke + security-regression + audit-runtime`에 가까운 로컬 기본 루프입니다.
- `npm run ci:local:prisma`는 CI의 `prisma-integration` job을 로컬 DB 기준으로 다시 확인하는 진입점입니다.
- `npm run ci:local:docker`는 Docker가 준비된 환경에서 `semgrep-ce + gitleaks`를 같은 이미지와 인자 기준으로 다시 실행합니다.

## 워크스페이스 구조

```text
PERSONAL_ERP/
  apps/
    api/        # NestJS API
    web/        # Next.js Web
  packages/
    contracts/  # 공용 요청/응답 계약
  docs/         # 도메인, 아키텍처, 개발, 운영 문서
```

## 아키텍처 요약

PERSONAL_ERP는 **1인 사업자와 소상공인이 제한된 리소스 안에서도 월별 재무 운영, 거래 확정, 마감, 공식 보고를 안정적으로 이어갈 수 있도록 설계한 TypeScript 기반 워크스페이스형 월별 재무 운영 시스템**입니다.
즉, 범용 소상공인 ERP 전반보다는 월별 재무운영 사이클을 끝까지 닫는 흐름에 초점을 맞춥니다.

### 왜 이런 구조를 선택했나

- **Next.js + NestJS + TypeScript**
  - 프론트엔드와 백엔드가 같은 언어와 타입 시스템을 사용합니다.
  - `packages/contracts`를 통해 API 요청/응답 계약을 공유하여, 스펙 불일치를 개발 단계에서 더 빨리 발견할 수 있도록 했습니다.

- **Modular Monolith**
  - 하나의 애플리케이션과 하나의 데이터베이스로 운영 복잡도는 낮게 유지합니다.
  - 대신 내부는 도메인 단위로 나누어, 기능이 커져도 코드가 무질서하게 섞이지 않도록 했습니다.

- **Selective Hexagonal / Layered**
  - 핵심 비즈니스 규칙이 많은 쓰기 흐름은 use-case / port 중심으로 더 엄격하게 분리했습니다.
  - 단순 CRUD 중심 기능은 레이어드 구조를 사용해 불필요한 추상화 비용을 줄였습니다.

### 핵심 목표

이 프로젝트의 목표는 패턴을 많이 적용하는 것이 아니라,  
**작은 팀이 실제로 개발하고 운영할 수 있는 수준에서 설명 가능하고 유지 가능한 구조를 만드는 것**입니다.

## 협업 원칙

- API 계약 변경은 `packages/contracts`를 먼저 갱신합니다.
- DB 스키마 변경은 `prisma migrate dev` 기준으로 migration 파일을 남깁니다.
- Web은 `app -> features -> shared` 경계를 유지합니다.
- 비밀값은 저장소 밖 SECRET 폴더에서 관리하고, 저장소에는 경로 설정만 남깁니다.
- 단, `docker-compose.yml`의 MySQL 계정은 `npm run db:up` 즉시 실행을 위한 폐기 가능한 로컬 개발 전용 bootstrap 값이며 운영 secret 대체제가 아닙니다.
- demo fallback은 기본적으로 끄고, 로컬 개발에서만 명시적으로 켭니다.
- PR 전에는 최소 `npm run check:quick`와 `npm run test`를 실행합니다.
- 포트폴리오용 압축본은 clean working tree 기준으로 `.git`, `node_modules`, `dist`, `playwright-report`, `test-results`를 제외하고 만듭니다.

## 계약과 문서 기준

- 공유 요청/응답 shape의 1차 기준은 `packages/contracts`입니다.
- 현재 구현된 엔드포인트, DTO validation, 인증 노출 상태의 1차 기준은 Swagger(`http://localhost:4000/api/docs`)입니다.
- 사람이 빠르게 읽는 API 요약과 인증 흐름은 `docs/API.md`에 유지합니다.
- 저장소 진입 설명과 빠른 시작은 `README.md`에만 유지하고, 상세 API 설명은 넣지 않습니다.
- 비즈니스 로직의 시작/끝, 운영 사이클, 권한/회계 정책의 상위 기준은 `docs/domain/business-logic-draft.md`에 유지합니다.
- 핵심 엔티티, Aggregate Root, 불변조건, 관계, 구현 우선순위의 상세 기준은 `docs/domain/core-entity-definition.md`에 유지합니다.
- 도메인 문서의 읽는 순서와 상위 문서 경계는 `docs/domain/README.md`에 유지합니다.
- 다른 문서는 도메인 용어/상태/권한/마감 정책을 중복 정의하지 않고, 필요 시 도메인 문서를 참조하면서 현재 구현 상태만 설명합니다.
- 현재 실제 검증 범위와 남은 공백은 `docs/VALIDATION_NOTES.md`에 유지합니다.
- 실DB Prisma 경계 검증은 `npm run test:prisma`로 별도 실행하고, CI `prisma-integration` job은 `PRISMA_INTEGRATION_DATABASE_URL` secret이 있을 때 같은 경로를 실제 MySQL 경계 검증으로 사용합니다.
- 예외 처리와 최소 로깅 기준은 `docs/ERROR_HANDLING_AND_LOGGING.md`에 유지합니다.
- 중기 제품 로드맵은 `docs/PROJECT_PLAN.md`, 포트폴리오용 아키텍처 목적과 판단 원칙, 현재 구조 설명과 완료된 MSA-ready 경계 정리는 `PORTFOLIO_ARCHITECTURE_GUIDE.md`에 유지합니다.
- API shape나 문서 기준이 바뀌면 같은 PR에서 계약, Swagger, 관련 문서를 함께 맞춥니다.

## 데모 계정

아래 값은 [`env-examples/api.env.example`](./env-examples/api.env.example)의 로컬 개발 기본 예시입니다.

- Email: `demo@example.com`
- Password: `Demo1234!`

## 문서

### 진입점

- [환경변수 설정](./ENVIRONMENT_SETUP.md)
- [문서 인덱스](./docs/README.md)
- [기여 가이드](./CONTRIBUTING.md)

### 도메인

- [도메인 기준 문서 안내](./docs/domain/README.md)
- [비즈니스 로직 설계 초안](./docs/domain/business-logic-draft.md)
- [핵심 엔티티 정의서](./docs/domain/core-entity-definition.md)
- [화면 기준 운영 흐름 가이드](./docs/SCREEN_FLOW_GUIDE.md)

### 아키텍처와 설계

- [아키텍처](./docs/ARCHITECTURE.md)
- [포트폴리오 아키텍처 가이드](./PORTFOLIO_ARCHITECTURE_GUIDE.md)
- [구형 거래 모델과 신규 회계 흐름 경계 및 제거 로드맵](./docs/ACCOUNTING_MODEL_BOUNDARY.md)
- [디자인 시스템](./docs/DESIGN_SYSTEM.md)
- [ADR 목록](./docs/adr/README.md)

### 개발과 운영

- [개발 가이드](./docs/DEVELOPMENT_GUIDE.md)
- [API 개요](./docs/API.md)
- [예외 처리와 로깅 원칙](./docs/ERROR_HANDLING_AND_LOGGING.md)
- [배포/운영 체크리스트](./docs/OPERATIONS_CHECKLIST.md)
- [프로젝트 계획](./docs/PROJECT_PLAN.md)
- [fallback 정책](./docs/FALLBACK_POLICY.md)

### 검증과 보안

- [검증 메모](./docs/VALIDATION_NOTES.md)
- [ASVS L2 실행계획](./docs/ASVS_L2_EXECUTION_PLAN.md)
- [ASVS L2 기준선 매트릭스](./docs/ASVS_L2_BASELINE_MATRIX.md)

### 완료 문서

- [완료 문서 인덱스](./docs/completed/README.md)

완료된 실행 계획과 이력성 설계 문서는 루트 README에 개별 등록하지 않고, 완료 문서 인덱스에서 확인한다.
