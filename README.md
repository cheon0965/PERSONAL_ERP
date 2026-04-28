# PERSONAL_ERP

1인 사업자와 소상공인이 `기준 데이터 준비 -> 월 운영 -> 전표 확정 -> 월 마감 -> 공식 보고 -> 차기 이월 -> 다음 달 전망`까지 한 흐름으로 운영할 수 있도록 만든 워크스페이스형 월별 재무 운영 시스템입니다.
현재 저장소는 Next.js 기반 웹, NestJS 기반 API, Prisma/MySQL, `packages/contracts`, `packages/money`를 한 워크스페이스에서 함께 운영합니다.

## 현재 구현 범위 한눈에 보기

| 영역        | 현재 구현 범위                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 인증/설정   | 회원가입, 이메일 인증, 인증 메일 재발송, 초대 수락, 로그인, 토큰 재발급/로그아웃, `auth/me`, 접근 가능 사업장 목록, 세션 단위 사업장 전환, `현재 사업장 / 장부`, 사업장 설정, 계정 보안/프로필/비밀번호/세션/보안 이벤트        |
| 관리자/권한 | 사업장 설정, 멤버 초대/역할 변경/상태 변경/제거, 메뉴 / 권한 관리, 로그 관리, 권한 정책 요약                                                                                                                                    |
| 운영 지원   | 운영 체크리스트, 예외 처리함, 월 마감, 업로드 운영 현황, 시스템 상태, 알림 / 이벤트 센터, UTF-8 CSV 반출, 운영 메모 / 인수인계                                                                                                  |
| 기준 데이터 | 준비 상태 요약, 자금수단 상태 관리/미사용 삭제, 수입/지출 카테고리 관리, 계정과목/거래유형 조회                                                                                                                                 |
| 월 실행     | 최신 진행월 중심 운영 기간 열기/마감/재오픈, 반복 규칙, 계획 항목 생성, 수집 거래 생성/수정/삭제/확정, UTF-8 텍스트/IM뱅크 텍스트 PDF 업로드 배치, 스캔 PDF 차단, 수집 미리보기/단건 수집/일괄 등록 작업 진행률, 전표 반전/정정 |
| 운영 자산   | 보험 계약, 부채 계약/상환 일정, 차량 기본 정보, 차량 연료 이력, 차량 정비 이력, 차량 운영 요약, 연료/정비 이력의 선택적 수집 거래 연동                                                                                          |
| 보고 / 판단 | 대시보드, 재무제표 스냅샷, 차기 이월, 기간 전망                                                                                                                                                                                 |

