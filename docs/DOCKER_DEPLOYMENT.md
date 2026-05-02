# Docker Deployment

이 문서는 현재 저장소 기준으로 Docker 이미지를 만들고, Docker Compose로 `MySQL + migration + API + Web`을 배포하는 순서를 설명한다.

## 먼저 알아둘 것

- 모든 파일 작업은 UTF-8 기준으로 수행한다.
- `docker-compose.yml`은 로컬 개발 MySQL 전용이다. 배포는 `docker-compose.prod.yml`을 사용한다.
- 실제 secret은 저장소에 커밋하지 않는다. 배포용 값은 `.deploy/compose.env`에 둔다.
- `.deploy/`는 git ignore 대상이다.
- 운영 로그인 세션은 HTTPS가 필요하다. refresh cookie가 `__Host-refreshToken`, `Secure`, `HttpOnly`, `SameSite=Strict`로 내려가므로, 공개 운영은 HTTPS reverse proxy 뒤에서 실행해야 한다.
- `NEXT_PUBLIC_API_BASE_URL`은 Web 이미지 빌드 시점에 번들에 들어간다. API 도메인을 바꾸면 Web 이미지를 다시 빌드한다.

## 전체 흐름

처음 배포할 때는 아래 순서대로 진행한다.

1. Docker 설치와 저장소 위치 확인
2. `.deploy/compose.env` 생성
3. secret과 도메인 값 입력
4. Compose 설정 검증
5. Docker 이미지 빌드
6. 컨테이너 기동
7. health check
8. HTTPS reverse proxy 연결
9. 로그인과 주요 화면 스모크 체크

이미지를 다른 서버로 옮겨야 하면 5번에서 `--save` 옵션으로 tar 파일을 만들고, 대상 서버에서 `docker load`를 먼저 수행한다.

## 1. 사전 준비

배포를 실행할 PC 또는 서버에 Docker가 설치되어 있어야 한다.

```powershell
docker --version
docker compose version
```

프로젝트 루트에서 실행해야 한다.

```powershell
cd "D:\PROJECT\PERSONAL_ERP"
```

빌드 전에 현재 코드가 정상인지 확인한다.

```powershell
npm run docs:check
npm run build
```

## 2. 배포 env 파일 만들기

처음 한 번만 만든다.

```powershell
New-Item -ItemType Directory -Force .deploy
Copy-Item -Path env-examples\deploy.compose.env.example -Destination .deploy\compose.env
```

또는 배치 파일을 바로 실행해도 된다. `.deploy\compose.env`가 없으면 예시 파일을 복사한 뒤 멈춘다.

```powershell
.\build-docker-images.bat
```

그 다음 `.deploy\compose.env`를 열어 placeholder 값을 실제 값으로 바꾼다.

## 3. 반드시 바꿀 값

### 이미지 이름과 태그

처음에는 아래 값으로 충분하다.

```dotenv
IMAGE_TAG=latest
API_IMAGE_NAME=personal-erp-api
WEB_IMAGE_NAME=personal-erp-web
MIGRATE_IMAGE_NAME=personal-erp-migrate
```

릴리즈 단위로 구분하려면 `IMAGE_TAG`를 날짜나 버전으로 바꾼다.

```dotenv
IMAGE_TAG=2026-05-01
```

중요: `build-docker-images.bat --tag 2026-05-01`처럼 명령줄로 태그를 지정해 빌드했다면, 컨테이너를 기동할 때도 같은 `IMAGE_TAG`를 써야 한다. 가장 쉬운 방법은 `.deploy\compose.env`의 `IMAGE_TAG`도 같은 값으로 바꾸는 것이다.

### MySQL 값

```dotenv
MYSQL_ROOT_PASSWORD=replace-with-long-random-mysql-root-password
MYSQL_DATABASE=personal_erp
MYSQL_USER=erp_user
MYSQL_PASSWORD=replace-with-long-random-mysql-app-password
DATABASE_URL=mysql://erp_user:replace-with-long-random-mysql-app-password@mysql:3306/personal_erp
```

- `MYSQL_PASSWORD`와 `DATABASE_URL` 안의 비밀번호는 같은 값이어야 한다.
- 비밀번호에 `@`, `:`, `/`, `#`, `?`, `&` 같은 문자가 들어가면 `DATABASE_URL`에서는 URL encoding이 필요하다.
- Compose 내부 MySQL을 사용할 때 host는 `mysql`이다. `localhost`가 아니다.

### Web/API 도메인

운영은 HTTPS 기준으로 입력한다.

```dotenv
APP_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api
NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false
```

- `APP_ORIGIN`: 사용자가 접속하는 Web 주소
- `CORS_ALLOWED_ORIGINS`: API가 허용할 Web origin
- `NEXT_PUBLIC_API_BASE_URL`: 브라우저가 호출할 API 주소

같은 도메인에서 path로 나누는 구조라면 예를 들어 아래처럼 잡을 수 있다.

