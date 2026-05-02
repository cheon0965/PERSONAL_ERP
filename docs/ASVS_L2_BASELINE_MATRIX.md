# ASVS L2 Baseline Matrix

## 목적

이 문서는 현재 `PERSONAL_ERP` 프로젝트를 `OWASP ASVS Level 2` 관점에서 빠르게 점검하기 위한 기준표입니다.

역할은 세 가지입니다.

- 현재 프로젝트가 어디까지 준비되었는지 한눈에 본다.
- 어떤 파일과 테스트를 근거로 그렇게 판단했는지 남긴다.
- 아직 남은 운영 과제와 후속 보강 포인트를 정리한다.

이 문서는 ASVS 전체 조항의 완전한 대체물이 아니라, 현재 프로젝트 범위에 맞춘 실용적인 상태표입니다.

## 판정 규칙

- `적용`: 현재 코드와 테스트 또는 문서 근거가 분명하다.
- `부분 적용`: 기반은 있지만 L2 수준으로 보기엔 운영 하드닝이나 추가 증적이 더 필요하다.
- `보류`: 기능 또는 운영 방식이 아직 없어 지금은 하지 않는다.
- `N/A`: 현재 제품 범위에 없는 요구사항이다.

## 현재 기준표

### 인증

- 현재 상태: 비밀번호 기반 로그인, common/context-derived password 차단, Bearer 보호 엔드포인트, generic login failure, login/refresh rate limit
- 근거 파일:
  `apps/api/src/modules/auth/password-policy.service.ts`
  `apps/api/src/modules/auth/application/use-cases/register.use-case.ts`
  `apps/api/src/modules/auth/application/use-cases/change-password.use-case.ts`
  `apps/api/src/modules/auth/application/use-cases/reset-password.use-case.ts`
  `apps/api/src/common/auth/jwt-auth.guard.ts`
  `apps/api/test/*.request-api.test.ts`
- 판정: `부분 적용`
- 다음 단계: breached password check와 MFA 기능이 생기면 재판정

### 세션 관리

- 현재 상태: 서버측 refresh 세션, `__Host-refreshToken` secure cookie 발급, legacy refresh cookie 전환 읽기/삭제, rotation/revoke/reuse detection, Web 세션 복원
- 근거 파일:
  `apps/api/src/modules/auth/auth.controller.ts`
  `apps/web/src/shared/auth/auth-session-store.ts`
  `apps/web/src/shared/auth/auth-provider.tsx`
  `apps/api/test/auth.request-api.test.ts`
- 판정: `부분 적용`
- 다음 단계: 운영 HTTPS 배포에서 cookie 속성과 session revoke/reuse event 증적 재확인

### 접근통제

- 현재 상태: 전역 guard, workspace 기반 tenant/ledger/membership role 검증, 목록/집계 응답의 current workspace 범위 분리
- 근거 파일:
  `apps/api/src/common/auth/jwt-auth.guard.ts`
  `apps/api/src/modules/collected-transactions/application/use-cases/create-collected-transaction.use-case.ts`
  `apps/api/src/modules/recurring-rules/application/use-cases/create-recurring-rule.use-case.ts`
  `apps/api/test/*.request-api.test.ts`
- 판정: `적용`
- 다음 단계: 관리자/다중권한 기능 추가 시 재판정

### 입력 검증

- 현재 상태: DTO validation, whitelist, forbidNonWhitelisted, 계약 테스트
- 근거 파일:
  `apps/api/src/main.ts`
  `apps/api/test/*.request-api.test.ts`
- 판정: `적용`
- 다음 단계: 에러 표준화와 증적 유지

### 데이터 보호

- 현재 상태: env validation, secret-dir, contracts 중심 shape 관리, `no-store`, 최소 응답 shape, 집계 전용 read 응답
- 근거 파일:
  `apps/api/src/config/api-env.ts`
  `env-examples/secret-dir.local.example`
  `env-examples/api.env.example`
  `env-examples/web.env.example`
  `ENVIRONMENT_SETUP.md`
  `apps/web/src/shared/auth/auth-session-store.ts`
  `docs/API.md`
  `apps/api/test/*.request-api.test.ts`
