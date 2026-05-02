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
- Docker 배포에서는 `docker-compose.prod.yml`과 비공개 `.deploy/compose.env`를 사용하고, 상세 절차는 [`DOCKER_DEPLOYMENT.md`](./DOCKER_DEPLOYMENT.md)를 우선합니다.
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
- `EMAIL_VERIFICATION_TTL`
- `PASSWORD_RESET_TTL`
- `DATABASE_URL`
- `DEMO_EMAIL`
- `DEMO_RESET_SCHEDULE_ENABLED`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_PASSWORD`
- `MAIL_PROVIDER` (console 또는 gmail-api)
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`

### Web

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK`

## 현재 저장소 기준 배포 순서

### 일반 프로세스 배포

1. SECRET 경로와 실제 `api.env`, `web.env` 값을 다시 확인합니다.
2. `npm install`로 의존성을 맞춥니다.
3. `npm run check:quick`를 실행합니다.
4. `npm run build`를 실행합니다.
5. DB 변경이 있으면 `npm run db:deploy`를 실행합니다.
6. API를 `npm run start --workspace @personal-erp/api`로 실행합니다.
7. Web을 `npm run start --workspace @personal-erp/web`로 실행합니다.
8. reverse proxy나 포트 포워딩을 실제 주소와 맞춥니다.
9. 아래 수동 스모크 체크를 완료합니다.

### Docker Compose 배포

1. `env-examples/deploy.compose.env.example`를 `.deploy/compose.env`로 복사하고 실제 secret으로 교체합니다.
2. `docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml config`로 구성을 확인합니다.
3. `build-docker-images.bat`로 `migrate`, `api`, `web` 이미지를 빌드합니다. tar 파일이 필요하면 `build-docker-images.bat --tag <tag> --save`를 사용합니다.
4. `docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml up -d`로 MySQL, migration, API, Web을 기동합니다.
5. `docker compose --env-file .deploy\compose.env -f docker-compose.prod.yml ps`에서 `api`, `web`, `mysql` health 상태와 `migrate` 완료 상태를 확인합니다.
6. HTTPS reverse proxy 연결 후 아래 수동 스모크 체크를 완료합니다.

## 수동 스모크 체크

### API

- `GET /api/health`가 `status: ok`를 반환하는지 확인합니다.
- `GET /api/health/ready`가 `status: ready`와 `checks.database: ok`를 반환하는지 확인합니다.
- `SWAGGER_ENABLED=true`인 환경이라면 `GET /api/docs`가 열리는지 확인합니다.
- `POST /auth/login`이 정상 응답하는지 확인합니다.
- 주요 API 응답 헤더에 `x-request-id`가 포함되는지 확인합니다.
- 브라우저 네트워크 탭에서 오류 응답의 `x-request-id`를 읽을 수 있는지 확인합니다. CORS 노출 헤더가 빠지면 Web 오류 알림의 요청번호가 비어 보입니다.
- `POST /auth/login` 응답에 `Cache-Control: no-store`가 포함되는지 확인합니다.
- 허용되지 않은 origin으로 cookie-auth 요청을 보냈을 때 `403 Origin not allowed`가 나는지 확인합니다.
- 보호 엔드포인트 호출 시 Bearer 토큰 없이 `401`이 오는지 확인합니다.
- 차단된 인증/권한 시나리오를 한 번 실행해 `auth.*`, `authorization.scope_denied`, `system.readiness_failed` 로그가 남는지 확인합니다.
- 로그인 후 `GET /api/operations/summary`, `GET /api/operations/system-status`, `GET /api/operations/alerts`가 현재 workspace 기준으로 응답하는지 확인합니다.
- 로그인 후 `GET /api/funding-account-status/summary`가 현재 workspace 기준 자금수단별 수입/지출/잔액 현황을 반환하는지 확인합니다.
- 운영 반출을 허용한 계정으로 `POST /api/operations/exports`를 실행했을 때 UTF-8 CSV payload가 내려오고 `operations_export.run` 감사 이벤트가 남는지 확인합니다.
- 운영 메모를 허용한 계정으로 `POST /api/operations/notes`를 실행했을 때 메모가 저장되고 `operations_note.create` 감사 이벤트가 남는지 확인합니다.
- 업로드 배치 API를 확인할 때는 `POST /api/import-batches`의 UTF-8 텍스트 배치와 `POST /api/import-batches/files`의 IM뱅크 PDF multipart 배치가 모두 현재 workspace 기준으로 생성되는지 확인합니다.
- 배치 상세에서 `POST /api/import-batches/:id/rows/collect`를 실행하면 `202 Accepted` 성격의 일괄 등록 Job이 반환되고, `GET /api/import-batches/:id/collection-jobs/:jobId`로 처리 건수/성공/실패/행별 결과가 갱신되는지 확인합니다.
- 전체 관리자 계정으로 로그인했을 때 `GET /api/admin/users`, `GET /api/admin/tenants`, `GET /api/admin/operations/status`, `GET /api/admin/security-threats`가 응답하는지 확인합니다.
- 전체 관리자 계정으로 `POST /api/admin/support-context` 실행 후 `GET /api/auth/me`의 `currentWorkspace`가 선택한 사업장/장부로 바뀌는지, `DELETE /api/admin/support-context` 후 해제되는지 확인합니다.

### Web

- 루트 `/`에서 비로그인 공개 메인과 회원가입/로그인 CTA가 열리는지 확인합니다.
- `/login` 화면이 열리는지 확인합니다.
- `/register`에서 표시 이름, 이메일, 비밀번호, 필수 이용약관/개인정보 처리 동의 입력 흐름이 정상인지 확인합니다.
- 로그인 후 대시보드로 이동하는지 확인합니다.
- 좌측 내비게이션 트리가 현재 로그인한 멤버의 역할(OWNER, MANAGER, VIEWER)에 따라 다르게 필터링되어 렌더링되는지 확인합니다.
- `/settings/workspace`에서 사업장/기본 장부 설정이 열리고, Owner/Manager 수정 권한 제어가 동작하는지 확인합니다.
- `/settings/account/profile`, `/settings/account/password`, `/settings/account/sessions`, `/settings/account/events`에서 계정 보안 하위 화면이 정상적으로 열리는지 확인합니다.
- 전체 관리자 계정이라면 `/admin`, `/admin/users`, `/admin/tenants`, `/admin/support-context`, `/admin/security-threats`, `/admin/operations`가 정상적으로 열리는지 확인합니다.
- `/admin/support-context`에서 특정 사업장/장부를 선택했을 때 상단바에 `지원 모드` 배지가 보이고, 지원 문맥 해제 시 배지가 사라지는지 확인합니다.
- `/admin/members`에서 현재 멤버 목록, 새 멤버 이메일 초대, 역할 수정, 상태(ACTIVE/SUSPENDED) 변경 및 워크스페이스 제거 기능이 동작하는지 확인합니다.
- `/admin/logs`에서 워크스페이스 단위 주요 권한/보안 감사 이벤트 조회가 되는지 확인합니다.
- `/admin/policy`에서 권한 정책 요약이 표시되는지 확인합니다.
- `/operations`, `/operations/checklist`, `/operations/exceptions`, `/operations/month-end`, `/operations/imports`에서 운영 지원 read model이 정상 표시되는지 확인합니다.
- `/operations/status`, `/operations/alerts`에서 시스템 상태와 파생 알림이 정상 표시되는지 확인합니다.
- `/operations/exports`에서 수동 CSV 반출 CTA가 동작하고, `/operations/notes`에서 운영 메모 저장 흐름이 동작하는지 확인합니다.
- `/reference-data`, `/reference-data/funding-accounts`, `/reference-data/categories`, `/reference-data/lookups`에서 기준 데이터 하위 화면이 정상적으로 열리는지 확인합니다.
- `/periods`에서 최신 진행월을 열거나 열린 기간을 확인할 수 있고, 최근 월 마감 전 다음 월 오픈이 차단되는지 확인합니다.
- `/insurances`, `/liabilities`, `/vehicles`, `/recurring`에서 보험 계약, 부채 관리, 차량 운영, 반복 규칙 화면이 데이터를 불러오는지 확인합니다.
- `/vehicles/fuel` 또는 `/vehicles/maintenance`에서 회계 연동을 켠 연료/정비 기록을 저장하면 연결 수집거래 상태가 표시되고, `/transactions`에서 해당 거래를 조회할 수 있는지 확인합니다.
- 차량 연료/정비에서 생성된 연결 수집거래는 `/transactions`에서 직접 수정/삭제가 막히고, 미확정 상태에서는 차량 화면에서만 동기화/연결 해제가 되는지 확인합니다.
- 연결 수집거래를 전표 확정한 뒤에는 차량 연료/정비 기록 수정이 차단되고, 조정은 `/journal-entries`의 반전/정정 흐름으로 이어지는지 확인합니다.
- `/plan-items/generate`에서 현재 월 계획 항목을 생성하고, `/plan-items`에서 연결된 수집 거래 상태를 추적할 수 있는지 확인합니다.
- `/imports`에서 UTF-8 텍스트 업로드와 IM뱅크 PDF 파일첨부 업로드가 열리고, `/imports/[batchId]` 작업대에서 최신 진행월 기준 collect preview, 단건 등록, 일괄 등록 진행률이 표시되는지 확인합니다.
- `/transactions`에서 거래 Quick Add 저장 후 목록이 갱신되고, 전표 준비 거래를 확정할 수 있는지 확인합니다.
- `/journal-entries`에서 확정 전표를 조회하고 반전/정정 전표 CTA가 유지되는지 확인합니다.
- `/financial-statements`, `/funding-account-status`, `/carry-forwards`, `/forecast`에서 재무제표 생성, 자금수단별 현황, 차기 이월 생성, 현재 월/다음 달 전망 확인 흐름이 깨지지 않았는지 확인합니다.
- 브라우저 새로고침 후 `POST /auth/refresh` 기반 세션 복원이 되는지 확인합니다.
- 실패 경고가 내부 함수명이나 영어 정책명만 노출하지 않고, 사용자가 취할 수 있는 안내를 먼저 보여주는지 확인합니다.
- 실패 경고의 `개발자 진단 정보`를 펼쳤을 때 오류 코드, HTTP 상태, 요청 경로, 요청번호, validator 원본 항목 또는 원본 응답 본문을 확인할 수 있는지 확인합니다.
- 모바일 폭에서 `DataTableCard` 기반 목록이 카드형으로 전환되고, 5개 초과 목록에서 5/10/20개 단위 페이지네이션과 이전/다음 이동이 동작하는지 확인합니다.
- `dashboard`, `reference-data`, `periods`, `plan-items`, `transactions`, `journal-entries`, `financial-statements`, `funding-account-status`, `carry-forwards`, `forecast`의 운영 안내 empty state와 CTA가 깨지지 않았는지 확인합니다.

## DB와 시드 데이터 경계

- `npm run db:deploy`는 운영 반영용 migration 명령으로 사용합니다.
- `npm run db:migrate`는 개발 환경 기준 명령으로 사용합니다.
- `npm run db:deploy:latest-baseline`은 새 빈 DB 전용 최신 스키마 1회 적용 명령입니다. 기존 DB나 운영 DB에는 사용하지 않습니다.
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
- 인증 rate limit은 애플리케이션 내부에서 우선 차단하지만 저장소는 프로세스 메모리입니다. 다중 API 인스턴스나 공개 운영에서는 reverse proxy, WAF, API gateway의 IP 기반 rate limit을 함께 적용합니다.
- 현재 refresh token 쿠키는 `__Host-refreshToken`과 `Secure`로 고정되므로, 운영 환경에서는 반드시 HTTPS origin과 함께 점검해야 합니다.
- 운영 환경에서는 `CORS_ALLOWED_ORIGINS`를 필요한 origin만 포함하도록 최소화하고, `SWAGGER_ENABLED=false` 여부를 같이 결정합니다.
- 현재 보안 이벤트는 애플리케이션 로그에 남기며, 외부 감사 저장소나 중앙 로그 수집기는 아직 연결하지 않았습니다.
- 업로드 배치 일괄 등록은 Job/행별 결과와 workspace 잠금을 DB에 남기고, 만료된 잠금의 `PENDING/RUNNING` Job은 스케줄러와 조회/명령 진입점에서 자동 종료합니다. 다만 실행 루프 자체는 API 프로세스 안에서 동작하므로, 장기적으로는 외부 worker/outbox 도입 여부를 별도 결정해야 합니다.

## 함께 보면 좋은 문서

- [README.md](../README.md)
- [ENVIRONMENT_SETUP.md](../ENVIRONMENT_SETUP.md)
- [docs/API.md](./API.md)
- [docs/ERROR_HANDLING_AND_LOGGING.md](./ERROR_HANDLING_AND_LOGGING.md)
- [docs/VALIDATION_NOTES.md](./VALIDATION_NOTES.md)
