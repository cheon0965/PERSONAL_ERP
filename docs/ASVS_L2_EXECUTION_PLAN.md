# ASVS L2 Execution Plan

## 목적

이 문서는 현재 `personal-erp-starter` 프로젝트를 최종적으로 `OWASP ASVS Level 2`에 가깝게 끌어올리기 위한 실행계획입니다.

이 계획의 목표는 세 가지입니다.

- 현재 코드 기준으로 이미 갖춘 보안 기반과 실제 갭을 분리해서 본다.
- `지금 바로 할 일`, `조금 뒤에 할 일`, `기능이 생길 때만 할 일`을 구분한다.
- 포트폴리오 설명력과 실제 보안 개선 효과가 모두 있는 순서로 진행한다.

## 기준선

- 이 계획은 `2026-03-27` 기준 OWASP ASVS 프로젝트 페이지에서 안내하는 최신 안정판 `ASVS 5.0.0`을 기준으로 잡습니다.
- ASVS Developer Guide는 `Level 2`를 `민감한 데이터를 다루며 보호가 필요한 대부분의 애플리케이션에 권장되는 수준`으로 설명합니다.
- 이 프로젝트는 1인 사업자와 소상공인의 사업 운영 재무/현금흐름 데이터를 다루므로 `Level 2` 목표가 과하지 않습니다.

## 이 프로젝트에서의 적용 원칙

- ASVS를 `체크리스트 전체 암기`가 아니라 `보안 설계와 검증의 기준선`으로 사용합니다.
- 모든 요구사항을 한 번에 구현하지 않습니다.
- 실제 기능이 아직 없는 영역은 `N/A` 또는 `deferred`로 명확히 남깁니다.
- 구조 과시용 보안 기능은 넣지 않습니다.
- 각 단계는 반드시 `코드 + 테스트 + 문서 + 운영 증거` 중 둘 이상을 남깁니다.

## 현재 상태 요약

### 이미 갖춘 기반

- API 진입점에 `ValidationPipe(transform, whitelist, forbidNonWhitelisted)`가 적용되어 있습니다.
- 인증은 전역 guard 기반이며 보호 엔드포인트는 Bearer 토큰이 필요합니다.
- 핵심 쓰기 흐름에는 workspace 기준 접근통제가 들어가 있습니다.
- 비밀번호 검증은 `argon2`를 사용합니다.
- 환경변수는 런타임에서 검증되고 `.env.example` 계열 문서가 있습니다.
- 모든 API 응답에 `x-request-id`가 붙고 `GET /api/health/ready`가 있습니다.
- 테스트는 use-case, 요청 단위 API, 브라우저 E2E, Prisma 대표 통합 테스트 경로까지 분리되어 있습니다.

### 현재 보안 기반과 남은 갭

- Web은 이제 access token을 메모리 런타임 상태에만 유지합니다.
- refresh token 쿠키는 `APP_ORIGIN`이 HTTPS일 때 `secure: true`로 설정됩니다.
- refresh token 회전, 서버측 폐기, 재사용 감지, 로그아웃 엔드포인트가 도입되었습니다.
- 로그인/refresh 엔드포인트에 rate limiting 기반 anti-automation 방어가 들어갔습니다.
- 브라우저/API 경계에는 CORS allowlist, 보안 헤더, `Cache-Control: no-store`, browser origin allowlist 방어가 들어갔지만 운영 HTTPS/HSTS와 Swagger 노출 토글은 실제 배포 기준으로 다시 점검해야 합니다.
- cookie 기반 인증 흐름은 allowlist 기반 origin 검증으로 1차 보호되지만, 범용 state-changing 폼이 늘어나면 별도 CSRF 전략을 다시 평가해야 합니다.
- 보안 이벤트 로깅은 request-id 기준으로 남기기 시작했지만, 외부 감사 저장소나 장기 보관 정책은 아직 없습니다.
- CI에는 `security-regression`, `audit-runtime`, `semgrep-ce`, `gitleaks`, PR 전용 `dependency-review`가 들어갔지만, GitHub 첫 통과 증적과 required check 연결은 운영 단계에서 다시 확인해야 합니다.