- 판정: `부분 적용`
- 다음 단계: 운영 데이터 분류와 장기 보관 정책 보강

### 브라우저/API 경계

- 현재 상태: CORS allowlist, API/Web security headers, CSP, HSTS, `no-store`, browser origin allowlist 적용
- 근거 파일:
  `apps/api/src/bootstrap/configure-api-app.ts`
  `apps/api/src/common/infrastructure/security/browser-boundary.ts`
  `apps/api/test/*.request-api.test.ts`
  `apps/web/next.config.mjs`
  `apps/web/test/security-headers.test.ts`
  `apps/web/src/shared/api/fetch-json.ts`
- 판정: `적용`
- 다음 단계: 운영 HTTPS/HSTS와 Swagger 토글 리허설

### 에러 처리

- 현재 상태: 공통 문서, API 에러 흐름, 민감정보 금지 목록, 보안 이벤트 로그 기준 존재
- 근거 파일:
  `docs/ERROR_HANDLING_AND_LOGGING.md`
  `apps/web/src/shared/api/fetch-json.ts`
  `apps/api/src/common/infrastructure/operational/security-event.logger.ts`
- 판정: `부분 적용`
- 다음 단계: 외부 감사 저장소/장기 보관 정책 검토

### 로깅/운영 신호

- 현재 상태: `x-request-id`, request log, readiness, auth/security event 로그
- 근거 파일:
  `apps/api/src/common/infrastructure/operational/request-context.interceptor.ts`
  `apps/api/src/common/infrastructure/operational/security-event.logger.ts`
  `apps/api/src/modules/health/health.controller.ts`
  `apps/api/test/*.request-api.test.ts`
- 판정: `부분 적용`
- 다음 단계: 외부 sink 없이 앱 로그 중심 운영

### 설정/비밀관리

- 현재 상태: env parse/validate, JWT secret 32 bytes 이상 base64/base64url random 검증, access/refresh secret 분리 검증, placeholder 차단, example 파일, secret-dir 문서화
- 근거 파일:
  `apps/api/src/config/api-env.ts`
  `apps/api/test/api-env.test.ts`
  `env-examples/secret-dir.local.example`
  `env-examples/api.env.example`
  `env-examples/web.env.example`
  `README.md`
  `ENVIRONMENT_SETUP.md`
- 판정: `적용`
- 다음 단계: 회전 정책, 운영 점검표 보강

### 보안 검증/CI

- 현재 상태: `CI` 워크플로에 validate, e2e-smoke, security-regression, prisma-integration, audit-runtime, Semgrep CE, Gitleaks가 존재하고, GitHub CI 첫 통과 증적과 required check 연결, Docker 환경 `npm run test:prisma`, GitHub `prisma-integration` 통과 확인까지 완료됨. `audit-runtime`은 현재 `high` 게이트와 만료형 allowlist 검증을 함께 사용함
- 근거 파일:
  `.github/workflows/ci.yml`
  `package.json`
  `docs/VALIDATION_NOTES.md`
  `pull_request_template.md`
- 판정: `적용`
- 다음 단계: CI 구성 변경 시 required check와 `prisma-integration` 통과 증적 재확인

### 회원가입/비밀번호 재설정

- 현재 상태: 회원가입, 이메일 인증, 비밀번호 재설정이 구현됨. 주요 비밀번호 설정 경로에 common/context-derived password 차단 정책이 적용됨
- 근거 파일: `apps/api/src/modules/auth/*`, `apps/web/src/features/auth/*`, `docs/API.md`
- 판정: `부분 적용`
- 다음 단계: breached password check, 메일 발송 실패 복구, 재설정 abuse 관측 증적 보강

### MFA/2FA

- 현재 상태: 현재 제품 범위에 없음
- 근거 파일: 현재 코드베이스
- 판정: `N/A`
- 다음 단계: 기능/위험도 증가 시 검토

### 파일 업로드 보안

