# Personal ERP Starter

개인의 월별 재무 운영을 ERP처럼 관리할 수 있도록 구성한 워크스페이스형 스타터입니다.
실제 거래, 반복규칙, 보험, 차량비, 월말 예측을 한 구조 안에서 다루도록 설계했습니다.

## 현재 상태

- 프론트엔드: Next.js App Router + TypeScript + MUI
- 백엔드: NestJS + Prisma + MySQL
- 공용 계약 계층: `packages/contracts`
- 인증 기본 정책: `login`, `health`를 제외한 API는 기본적으로 보호
- Web 인증 세션: `/login`, 메모리 기반 access token 유지, `POST /auth/refresh` 기반 사용자 복원
- 핵심 입력 흐름: 거래/반복규칙 Quick Add 폼이 실제 `POST` mutation과 목록 갱신까지 연결됨
- 요청 단위 검증: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `401`, `GET /auth/me`, 거래/반복규칙 DTO와 현재 접근 범위 검증 포함
- 대표 브라우저 E2E: 보호 라우트 진입, 로그인, 세션 복원, 거래 생성 후 목록 반영까지 자동 검증
- 운영 신호: 모든 API 응답에 `x-request-id` 헤더 부여, `GET /api/health/ready` 준비 상태 확인 지원
- CI 보안 게이트: `CI` 워크플로 안의 보안 job에서 보안 회귀 API 테스트, runtime dependency audit, Semgrep CE, Gitleaks, 조건부 dependency review 실행
- 프론트 fallback 정책: 개발 환경에서 명시적으로 켠 경우에만 demo fallback 허용
- 검증 기준: `npm run check:quick`, `npm run test`

## 빠른 시작

먼저 참고할 예시 파일:

- 루트 secret-dir 예시: [`.env.example`](./.env.example)
- API fallback 예시: [`apps/api/.env.example`](./apps/api/.env.example)
- Web fallback 예시: [`apps/web/.env.local.example`](./apps/web/.env.local.example)

### 1. SECRET 폴더 경로 확인

현재 프로젝트는 루트의 `.env` 또는 [`.secret-dir.local`](./.secret-dir.local) 파일을 기준으로 외부 SECRET 폴더를 읽습니다.

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

- 루트 `.env`가 필요하면 `.env.example`을 복사
- API fallback이 필요하면 `apps/api/.env.example`을 `apps/api/.env`로 복사
- Web fallback이 필요하면 `apps/web/.env.local.example`을 `apps/web/.env.local`로 복사

### 3. 의존성 설치

```bash
npm install
```

### 4. MySQL 실행

```bash
npm run db:up
```

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

## 주소 설정에서 가장 중요한 두 값

- `web.env`의 `NEXT_PUBLIC_API_BASE_URL`
  프론트가 호출할 API 주소입니다.
- `api.env`의 `APP_ORIGIN`
  API가 CORS로 허용할 프론트 주소입니다.
- `api.env`의 `CORS_ALLOWED_ORIGINS`
  브라우저 요청을 허용할 origin allowlist입니다. 비워두면 `APP_ORIGIN` 하나만 사용합니다.
- `api.env`의 `SWAGGER_ENABLED`
  `/api/docs` 노출 여부를 제어하는 토글입니다.

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
npm run audit:runtime
npm run build
npm run db:status
npm run db:deploy
```

## 워크스페이스 구조

```text
personal-erp-starter/
  apps/
    api/        # NestJS API
    web/        # Next.js Web
  packages/
    contracts/  # 공용 요청/응답 계약
  docs/         # 도메인, 아키텍처, 개발, 운영 문서
```

## 협업 원칙

- API 계약 변경은 `packages/contracts`를 먼저 갱신합니다.
- DB 스키마 변경은 `prisma migrate dev` 기준으로 migration 파일을 남깁니다.
- Web은 `app -> features -> shared` 경계를 유지합니다.
- 비밀값은 저장소 밖 SECRET 폴더에서 관리하고, 저장소에는 경로 설정만 남깁니다.
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
- 실DB Prisma 경계 검증은 `npm run test:prisma`로 별도 실행합니다.
- 예외 처리와 최소 로깅 기준은 `docs/ERROR_HANDLING_AND_LOGGING.md`에 유지합니다.
- 중기 제품 로드맵은 `docs/PROJECT_PLAN.md`, 포트폴리오용 아키텍처 목적과 판단 원칙, 현재 구조 설명과 완료된 MSA-ready 경계 정리는 `PORTFOLIO_ARCHITECTURE_GUIDE.md`에 유지합니다.
- API shape나 문서 기준이 바뀌면 같은 PR에서 계약, Swagger, 관련 문서를 함께 맞춥니다.

## 데모 계정

- Email: `demo@example.com`
- Password: `Demo1234!`

- [ASVS L2 실행계획](./docs/ASVS_L2_EXECUTION_PLAN.md)

## 문서

- [환경변수 설정](./ENVIRONMENT_SETUP.md)
- [배포/운영 체크리스트](./docs/OPERATIONS_CHECKLIST.md)
- [기여 가이드](./CONTRIBUTING.md)
- [도메인 기준 문서 안내](./docs/domain/README.md)
- [비즈니스 로직 설계 초안](./docs/domain/business-logic-draft.md)
- [핵심 엔티티 정의서](./docs/domain/core-entity-definition.md)
- [아키텍처](./docs/ARCHITECTURE.md)
- [개발 가이드](./docs/DEVELOPMENT_GUIDE.md)
- [API 개요](./docs/API.md)
- [예외 처리와 로깅 원칙](./docs/ERROR_HANDLING_AND_LOGGING.md)
- [디자인 시스템](./docs/DESIGN_SYSTEM.md)
- [프로젝트 계획](./docs/PROJECT_PLAN.md)
- [포트폴리오 아키텍처 가이드](./PORTFOLIO_ARCHITECTURE_GUIDE.md)
- [검증 메모](./docs/VALIDATION_NOTES.md)
- [fallback 정책](./docs/FALLBACK_POLICY.md)
- [ADR 목록](./docs/adr/README.md)