```dotenv
APP_ORIGIN=https://erp.example.com
CORS_ALLOWED_ORIGINS=https://erp.example.com
NEXT_PUBLIC_API_BASE_URL=https://erp.example.com/api
```

단, 이 경우 reverse proxy에서 `/api/*`는 API 컨테이너로, 나머지는 Web 컨테이너로 보내야 한다.

### 공개 포트

기본값은 같은 서버의 reverse proxy만 접근하도록 `127.0.0.1`에 묶는다.

```dotenv
API_BIND_ADDRESS=127.0.0.1
API_PUBLISHED_PORT=4000
WEB_BIND_ADDRESS=127.0.0.1
WEB_PUBLISHED_PORT=3000
```

외부에서 컨테이너 포트에 직접 접근해야 하는 특수한 환경이면 `0.0.0.0`으로 바꿀 수 있다.

```dotenv
API_BIND_ADDRESS=0.0.0.0
WEB_BIND_ADDRESS=0.0.0.0
```

일반 운영에서는 직접 공개보다 HTTPS reverse proxy를 권장한다.

### JWT secret

아래 명령을 두 번 실행해서 서로 다른 값을 만든다.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

생성한 값을 넣는다.

```dotenv
JWT_ACCESS_SECRET=<first-generated-secret>
JWT_REFRESH_SECRET=<second-generated-secret>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
EMAIL_VERIFICATION_TTL=30m
```

주의:

- 두 JWT secret은 서로 달라야 한다.
- `replace-with-...` placeholder를 그대로 두면 API env 검증에서 실패한다.

### 데모 계정, 관리자, 메일

포트폴리오용 데모 계정은 API 내부 스케줄러가 한국시간 매일 04:00에 초기화한다. 이 작업은 `DEMO_EMAIL` 계정과 그 계정만 단독 소유한 데모 워크스페이스만 지우고 다시 시드한다.

```dotenv
DEMO_EMAIL=demo@example.com
DEMO_RESET_SCHEDULE_ENABLED=true
```

첫 운영 관리자 계정이 필요하면 아래 값을 채운다.

```dotenv
INITIAL_ADMIN_EMAIL=owner@example.com
INITIAL_ADMIN_NAME=Initial Admin
INITIAL_ADMIN_PASSWORD=<strong-initial-password>
```

메일 연동 전에는 console provider로 시작할 수 있다.

```dotenv
MAIL_PROVIDER=console
MAIL_FROM_EMAIL=no-reply@example.com
MAIL_FROM_NAME=PERSONAL_ERP
```

Gmail API를 쓸 때는 `MAIL_PROVIDER=gmail-api`로 바꾸고 Gmail 관련 값을 채운다.

## 4. Compose 설정 검증

환경 파일을 채운 뒤 먼저 설정만 검증한다.

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml config
```

이 단계에서 실패하면 컨테이너를 올리지 말고 `.deploy\compose.env`의 누락값부터 고친다.

## 5. Docker 이미지 빌드

기본 빌드:

```powershell
.\build-docker-images.bat
```

태그를 지정한 빌드:

```powershell
.\build-docker-images.bat --tag 2026-05-01
```

base image를 새로 당기면서 빌드:

```powershell
.\build-docker-images.bat --pull
```

캐시 없이 빌드:

```powershell
.\build-docker-images.bat --no-cache
```

빌드되는 이미지는 세 개다.

- `personal-erp-migrate:<tag>`: Prisma migration one-shot
- `personal-erp-api:<tag>`: NestJS API
- `personal-erp-web:<tag>`: Next.js Web

배치 파일은 내부적으로 아래 명령을 실행한다.

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml build migrate api web
```

## 6. 이미지 파일로 저장해서 옮기기

배포 서버에서 직접 빌드하지 않고 이미지 파일을 옮기려면 `--save`를 붙인다.

```powershell
.\build-docker-images.bat --tag 2026-05-01 --pull --save
```

생성 위치:

```text
.deploy\images\personal-erp-migrate-2026-05-01.tar
.deploy\images\personal-erp-api-2026-05-01.tar
.deploy\images\personal-erp-web-2026-05-01.tar
```

대상 서버로 세 파일과 `docker-compose.prod.yml`, `.deploy\compose.env`를 옮긴다.

대상 서버에서 이미지를 불러온다.

```powershell
docker load -i .deploy\images\personal-erp-migrate-2026-05-01.tar
docker load -i .deploy\images\personal-erp-api-2026-05-01.tar
docker load -i .deploy\images\personal-erp-web-2026-05-01.tar
```

대상 서버의 `.deploy\compose.env`에는 같은 태그가 들어 있어야 한다.

```dotenv
IMAGE_TAG=2026-05-01
```

## 7. 컨테이너 기동

이미지를 이미 빌드했다면:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml up -d
```

빌드와 기동을 한 번에 하려면:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml up -d --build
```

기동 순서:

1. `mysql`이 먼저 올라간다.
2. `mysql` health check가 통과하면 `migrate`가 Prisma migration을 실행한다.
3. `migrate`가 성공하면 `api`가 올라간다.
4. `api` health check가 통과하면 `web`이 올라간다.

