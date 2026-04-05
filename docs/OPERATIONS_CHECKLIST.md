# 배포/운영 체크리스트

## 목적

이 문서는 현재 저장소 기준으로 바로 실행 가능한 배포 전 확인, 배포 순서, 수동 스모크 체크, 운영 주의사항을 한 곳에 모읍니다.
환경 값 자체의 예시는 `ENVIRONMENT_SETUP.md`, 저장소 진입 설명은 `README.md`를 기준으로 보고, 실제 배포 순서와 운영 점검은 이 문서를 기준으로 봅니다.

## 적용 범위

- 현재 저장소가 제공하는 명령 기준
- API와 Web을 별도 프로세스로 실행하는 운영 방식 기준
- 외부 SECRET 폴더(`PERSONAL_ERP_SECRET_DIR`)를 사용하는 현재 구조 기준

## 배포 전에 먼저 확인할 것

- 대상 브랜치가 기준 커밋과 일치하는지 확인합니다.
- `npm run check:quick`가 통과하는지 확인합니다.
- 배포 직전 기준으로 `npm run build`가 통과하는지 확인합니다.
- Web 라우트, 인증 복원, Next.js build 경로를 건드렸다면 `npm run test:e2e:smoke:build`도 통과하는지 확인합니다.
- DB 스키마 변경이 포함되면 migration 파일이 함께 있는지 확인합니다.
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=false`인지 확인합니다.
- `APP_ORIGIN`과 `NEXT_PUBLIC_API_BASE_URL` 조합이 실제 도메인과 맞는지 확인합니다.
- API와 Web이 사용할 포트, 방화벽, reverse proxy 경로를 미리 정합니다.

## 필수 env / secret 점검

### API

- `PORT`
- `APP_ORIGIN`
- `CORS_ALLOWED_ORIGINS`
- `SWAGGER_ENABLED`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `DATABASE_URL`
- `DEMO_EMAIL`

### Web

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`

## 현재 저장소 기준 배포 순서

1. SECRET 경로와 실제 `api.env`, `web.env` 값을 다시 확인합니다.
2. `npm install`로 의존성을 맞춥니다.
3. `npm run check:quick`를 실행합니다.
4. `npm run build`를 실행합니다.
5. DB 변경이 있으면 `npm run db:deploy`를 실행합니다.
6. API를 `npm run start --workspace @personal-erp/api`로 실행합니다.
7. Web을 `npm run start --workspace @personal-erp/web`로 실행합니다.
8. reverse proxy나 포트 포워딩을 실제 주소와 맞춥니다.
9. 아래 수동 스모크 체크를 완료합니다.

## 수동 스모크 체크

### API

- `GET /api/health`가 `status: ok`를 반환하는지 확인합니다.
- `GET /api/health/ready`가 `status: ready`와 `checks.database: ok`를 반환하는지 확인합니다.
- `SWAGGER_ENABLED=true`인 환경이라면 `GET /api/docs`가 열리는지 확인합니다.
- `POST /auth/login`이 정상 응답하는지 확인합니다.
- 주요 API 응답 헤더에 `x-request-id`가 포함되는지 확인합니다.
- `POST /auth/login` 응답에 `Cache-Control: no-store`가 포함되는지 확인합니다.
- 허용되지 않은 origin으로 cookie-auth 요청을 보냈을 때 `403 Origin not allowed`가 나는지 확인합니다.
- 보호 엔드포인트 호출 시 Bearer 토큰 없이 `401`이 오는지 확인합니다.
- 차단된 인증/권한 시나리오를 한 번 실행해 `auth.*`, `authorization.scope_denied`, `system.readiness_failed` 로그가 남는지 확인합니다.

### Web

