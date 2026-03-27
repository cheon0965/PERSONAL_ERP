# Environment Setup

이 문서는 현재 프로젝트의 env 구조와 Windows Server 배포 준비 관점에서 필요한 설정을 함께 정리한 문서입니다.
기준은 `외부 SECRET 폴더 우선`, `앱 로컬 fallback 허용`, `로컬 개발과 운영 설정 분리`입니다.

실제 배포 순서, 수동 스모크 체크, 운영 장애 대응 순서는 [배포/운영 체크리스트](./docs/OPERATIONS_CHECKLIST.md) 를 기준으로 봅니다.

## 1. 현재 기준 경로

현재 프로젝트는 루트의 [`.secret-dir.local`](./.secret-dir.local) 파일을 통해 외부 SECRET 폴더를 지정합니다.

현재 값:

```env
PERSONAL_ERP_SECRET_DIR=C:\secrets\personal-erp
```

이 경로는 Windows 예시입니다. macOS/Linux에서는 같은 의미로 아래처럼 절대 경로를 사용하면 됩니다.

```env
PERSONAL_ERP_SECRET_DIR=/Users/<name>/secrets/personal-erp
```

따라서 현재 실제 기준 파일은 아래 두 개입니다.

```text
C:\secrets\personal-erp\api.env
C:\secrets\personal-erp\web.env
```

경로를 바꾸고 싶다면 `.secret-dir.local`의 값만 수정하면 됩니다.

## 2. 먼저 이해할 원칙

- 저장소 안에 실제 비밀값을 커밋하지 않습니다.
- 실제 비밀값은 `PERSONAL_ERP_SECRET_DIR`가 가리키는 위치의 `api.env`, `web.env`에 둡니다.
- 셸이나 CI에서 직접 주입한 환경변수가 가장 우선합니다.
- 그다음은 `PERSONAL_ERP_SECRET_DIR`가 가리키는 SECRET 파일입니다.
- 마지막으로 API는 `apps/api/.env`, Web은 `apps/web/.env.local` fallback을 허용합니다.

예시 파일:

- 루트 secret-dir 예시: [`.env.example`](./.env.example)
- API fallback 예시: [`apps/api/.env.example`](./apps/api/.env.example)
- Web fallback 예시: [`apps/web/.env.local.example`](./apps/web/.env.local.example)

## 3. 적용 편의성 순위

아래 순서는 지금 바로 반영하기 쉬운 항목부터 정리한 것입니다.

### 1순위. SECRET 폴더 위치 확인

가장 먼저 확인할 파일은 루트의 [`.secret-dir.local`](./.secret-dir.local) 입니다.

현재 기준:

```env
PERSONAL_ERP_SECRET_DIR=C:\secrets\personal-erp
```

즉 실제 사용 파일은 아래 두 개입니다.

```text
C:\secrets\personal-erp\api.env
C:\secrets\personal-erp\web.env
```

### 2순위. Web과 API 주소 맞추기

운영 전에 가장 많이 꼬이는 값이 이 두 개입니다.

- `web.env`의 `NEXT_PUBLIC_API_BASE_URL`
- `api.env`의 `APP_ORIGIN`
- `api.env`의 `CORS_ALLOWED_ORIGINS`
- `api.env`의 `SWAGGER_ENABLED`

역할 차이:

- `NEXT_PUBLIC_API_BASE_URL`
  프론트가 실제로 API를 호출할 주소입니다.
- `APP_ORIGIN`
  API가 CORS로 허용할 프론트 주소입니다.
- `CORS_ALLOWED_ORIGINS`
  브라우저 요청을 허용할 origin allowlist입니다. 여러 값을 쓸 때는 쉼표로 구분합니다.
- `SWAGGER_ENABLED`
  `/api/docs` 노출 여부를 제어합니다. 운영에서는 `false`를 검토합니다.

로컬 개발 예시:

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

운영 예시:

```env
# C:\secrets\personal-erp\web.env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
```

```env
# C:\secrets\personal-erp\api.env
APP_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
SWAGGER_ENABLED=false
```

### 3순위. DATABASE_URL 정확히 작성하기

형식:

```env
DATABASE_URL=mysql://<username>:<password>@<host>:<port>/<database>
```

각 위치 의미:

- `<username>`: DB 사용자명
- `<password>`: DB 비밀번호
- `<host>`: DB 서버 주소
- `<port>`: DB 포트
- `<database>`: 데이터베이스 이름

현재 로컬 Docker 기준 예시:

```env
DATABASE_URL=mysql://erp_user:erp_password_local_2026@localhost:3306/personal_erp
```

운영 서버 예시:

```env
DATABASE_URL=mysql://erp_user:StrongPassword123!@10.0.0.25:3306/personal_erp
```

주의:

- 비밀번호에 `@`, `:`, `/`, `?`, `#` 같은 문자가 있으면 URL 인코딩이 필요합니다.
- 로컬 Docker 계정과 운영 DB 계정은 분리하는 편이 안전합니다.

### 4순위. JWT 시크릿과 토큰 만료시간 확인