## 범위 구분

### 지금 범위에 포함

- Web
- API
- 인증/세션
- 브라우저/API 경계 보안
- 운영 로그/보안 이벤트
- CI 보안 검증
- 문서와 증적 정리

### 지금은 N/A 또는 보류

- 회원가입
- 비밀번호 재설정/이메일 인증
- MFA/2FA
- 관리자 전용 권한 체계
- binary multipart/file storage 보안
- 외부 결제/외부 메일/SMS 연동
- 모바일 앱 전용 토큰 저장소

위 항목들은 기능이 생기기 전까지 억지로 구현하지 않습니다.

## ASVS 관점 현재 판정

| 영역               | 현재 상태                                                                                                       | 판단          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | ------------- |
| 인증               | 비밀번호 검증, JWT 기반 인증 존재                                                                               | `부분 충족`   |
| 세션 관리          | 서버측 refresh 세션, rotation/revoke/reuse detection, Web 메모리 access token 복원                              | `부분 충족`   |
| 접근통제           | 전역 guard, workspace 접근통제 존재                                                                             | `부분 충족`   |
| 입력검증/API       | DTO validation과 요청 테스트 존재                                                                               | `상대적 강점` |
| 데이터 보호        | 민감데이터 분류/캐시/토큰 저장 정책 미흡                                                                        | `부분 충족`   |
| 통신/브라우저 보안 | CORS allowlist, security headers, no-store, browser origin allowlist 적용                                       | `부분 충족`   |
| 설정/비밀관리      | env 검증과 example 존재                                                                                         | `부분 충족`   |
| 에러/로깅          | request-id, 보안 이벤트 로그, 민감정보 금지 원칙 존재                                                           | `부분 충족`   |
| 보안 검증/SDLC     | `CI` 워크플로에 validate + security-regression + audit-runtime + Semgrep CE + Gitleaks + dependency review 존재 | `부분 충족`   |

## 우선순위

1. 인증/세션 하드닝
2. 브라우저/API 경계 보안
3. CI 보안 게이트
4. 보안 이벤트 로깅과 운영 규칙
5. 접근통제/데이터 보호 증적 보강

이 순서는 `실제 위험 감소 효과`, `현재 코드와의 연결성`, `포트폴리오 설명력`을 같이 고려한 결과입니다.

## 단계별 실행계획

### P0. ASVS 기준선과 증적 구조 고정

목적:
현재 프로젝트가 ASVS L2를 어떻게 해석할지 먼저 고정합니다. 이후 단계가 흔들리지 않게 만드는 준비 작업입니다.

상태:
`완료`

해야 할 일:

- `ASVS chapter -> 현재 상태 -> 근거 파일 -> 후속 작업` 매핑표를 만든다.
- 현재 인증/세션 전략을 문서로 고정한다.
- `적용`, `부분 적용`, `N/A`, `보류` 판정 기준을 문서에 명시한다.
- 보안 변경 시 남겨야 할 증적 목록을 정의한다.

산출물:

- 이 문서 자체
- ASVS 매핑표 또는 부록 문서
- 보안 관련 ADR 1개 이상

현재 산출물:

- [ASVS L2 Baseline Matrix](./ASVS_L2_BASELINE_MATRIX.md)
- [ADR 0004. ASVS Level 2 Baseline and Evidence Policy](./adr/0004-asvs-level-2-baseline-and-evidence-policy.md)

완료 기준:

- 왜 Level 2를 목표로 하는지 한 문단으로 설명할 수 있다.
- 어떤 요구는 지금 안 하는지 설명할 수 있다.
- 이후 보안 작업이 문서 기준으로 추적 가능하다.

P0 결과 요약:

- 현재 프로젝트에 맞춘 `적용 / 부분 적용 / 보류 / N/A` 기준을 고정했다.
- 실용적인 ASVS 기준표를 별도 문서로 분리했다.
- 이후 보안 변경이 남겨야 할 증적 범주를 ADR로 고정했다.

### P1. 인증/세션 하드닝