- `/login` 화면이 열리는지 확인합니다.
- 로그인 후 대시보드로 이동하는지 확인합니다.
- `/reference-data`에서 readiness 요약과 자금수단/카테고리 관리 화면이 정상적으로 열리는지 확인합니다.
- 대시보드, 거래, 반복규칙 화면이 모두 데이터를 불러오는지 확인합니다.
- 거래 Quick Add 저장 후 목록이 갱신되는지 확인합니다.
- 반복규칙 Quick Add 저장 후 목록이 갱신되는지 확인합니다.
- 브라우저 새로고침 후 `POST /auth/refresh` 기반 세션 복원이 되는지 확인합니다.
- `dashboard`, `transactions`, `financial-statements`, `carry-forwards`의 운영 안내 empty state와 CTA가 깨지지 않았는지 확인합니다.

## DB와 시드 데이터 경계

- `npm run db:deploy`는 운영 반영용 migration 명령으로 사용합니다.
- `npm run db:migrate`는 개발 환경 기준 명령으로 사용합니다.
- `npm run db:seed`는 현재 구현상 기존 데이터를 지우고 데모 데이터를 다시 넣습니다.
- 따라서 `npm run db:seed`는 운영 DB에 절대 실행하지 않습니다.
- 운영 반영 전에는 대상 DB가 진짜 운영 DB인지, 로컬/스테이징 DB인지 다시 확인합니다.

## 장애 대응 시 우선 확인 순서

### API가 뜨지 않을 때

- `PORT`, `DATABASE_URL`, JWT 관련 env 값이 유효한지 확인합니다.
- `npm run db:deploy` 실패 로그가 있는지 확인합니다.
- 프로세스 로그에 env validation 오류가 있는지 확인합니다.
- readiness 실패가 반복되면 `system.readiness_failed`와 같은 `requestId`의 접근 로그를 같이 확인합니다.

### Web은 뜨지만 로그인이 안 될 때

- `APP_ORIGIN`과 `NEXT_PUBLIC_API_BASE_URL` 조합이 맞는지 확인합니다.
- `CORS_ALLOWED_ORIGINS`에 실제 Web origin이 빠지지 않았는지 확인합니다.
- 브라우저 네트워크 탭에서 `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` 응답 코드를 확인합니다.
- API 쪽 `401`, CORS, URL mismatch가 있는지 확인합니다.
- API 로그에서 `auth.login_failed`, `auth.login_rate_limited`, `auth.browser_origin_blocked`, `auth.refresh_failed`, `auth.access_denied`를 먼저 확인합니다.

### 배포 후 데이터가 이상할 때

- 운영 DB에 `npm run db:seed`를 잘못 실행하지 않았는지 가장 먼저 확인합니다.
- migration 적용 순서와 대상 DB 연결 문자열을 다시 확인합니다.

## 현재 구현 기준 운영 리스크 메모

- 이 저장소는 PM2, NSSM, IIS, systemd 같은 프로세스 관리자 설정을 포함하지 않습니다.
- reverse proxy, TLS 종료, 서비스 재시작 정책은 운영 환경에서 별도로 정해야 합니다.
- 현재 refresh token 쿠키는 `APP_ORIGIN`이 HTTPS일 때만 `secure: true`가 되므로, 운영 환경에서는 반드시 HTTPS origin과 함께 점검해야 합니다.
- 운영 환경에서는 `CORS_ALLOWED_ORIGINS`를 필요한 origin만 포함하도록 최소화하고, `SWAGGER_ENABLED=false` 여부를 같이 결정합니다.
- 현재 보안 이벤트는 애플리케이션 로그에 남기며, 외부 감사 저장소나 중앙 로그 수집기는 아직 연결하지 않았습니다.

## 함께 보면 좋은 문서

- [README.md](../README.md)
- [ENVIRONMENT_SETUP.md](../ENVIRONMENT_SETUP.md)
- [docs/API.md](./API.md)
- [docs/ERROR_HANDLING_AND_LOGGING.md](./ERROR_HANDLING_AND_LOGGING.md)
- [docs/VALIDATION_NOTES.md](./VALIDATION_NOTES.md)