API는 아래 값을 필수로 사용합니다.

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`

권장 원칙:

- `JWT_ACCESS_SECRET`와 `JWT_REFRESH_SECRET`는 서로 다른 값으로 둡니다.
- 충분히 긴 랜덤 문자열을 사용합니다.
- 운영 서버마다 새로 발급하고 재사용하지 않는 편이 좋습니다.

현재 로컬 기본 예시:

```env
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
```

참고:

- 여기서 저장하는 것은 `JWT 서명용 비밀키`입니다.
- 로그인 후 발급되는 `accessToken`, `refreshToken` 자체를 env 파일에 넣는 것은 아닙니다.

### 5순위. Demo 옵션 확인

웹은 개발 중에만 demo fallback을 제한적으로 허용합니다.

```env
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

운영에서는 항상 `false`가 권장입니다.

## 4. env 로딩 우선순위

실행 시 env는 아래 순서로 적용됩니다.

1. 셸, CI, 서버 서비스에서 직접 주입한 환경변수
2. `PERSONAL_ERP_SECRET_DIR`가 가리키는 `api.env`, `web.env`
3. 앱 로컬 fallback 파일

fallback 경로:

- API: `apps/api/.env`
- Web: `apps/web/.env.local`

## 5. 로컬 개발용 권장 설정

### C:\secrets\personal-erp\api.env

```env
PORT=4000
APP_ORIGIN=http://localhost:3000
CORS_ALLOWED_ORIGINS=http://localhost:3000
SWAGGER_ENABLED=true
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-another-long-random-string
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
DATABASE_URL=mysql://erp_user:erp_password_local_2026@localhost:3306/personal_erp
DEMO_EMAIL=demo@example.com
```

### C:\secrets\personal-erp\web.env

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

## 6. Windows Server 운영용 권장 설정

이 프로젝트는 Windows Server에서도 Node 프로세스로 배포할 수 있습니다.
다만 로컬 개발값을 그대로 복사하는 방식은 권장하지 않습니다.

### 운영 전 필수 준비물

- Node.js 22 이상
- npm 설치
- 접속 가능한 MySQL 서버
- Web과 API를 나눠 실행할 포트 계획
- reverse proxy 또는 외부 포트 노출 방식 결정
- 방화벽 허용 포트 정리

### 운영용 api.env 예시

```env
PORT=4000
APP_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
SWAGGER_ENABLED=false
JWT_ACCESS_SECRET=replace-with-production-access-secret
JWT_REFRESH_SECRET=replace-with-production-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
DATABASE_URL=mysql://erp_user:replace-with-production-password@db.example.com:3306/personal_erp
DEMO_EMAIL=demo@example.com
```

### 운영용 web.env 예시

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

### 운영에서 권장하는 실행 방식

- Web과 API는 각각 별도 프로세스로 분리 실행합니다.
- 루트 `npm run start`는 빠른 확인용으로는 편하지만, 운영에서는 개별 서비스 관리가 더 안전합니다.

예시:

```bash
npm run build
npm run start --workspace @personal-erp/api
npm run start --workspace @personal-erp/web
```

## 7. Windows Server 반영 체크리스트

### 배포 전

- `PERSONAL_ERP_SECRET_DIR` 위치 확인
- `api.env`, `web.env` 값 확인
- `APP_ORIGIN`과 `NEXT_PUBLIC_API_BASE_URL` 조합 확인
- `DATABASE_URL` 접속 정보 확인
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false` 확인
- `npm run build` 성공 확인
- 필요 시 `npm run db:deploy` 준비

### 배포 후

- API 접속 확인: `http://<server>:4000/api/health`
- Web 접속 확인
- 로그인 동작 확인
- Swagger 확인: `http://<server>:4000/api/docs`
- DB 연결 확인
- CORS 오류 여부 확인

## 8. 운영에서 피해야 할 설정

- 로컬 개발용 DB 계정과 운영 DB 계정을 동일하게 사용하지 않습니다.
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`로 운영하지 않습니다.
- 외부 SECRET 폴더의 실제 비밀 파일을 저장소에 복사해 커밋하지 않습니다.
- 운영 서버에서 개발용 Docker MySQL 기본 비밀번호를 재사용하지 않습니다.
- 같은 JWT 시크릿을 여러 환경에서 재사용하지 않는 편이 좋습니다.

## 9. 검증 코드 위치

- API env 검증: [api-env.ts](./apps/api/src/config/api-env.ts#L1)
- Web env 검증: [env.ts](./apps/web/src/shared/config/env.ts#L1)
- env 로더: [run-with-root-env.cjs](./scripts/run-with-root-env.cjs#L1)

## 10. 함께 보면 좋은 문서

- [README.md](./README.md)
- [docs/OPERATIONS_CHECKLIST.md](./docs/OPERATIONS_CHECKLIST.md)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- [docs/DEVELOPMENT_GUIDE.md](./docs/DEVELOPMENT_GUIDE.md)
- [PORTFOLIO_ARCHITECTURE_GUIDE.md](./PORTFOLIO_ARCHITECTURE_GUIDE.md)