목적:
현재 프로젝트에서 ASVS L2 관점 가장 큰 리스크는 인증정보와 세션 처리입니다. 이 단계를 최우선으로 둡니다.

상태:
`완료`

핵심 변경 방향:

- `sessionStorage` 기반 access token 저장을 제거한다.
- 브라우저에서 직접 읽을 수 없는 세션 전략으로 옮긴다.
- refresh token은 서버에서 추적 가능하고 폐기 가능한 형태로 바꾼다.

해야 할 일:

- access token / refresh token 정책을 재설계한다.
- 권장안:
  `HttpOnly + Secure + SameSite` 쿠키 기반 세션으로 정리하거나,
  최소한 access token은 메모리 기반으로 두고 refresh 흐름을 별도 엔드포인트로 분리한다.
- `/auth/refresh`, `/auth/logout`를 추가한다.
- refresh token 해시 저장, rotation, revoke, reuse 감지를 도입한다.
- 로그인 실패 메시지는 계속 generic하게 유지한다.
- 로그인과 refresh에 rate limiting을 붙인다.
- 운영 환경에서 refresh cookie `secure: true`를 강제하고, 개발 환경만 예외를 두는 식으로 env 정책을 분리한다.

주요 파일 후보:

- `apps/api/src/modules/auth/*`
- `apps/api/src/config/api-env.ts`
- `apps/web/src/shared/auth/*`
- `apps/web/src/features/auth/*`
- `apps/api/test/*.request-api.test.ts`
- `apps/web/e2e/*`

완료 기준:

- 브라우저 JS에서 토큰 원문을 직접 읽지 않는다.
- 로그아웃 시 세션이 확실히 종료된다.
- refresh token 재사용 또는 만료 시나리오가 테스트된다.
- login/refresh 엔드포인트에 anti-automation 방어가 있다.

P1 결과 요약:

- Web access token 저장소를 `sessionStorage`에서 메모리 런타임 상태로 바꿨습니다.
- `POST /auth/refresh`, `POST /auth/logout`를 추가하고 refresh cookie 기반 복원 흐름을 고정했습니다.
- refresh token 해시 저장, rotation, revoke, reuse detection을 서버측 세션으로 도입했습니다.
- 보호 API는 access token의 `sid`와 서버측 세션 상태를 함께 검증합니다.
- 요청 단위 API 테스트와 브라우저 E2E를 새 세션 흐름에 맞춰 보강했습니다.

### P2. 브라우저/API 경계 보안

목적:
세션이 정리되면 다음은 브라우저와 API 경계의 공격면을 줄여야 합니다.

상태:
`완료`

해야 할 일:

- `helmet` 또는 동등한 방식으로 기본 보안 헤더를 붙인다.
- 최소 정책:
  `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` 또는 `frame-ancestors`
- 인증/민감 응답에는 적절한 `Cache-Control: no-store` 정책을 적용한다.
- CORS allowlist를 운영/개발별로 다시 점검한다.
- cookie 기반 인증 흐름이 정착되면 state-changing 요청에 대한 CSRF 방어 전략을 추가한다.
- Swagger 노출 범위를 운영 환경에서 제어할지 결정한다.

주요 파일 후보:

- `apps/api/src/main.ts`
- `apps/api/src/config/api-env.ts`
- `apps/api/test/*.request-api.test.ts`
- `docs/API.md`
- `docs/OPERATIONS_CHECKLIST.md`

완료 기준:

- 주요 보안 헤더가 응답에 포함된다.
- 인증 관련 엔드포인트의 캐시 정책이 문서화된다.
- cookie 기반 요청 위조 방어 전략이 테스트와 함께 정리된다.

P2 결과 요약:

