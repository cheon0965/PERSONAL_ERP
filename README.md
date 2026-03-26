# Personal ERP Starter

개인 현금흐름을 ERP처럼 관리할 수 있도록 구성한 워크스페이스형 스타터입니다.
실제 거래, 반복규칙, 보험, 차량비, 월말 예측을 한 구조 안에서 다루도록 설계했습니다.

## 현재 상태

- 프론트엔드: Next.js App Router + TypeScript + MUI
- 백엔드: NestJS + Prisma + MySQL
- 공용 계약 계층: `packages/contracts`
- 인증 기본 정책: `login`, `health`를 제외한 API는 기본적으로 보호
- 프론트 fallback 정책: 개발 환경에서 명시적으로 켠 경우에만 demo fallback 허용
- 검증 기준: `npm run check:quick`, `npm run test`

## 빠른 시작

### 1. SECRET 폴더 경로 확인

현재 프로젝트는 루트의 [.secret-dir.local](/d:/참고자료/프로젝트소스/personal-erp-starter/.secret-dir.local#L1) 파일을 기준으로 외부 SECRET 폴더를 읽습니다.

현재 기준 경로:

```env
PERSONAL_ERP_SECRET_DIR=C:\secrets\personal-erp
```

즉, 실제로 수정해야 하는 파일은 저장소 안이 아니라 아래 두 파일입니다.

```text
C:\secrets\personal-erp\api.env
C:\secrets\personal-erp\web.env
```

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
- Swagger: `http://localhost:4000/api/docs`

## 주소 설정에서 가장 중요한 두 값

- `web.env`의 `NEXT_PUBLIC_API_BASE_URL`
  프론트가 호출할 API 주소입니다.
- `api.env`의 `APP_ORIGIN`
  API가 CORS로 허용할 프론트 주소입니다.

로컬 예시:

```env
# C:\secrets\personal-erp\web.env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

```env
# C:\secrets\personal-erp\api.env
APP_ORIGIN=http://localhost:3000
```

## 주요 명령

```bash
npm run check:quick
npm run test
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
  docs/         # 아키텍처, 개발, 운영 문서
```

## 협업 원칙

- API 계약 변경은 `packages/contracts`를 먼저 갱신합니다.
- DB 스키마 변경은 `prisma migrate dev` 기준으로 migration 파일을 남깁니다.
- Web은 `app -> features -> shared` 경계를 유지합니다.
- 비밀값은 저장소 밖 SECRET 폴더에서 관리하고, 저장소에는 경로 설정만 남깁니다.
- demo fallback은 기본적으로 끄고, 로컬 개발에서만 명시적으로 켭니다.
- PR 전에는 최소 `npm run check:quick`와 `npm run test`를 실행합니다.

## 데모 계정

- Email: `demo@example.com`
- Password: `Demo1234!`

## 문서

- [환경변수 설정](./ENVIRONMENT_SETUP.md)
- [기여 가이드](./CONTRIBUTING.md)
- [아키텍처](./docs/ARCHITECTURE.md)
- [개발 가이드](./docs/DEVELOPMENT_GUIDE.md)
- [API 개요](./docs/API.md)
- [디자인 시스템](./docs/DESIGN_SYSTEM.md)
- [프로젝트 계획](./docs/PROJECT_PLAN.md)
- [검증 메모](./docs/VALIDATION_NOTES.md)
- [fallback 정책](./docs/FALLBACK_POLICY.md)
- [ADR 목록](./docs/adr/README.md)