상태 확인:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml ps
```

로그 확인:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml logs -f mysql migrate api web
```

`migrate`는 정상이라면 실행 후 종료된다. `api`, `web`, `mysql`은 running 또는 healthy 상태여야 한다.

## 8. Health Check

reverse proxy 연결 전, 서버 내부에서 먼저 확인한다.

```powershell
Invoke-WebRequest http://127.0.0.1:4000/api/health
Invoke-WebRequest http://127.0.0.1:4000/api/health/ready
Invoke-WebRequest http://127.0.0.1:3000
```

기대값:

- `/api/health`: `status: ok`
- `/api/health/ready`: `status: ready`, `checks.database: ok`
- Web: 500 미만 응답

운영 도메인 연결 후 다시 확인한다.

```powershell
Invoke-WebRequest https://api.example.com/api/health
Invoke-WebRequest https://api.example.com/api/health/ready
Invoke-WebRequest https://app.example.com
```

## 9. HTTPS reverse proxy 연결

기본 compose는 포트를 로컬에만 연다.

- Web: `127.0.0.1:3000`
- API: `127.0.0.1:4000`

같은 서버의 Caddy, Nginx, IIS reverse proxy, Cloudflare Tunnel 같은 HTTPS endpoint에서 위 포트로 proxy한다.

분리 도메인 예:

- `https://app.example.com` -> `http://127.0.0.1:3000`
- `https://api.example.com` -> `http://127.0.0.1:4000`

단일 도메인 path 분리 예:

- `https://erp.example.com/api/*` -> `http://127.0.0.1:4000/api/*`
- `https://erp.example.com/*` -> `http://127.0.0.1:3000/*`

reverse proxy 적용 후에는 `Set-Cookie`에 `__Host-refreshToken`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`가 들어오는지 브라우저 개발자 도구에서 확인한다.

## 10. 첫 로그인과 스모크 체크

최소한 아래 흐름은 직접 확인한다.

1. Web 접속
2. 로그인
3. 새로고침 후 세션 유지
4. `/operations` 접속
5. `/api/health/ready`가 ready인지 확인
6. 로그아웃
7. 다시 로그인

운영 체크리스트의 상세 항목은 `docs/OPERATIONS_CHECKLIST.md`를 따른다.

## 11. 재배포 순서

코드가 바뀌었을 때:

```powershell
.\build-docker-images.bat --tag 2026-05-01 --pull
```

`.deploy\compose.env`의 태그를 같은 값으로 바꾼다.

```dotenv
IMAGE_TAG=2026-05-01
```

컨테이너를 재기동한다.

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml up -d
```

상태와 로그를 확인한다.

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml ps
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml logs -f migrate api web
```

## 12. 중지와 백업

중지:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml stop
```

다시 시작:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml up -d
```

삭제:

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml down
```

주의: MySQL 데이터는 Docker volume `personal_erp_mysql_data`에 남는다. volume 삭제 명령은 운영 데이터 삭제로 이어질 수 있으므로 사용 전 반드시 백업한다.

운영 전에는 MySQL volume 백업 정책을 별도로 정한다.

## 13. 자주 나는 문제

### `docker` 명령을 찾을 수 없음

Docker Desktop 또는 Docker Engine을 설치하고 터미널을 새로 연다.

### `NEXT_PUBLIC_API_BASE_URL`을 바꿨는데 Web이 예전 API를 호출함

Web 이미지 빌드 시점에 들어가는 값이다. `.deploy\compose.env`를 고친 뒤 Web 이미지를 다시 빌드한다.

```powershell
.\build-docker-images.bat --tag <new-tag>
```

### API가 env 검증에서 실패함

대부분 placeholder가 남아 있거나 JWT secret 조건을 만족하지 못한 경우다.

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`이 `replace-with...`인지 확인한다.
- 두 값이 서로 같은지 확인한다.
- `DATABASE_URL`이 `mysql://...@mysql:3306/personal_erp`처럼 compose 내부 host를 쓰는지 확인한다.

### `migrate`가 실패함

```powershell
docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml logs migrate
```

확인할 것:

- MySQL password와 `DATABASE_URL` password가 같은지
- `DATABASE_URL` password에 특수문자가 있으면 URL encoding했는지
- MySQL container가 healthy인지

### 로그인은 되지만 새로고침 후 세션이 풀림

HTTPS와 cookie 속성을 먼저 본다.

- 운영 접속 주소가 `https://`인지
- `APP_ORIGIN`이 실제 Web origin과 같은지
- reverse proxy가 `Set-Cookie`를 제거하지 않는지
- 브라우저에서 `__Host-refreshToken` cookie가 저장되는지

### 포트를 이미 사용 중임

`.deploy\compose.env`에서 published port를 바꾼다.

```dotenv
API_PUBLISHED_PORT=4100
WEB_PUBLISHED_PORT=3100
```