- `apps/api/src/bootstrap/configure-api-app.ts`로 런타임과 테스트가 같은 브라우저/API 경계 설정을 사용하도록 묶었습니다.
- API는 CORS allowlist, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`를 기본으로 보냅니다.
- `APP_ORIGIN`이 HTTPS일 때만 `Strict-Transport-Security`를 추가하고, `/api/docs` 노출은 `SWAGGER_ENABLED`로 제어합니다.
- 인증/세션 응답과 Bearer 인증이 포함된 응답에는 `Cache-Control: no-store`를 적용했습니다.
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`은 allowlist 밖 browser `Origin` 또는 `Referer`를 `403 Origin not allowed`로 차단합니다.
- 요청 단위 API 테스트와 브라우저 E2E를 다시 돌려 새 경계 정책이 실제 흐름을 깨지 않는지 확인했습니다.

### P3. CI 보안 게이트 추가

상태:
`완료`

목적:
ASVS L2는 코드만 안전하면 끝이 아니라, 변경이 들어와도 보안 회귀를 잡을 수 있어야 합니다.

이번 단계에서 한 일:

- `.github/workflows/ci.yml`에 `security-regression`, `audit-runtime`, `semgrep-ce`, `gitleaks`, PR 전용 `dependency-review` job을 추가했다.
- 보안 회귀 API 테스트는 `npm run test:security:api`로 별도 실행 지점을 만들었다.
- runtime dependency audit는 실제 배포 대상인 `api`, `web` workspace 기준의 `npm run audit:runtime`로 고정했다.
- private repo 플랜 제약으로 GitHub server-side 강제가 약할 수 있다는 점은 문서에 운영 기준으로 명시했다.

주요 파일:

- `.github/workflows/ci.yml`
- `package.json`
- `README.md`
- `CONTRIBUTING.md`
- `docs/VALIDATION_NOTES.md`
- `pull_request_template.md`

완료 기준:

- PR 단계에서 dependency/secret/code 보안 스캔이 자동으로 돈다.
- 보안 스캔 실패 시 merge 전에 확인할 수 있다.
- 최소 한 개 이상의 보안 회귀 테스트가 CI에서 분리되어 보인다.

P3 완료 반영:

- `CI` 워크플로 안에서 기본 검증과 보안 검증이 함께 돌아가도록 정리했다.
- 보안 회귀 테스트, runtime audit, SAST, secret scan, dependency review가 각각 분리된 증적으로 남는다.
- 로컬 검증 기준과 CI 보안 게이트 기준은 `docs/VALIDATION_NOTES.md`와 PR 템플릿에 반영했다.

### P4. 보안 이벤트 로깅과 운영 규칙 강화

상태:
`완료`

목적:
Level 2에서는 `막는 것`만큼 `이상 징후를 추적할 수 있는가`도 중요합니다.

이번 단계에서 한 일:

- `SecurityEvent` 로거를 추가해 인증/권한/ready 실패를 `event=... key=value ...` 형식으로 남기도록 했다.
- `auth.login_*`, `auth.refresh_*`, `auth.browser_origin_blocked`, `auth.access_denied`, `authorization.scope_denied`, `system.readiness_failed` 이벤트를 코드에 연결했다.
- guard 단계에서도 `x-request-id`를 먼저 보장해 인증 실패와 요청 로그를 같은 request-id로 추적할 수 있게 했다.
- 민감정보 금지 목록과 로그 레벨 기준을 문서에 반영했다.
- 운영 체크리스트에 어떤 보안 이벤트를 먼저 봐야 하는지 추가했다.

주요 파일:

- `apps/api/src/common/infrastructure/operational/*`
- `apps/api/src/common/auth/jwt-auth.guard.ts`
- `apps/api/src/modules/auth/*`
- `apps/api/src/modules/collected-transactions/collected-transactions.controller.ts`
- `apps/api/src/modules/recurring-rules/recurring-rules.controller.ts`
- `apps/api/src/modules/health/health.controller.ts`
- `apps/api/test/*.request-api.test.ts`
- `docs/ERROR_HANDLING_AND_LOGGING.md`
- `docs/OPERATIONS_CHECKLIST.md`

완료 기준:

- 어떤 보안 이벤트를 반드시 로그로 남기는지 문서화된다.
- access token, refresh token, cookie 원문, 비밀번호는 로그에 남지 않는다.
- 인증/권한 실패 흐름이 request-id와 함께 추적 가능하다.