현재 구현 상세는 [`docs/CURRENT_CAPABILITIES.md`](./docs/CURRENT_CAPABILITIES.md)에, 데모 체험 흐름은 [`docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md)에 정리합니다.

루트 `/`는 비로그인 사용자에게 제품 소개와 회원가입 안내를 보여주는 공개 메인 화면이며, 인증된 사용자는 `/dashboard`로 이동합니다.

## 월 운영 사이클

`인증 -> 현재 사업장 / 장부 확인 -> 운영 허브 점검 -> 기준 데이터 준비 -> 월 운영 시작 -> 보험/부채/차량 운영 정리 -> 반복 규칙 -> 계획 항목 -> 업로드 배치 또는 수집 거래 -> 전표 확정/반전/정정 -> 월 마감 -> 재무제표 -> 차기 이월 -> 기간 전망`

- 운영 중에는 최신 진행월 하나만 열어 두고, 다음 월은 최근 월을 마감한 뒤 엽니다.
- 수기 입력과 업로드 배치 모두 최신 진행월 안에서 거래를 등록하는 것을 기본으로 하며, 과거 여러 월을 업로드로 되살리는 방식은 사용하지 않습니다.
- 기초금액은 거래 등록 예외가 아니라 시작 잔액 초기화 데이터로 취급합니다.
- 업로드가 운영월을 자동 생성할 수 있는 경우는 아직 운영월이 없는 최초 시작월 또는 최신 잠금월 바로 다음 월의 신규 계좌/카드 시작 설정으로 제한합니다. 거래후잔액이 있는 행은 첫 거래 직전 잔액을 기초금액으로 함께 잡습니다.
- IM뱅크 PDF 업로드는 텍스트 레이어가 있는 원본 PDF만 지원하며, 스캔/이미지 PDF OCR은 별도 ADR 전까지 지원하지 않습니다.
- 차기 이월은 현재 기초 잔액 스냅샷 전용 산출물로 처리하며, 별도 이월 전표를 만들지 않습니다.

## 현재 기술/운영 기준

- 웹 프런트엔드: Next.js App Router + TypeScript + MUI
- 백엔드 API: NestJS + Prisma + MySQL
- 공용 계약: `packages/contracts`
- 공용 금액 기준: `packages/money`의 `MoneyWon`, `Decimal(19,0)`, `HALF_UP`, 배분 잔차 보정
- 인증 기본 정책: `health`, `health/ready`, `auth/register`, `auth/verify-email`, `auth/resend-verification`, `auth/accept-invitation`, `auth/login`, `auth/refresh`, `auth/logout`을 제외한 API는 기본적으로 보호합니다.
- 운영 신호: 모든 API 응답에 `x-request-id` 헤더를 붙이고, `GET /api/health/ready`로 준비 상태 응답을 제공합니다.
- 문서 점검: `npm run docs:check`가 `README.md`, `CONTRIBUTING.md`, `ENVIRONMENT_SETUP.md`, `docs/**/*.md`의 `npm run` 표기와 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 웹/API 노출 범위를 실제 코드와 대조합니다.
- 대표 검증: `npm run check:quick`, `npm run test`, `npm run test:e2e:smoke:build`, `npm run test:e2e`, `npm run test:prisma`

## 회계 경계 핵심

리뷰어가 가장 먼저 확인해야 하는 질문은 "현재 공식 회계 원장이 무엇인가"입니다.
이 저장소의 공식 회계 흐름은 `수집 거래 -> 전표 / 전표 라인 -> 마감 스냅샷 -> 재무제표 스냅샷 -> 차기 이월 기록`으로 고정했고, 레거시 Prisma `Transaction` 모델과 관련 관계는 제거를 완료했습니다.

- 부채 상환은 부채 계약과 상환 일정을 운영 기준으로 관리하고, 계획 항목/수집 거래를 거쳐 전표 확정 시 원금 상환과 이자/수수료 비용을 분리합니다.
- 차량 연료/정비 이력은 별도 전표 경로를 만들지 않고, 사용자가 회계 연동을 켠 경우 표준 수집 거래를 함께 생성한 뒤 같은 전표/마감/보고 흐름을 따릅니다.

- 상세 기준: [`docs/ACCOUNTING_MODEL_BOUNDARY.md`](./docs/ACCOUNTING_MODEL_BOUNDARY.md)
- 도메인 기준: [`docs/domain/business-logic-draft.md`](./docs/domain/business-logic-draft.md), [`docs/domain/core-entity-definition.md`](./docs/domain/core-entity-definition.md)

## 빠른 시작

먼저 참고할 예시 파일:

- 루트 비밀값 폴더 경로 예시: [`env-examples/secret-dir.local.example`](./env-examples/secret-dir.local.example)
- API 환경 파일 예시: [`env-examples/api.env.example`](./env-examples/api.env.example)
- 웹 환경 파일 예시: [`env-examples/web.env.example`](./env-examples/web.env.example)

### 1. 외부 비밀값 폴더 경로 확인

현재 프로젝트는 셸/CI의 `PERSONAL_ERP_SECRET_DIR` 또는 루트의 [`.secret-dir.local`](./.secret-dir.local) 파일을 기준으로 외부 비밀값 폴더를 읽습니다.

현재 기준 경로:

```env
PERSONAL_ERP_SECRET_DIR=C:\secrets\personal-erp
```

Windows 예시 기준 실제 수정 대상은 아래 두 파일입니다.

```text
C:\secrets\personal-erp\api.env
C:\secrets\personal-erp\web.env
```

### 2. 환경 파일 준비

프로젝트는 실행 시 아래 순서로 값을 읽습니다.

1. 셸/CI 환경변수
2. `PERSONAL_ERP_SECRET_DIR`가 가리키는 외부 비밀값 파일
3. 앱 로컬 대체 파일

대체 경로:

- API: `apps/api/.env`
- 웹: `apps/web/.env.local`

상세 예시와 운영용 값은 [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md)를 기준으로 맞춥니다.

### 3. 의존성 설치

```bash
npm install
```

### 4. MySQL 실행

```bash
npm run db:up
```

`npm run db:up`는 [`docker-compose.yml`](./docker-compose.yml)에 정의된 폐기 가능한 로컬 개발 전용 MySQL 시작 기본값을 사용합니다.

### 5. 마이그레이션과 시드 실행

```bash
npm run db:migrate
npm run db:seed
```

### 6. 개발 서버 실행

```bash
npm run dev
```

- 웹: `http://localhost:3000`
- API: `http://localhost:4000/api`
- Swagger: `http://localhost:4000/api/docs` (`SWAGGER_ENABLED=true`일 때)

## 주소와 노출 설정에서 중요한 값

- `web.env`의 `NEXT_PUBLIC_API_BASE_URL`: 프런트엔드가 호출할 API 주소
- `api.env`의 `APP_ORIGIN`: API가 CORS로 허용할 프런트엔드 주소
- `api.env`의 `CORS_ALLOWED_ORIGINS`: 브라우저 요청을 허용할 오리진 목록
- `api.env`의 `SWAGGER_ENABLED`: `/api/docs` 노출 토글, 기본값 `false`

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

- `npm run check:quick`에는 `npm run docs:check`, `npm run money:check`, 린트, 타입 점검이 포함됩니다.
- `npm run docs:check`는 문서의 `npm run` 표기와 현재 웹/API 노출 범위를 실제 코드와 대조합니다.
- `npm run test:prisma`는 Docker 기반 일회성 MySQL을 띄워 `generate -> migrate -> 최소 시드 적재 -> 테스트 -> 정리`를 한 명령으로 수행합니다. 외부 데이터베이스가 꼭 필요할 때만 `PRISMA_INTEGRATION_DATABASE_MODE=existing`과 `PRISMA_INTEGRATION_DATABASE_URL`을 함께 설정합니다.
- `npm run ci:local:core`는 `validate + e2e-smoke + security-regression + audit-runtime`에 가까운 로컬 기본 검증 루프입니다.

## 워크스페이스 구조

```text
PERSONAL_ERP/
  apps/
    api/        # NestJS 기반 API
    web/        # Next.js 기반 웹
  packages/
    contracts/  # 공용 요청/응답 계약
    money/      # MoneyWon 공용 금액 모듈
  docs/         # 도메인, 아키텍처, 개발, 운영 문서
```

## 협업 원칙

- API 계약 변경은 `packages/contracts`를 먼저 갱신합니다.
- 데이터베이스 스키마 변경은 `prisma migrate dev` 기준 마이그레이션 파일을 남깁니다.
- 웹은 `app -> features -> shared` 경계를 유지합니다.
- 비밀값은 저장소 밖 외부 비밀값 폴더에서 관리하고, 저장소에는 경로 설정만 남깁니다.
- 데모 대체 응답은 기본적으로 끄고, 로컬 개발에서만 명시적으로 켭니다.
- PR 전에는 최소 `npm run check:quick`와 `npm run test`를 실행합니다.

## 계약과 문서 기준

- 공유 요청/응답 형태의 1차 기준은 `packages/contracts`
- 구현된 엔드포인트, DTO 검증, 인증 노출 상태의 1차 기준은 Swagger(`http://localhost:4000/api/docs`)
- 기능/운영 범위 한눈에 보기: [`docs/CURRENT_CAPABILITIES.md`](./docs/CURRENT_CAPABILITIES.md)
- 데모 체험 흐름: [`docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md)
- 사람이 빠르게 읽는 API 요약: [`docs/API.md`](./docs/API.md)
- 실제 검증 범위와 공백: [`docs/VALIDATION_NOTES.md`](./docs/VALIDATION_NOTES.md)
- 예외 처리와 최소 로깅 기준: [`docs/ERROR_HANDLING_AND_LOGGING.md`](./docs/ERROR_HANDLING_AND_LOGGING.md)

## 데모 계정

아래 값은 [`env-examples/api.env.example`](./env-examples/api.env.example)의 로컬 개발 기본 예시입니다.

- 이메일: `demo@example.com`
- 비밀번호: `Demo1234!`

업로드 배치 데모는 [`docs/DEMO_GUIDE.md`](./docs/DEMO_GUIDE.md)의 `업로드 배치 데모 루트`와 [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md)의 `로컬 실행 데모` 절차를 기준으로 확인합니다.

## 문서 안내

### 먼저 읽을 문서

- [현재 구현 범위](./docs/CURRENT_CAPABILITIES.md)
- [데모 체험 가이드](./docs/DEMO_GUIDE.md)
- [문서 인덱스](./docs/README.md)
- [환경변수 설정](./ENVIRONMENT_SETUP.md)

### 아키텍처와 도메인

- [아키텍처](./docs/ARCHITECTURE.md)
- [포트폴리오 아키텍처 가이드](./PORTFOLIO_ARCHITECTURE_GUIDE.md)
- [도메인 기준 문서 안내](./docs/domain/README.md)
- [비즈니스 로직 설계 초안](./docs/domain/business-logic-draft.md)
- [핵심 엔티티 정의서](./docs/domain/core-entity-definition.md)

### 개발과 운영

- [개발 가이드](./docs/DEVELOPMENT_GUIDE.md)
- [API 개요](./docs/API.md)
- [배포/운영 체크리스트](./docs/OPERATIONS_CHECKLIST.md)
- [검증 메모](./docs/VALIDATION_NOTES.md)
- [기여 가이드](./CONTRIBUTING.md)

### 이력성 문서

- [완료 문서 인덱스](./docs/completed/README.md)