- 현재 상태: `ImportBatch` 생성 시 UTF-8 텍스트 본문 업로드 API와 활성 계좌/카드 연결이 필요한 IM뱅크 PDF·우리은행/우리카드 HTML `multipart/form-data` 파일첨부 업로드 API가 존재함. PDF magic bytes, 확장자, content-type, 10MB 제한을 확인하고 원본 PDF 파일 storage는 아직 없음. 우리은행/우리카드 HTML은 저장 HTML과 암호화 VestMail 원본을 파싱하되 업로드된 dynamic JavaScript는 실행하지 않고 서버 내 SEED/CBC 구현으로만 복호화함
- 근거 파일: `apps/api/src/modules/import-batches/*`, `apps/web/src/features/imports/*`
- 판정: `부분 적용`
- 다음 단계: 파일 storage 도입 시 백신/콘텐츠 검증, 보존 기간, 다운로드 권한, 개인정보 마스킹 정책 추가

### 외부 결제/메일/SMS 보안

- 현재 상태: 회원가입 이메일 인증용 Gmail API mail sender adapter와 로컬 console sender 경계가 존재함. 외부 결제/SMS는 없음
- 근거 파일: `apps/api/src/common/application/ports/email-sender.port.ts`, `apps/api/src/common/infrastructure/email/*`, `ENVIRONMENT_SETUP.md`
- 판정: `부분 적용`
- 다음 단계: 운영 Gmail API secret 등록, 발송 실패 모니터링, 대량 발송/재시도 outbox가 필요해지는 시점의 별도 ADR 검토

## 현재 단계에서 가장 큰 갭

1. 운영 HTTPS/HSTS와 Swagger 토글을 실제 배포 값으로 다시 확인해야 한다.
2. 보안 이벤트는 남기기 시작했지만 외부 감사 저장소나 장기 보관 정책은 아직 없다.
3. 운영 데이터 분류와 장기 보관 정책은 실제 배포 환경 기준으로 더 구체화해야 한다.

## 최근 해소된 갭

1. runtime dependency audit의 2026-04-05 tracked exception은 2026-04-22 패치 업데이트로 해소되었고, 같은 날 `high` gate와 만료형 allowlist 구조로 상향되었다.
2. CI job의 required check 연결과 `prisma-integration` 통과는 확인 완료되었으므로, 이후에는 CI 구성 변경 시 재확인 대상으로 관리한다.

## 현재 단계에서 이미 강한 부분

1. DTO validation과 요청 단위 API 테스트가 비교적 잘 갖춰져 있다.
2. workspace 접근통제가 핵심 쓰기 흐름과 읽기 응답 분리에 모두 반영되어 있다.
3. 환경변수 검증과 example 문서가 있다.
4. request-id와 readiness 같은 운영 신호가 있다.
5. 브라우저 E2E, API 테스트, Prisma 대표 통합 테스트 경로가 역할별로 분리되어 있다.

## P5 완료 반영

- 접근통제는 현재 범위에서 `부분 적용`이 아니라 `적용`으로 본다.
- 근거는 `GET /collected-transactions`, `GET /recurring-rules`, `GET /dashboard/summary`, `GET /forecast/monthly`에 대한 요청 단위 API 테스트에서 current workspace 범위만 반환하고 내부 접근 제어 필드를 노출하지 않음을 검증한 점이다.
- 신규 자금수단별 현황 read model인 `GET /funding-account-status/summary`도 같은 projection 원칙으로 동작하며, 전용 요청 단위 회귀 테스트에서 기간/자금수단 필터, current workspace 범위, 합계, 거래 목록, 경고 메시지를 검증한다.
- 데이터 보호는 여전히 `부분 적용`으로 두되, 현재 범위에서는 브라우저 저장소 토큰 제거, `no-store`, 최소 응답 shape, 집계 전용 read 응답까지는 반영된 상태로 본다.

## 관련 문서

- [ASVS L2 실행계획](./ASVS_L2_EXECUTION_PLAN.md)
- [ADR 0004. ASVS Level 2 Baseline and Evidence Policy](./adr/0004-asvs-level-2-baseline-and-evidence-policy.md)

이 기준표는 `현재 상태`를 설명하고, 실행계획 문서는 `왜 이런 순서로 진행했고 무엇이 아직 남았는지`를 설명합니다.