P4 완료 반영:

- 로그인 성공/실패, refresh 실패/재사용, origin 차단, bearer 거부, scope 거부, readiness 실패가 보안 이벤트로 남습니다.
- 보안 이벤트는 `log / warn / error` 레벨로 구분되고 request-id와 함께 조회할 수 있습니다.
- 요청 단위 API 테스트에서 대표 보안 이벤트가 실제로 기록되는지 확인합니다.

### P5. 접근통제와 데이터 보호 증적 보강

현재 상태:
`완료`

목적:
현재 workspace 접근통제를 `실제로 동작하는 보호 규칙`이자 `포트폴리오와 ASVS L2에서 설명 가능한 증적`으로 고정합니다.

구현 반영:

- `GET /collected-transactions`, `GET /recurring-rules`가 current workspace 범위만 반환하고 내부 접근 제어 필드를 노출하지 않음을 요청 단위 API 테스트로 검증했습니다.
- `GET /dashboard/summary`, `GET /forecast/monthly`가 current workspace 데이터만 집계하고 raw read model이나 내부 설정 객체를 노출하지 않음을 요청 단위 API 테스트로 검증했습니다.
- `docs/API.md`에 workspace 범위, 최소 응답 shape, 집계 전용 read endpoint 원칙을 명시했습니다.
- `docs/VALIDATION_NOTES.md`에 P5 증적 테스트 범위를 반영했습니다.

주요 반영 파일:

- `apps/api/test/*.request-api.test.ts`
- `docs/API.md`
- `docs/VALIDATION_NOTES.md`
- `docs/ASVS_L2_BASELINE_MATRIX.md`

완료 기준:

- 접근통제 규칙을 엔드포인트 기준으로 설명할 수 있다.
- 대표적인 negative authorization / 데이터 최소 노출 케이스가 자동화 테스트에 있다.
- 읽기 API가 집계 응답만 노출하고 내부 read model을 직접 노출하지 않는다.

## 지금 바로 시작하기 좋은 Quick Wins

아래 다섯 개는 현재 단계에서 대비 효과가 큽니다.

1. 운영 HTTPS + `Strict-Transport-Security` + `SWAGGER_ENABLED` 리허설
2. CI 보안 job 첫 통과 증적과 required check 연결 확인
3. `npm run audit:runtime`에 남아 있는 취약점 대응 또는 예외 판정
4. `npm run test:prisma`용 DB 환경 고정
5. 외부 감사 저장소/장기 보관 정책 초안 정리

이 다섯 개만 해도 현재 프로젝트의 보안 성숙도와 포트폴리오 설명력이 크게 올라갑니다.

## 테스트/증적 전략

ASVS L2 목표는 `구현`보다 `검증 가능성`이 중요합니다. 각 단계는 아래 중 최소 두 가지를 남겨야 합니다.

- 요청 단위 API 테스트
- 브라우저 E2E
- 대표 통합 테스트
- 문서/ADR
- CI 실행 로그 또는 스캔 결과

추천 검증 순서:

1. `npm run check:quick`
2. `npm run test`
3. 보안 관련 API 테스트
4. 필요 시 `npm run test:e2e`
5. DB 경계까지 바뀌면 `npm run test:prisma`

## 최종 완료 판정

아래 상태가 되면 `ASVS L2를 목표로 체계적으로 진행 중인 프로젝트`라고 말할 수 있습니다.

- 세션이 브라우저 저장소에 직접 노출되지 않는다.
- 인증/세션/권한 실패 케이스가 자동화 테스트로 보호된다.
- current workspace 범위 바깥 데이터가 목록/집계 응답에 섞이지 않는다는 증적이 있다.
- 보안 헤더, anti-automation, 로그 정책이 코드와 문서에 같이 반영된다.
- CI가 dependency, secret, code 보안 스캔을 수행한다.
- 아직 구현하지 않은 ASVS 영역은 `N/A` 또는 `deferred`로 이유가 적혀 있다.

## 참고

- OWASP ASVS Project: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Developer Guide - ASVS: <https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/>
