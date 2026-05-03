# ASVS L2 Execution Plan

## 목적

이 문서는 `PERSONAL_ERP`의 OWASP ASVS Level 2 기준 적용 현황과 남은 운영 리허설 항목을 정리합니다.

현재 코드 보강 단계인 P0-P5는 완료 상태입니다.
최신 판정은 [ASVS L2 Baseline Matrix](./ASVS_L2_BASELINE_MATRIX.md)를 우선하고, 날짜별 검증 증적은 [검증 메모](./VALIDATION_NOTES.md)를 우선합니다.
세부 변경 이력은 [`completed/ASVS_L2_REMEDIATION_EXECUTION_PLAN.md`](./completed/ASVS_L2_REMEDIATION_EXECUTION_PLAN.md)에 보관합니다.

## 기준선

- 이 계획은 `2026-04-22` 기준 OWASP ASVS 프로젝트 페이지에서 안내하는 최신 안정판 `ASVS 5.0.0`을 기준으로 잡습니다.
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
- 환경변수는 런타임에서 검증되고 `env-examples` 계열 예시 파일이 있습니다.
- 모든 API 응답에 `x-request-id`가 붙고 `GET /api/health/ready`가 있습니다.
- 테스트는 use-case, 요청 단위 API, 브라우저 E2E, Prisma 대표 통합 테스트 경로까지 분리되어 있습니다.

### 현재 보안 기반과 남은 갭

- Web은 이제 access token을 메모리 런타임 상태에만 유지합니다.
- refresh token 쿠키는 `__Host-refreshToken`, `Secure`, `HttpOnly`, `SameSite=Strict`, path `/` 기준으로 발급되고, 전환 기간 동안 legacy `refreshToken`도 읽고 삭제합니다.
- refresh token 회전, 서버측 폐기, 재사용 감지, 로그아웃 엔드포인트가 도입되었습니다.
- 로그인/refresh 엔드포인트에 rate limiting 기반 anti-automation 방어가 들어갔습니다.
- 브라우저/API 경계에는 CORS allowlist, API/Web 보안 헤더, CSP, HSTS, `Cache-Control: no-store`, browser origin allowlist 방어가 들어갔지만 운영 HTTPS와 Swagger 노출 토글은 실제 배포 기준으로 다시 점검해야 합니다.
- cookie 기반 인증 흐름은 allowlist 기반 origin 검증으로 1차 보호되지만, 범용 state-changing 폼이 늘어나면 별도 CSRF 전략을 다시 평가해야 합니다.
- 보안 이벤트 로깅은 request-id 기준으로 남기기 시작했지만, 외부 감사 저장소나 장기 보관 정책은 아직 없습니다.
- CI에는 `validate`, `e2e-smoke`, `security-regression`, `prisma-integration`, `audit-runtime`, `semgrep-ce`, `gitleaks`가 들어갔고, GitHub 첫 통과 증적과 required check 연결, disposable DB 기반 `prisma-integration` 통과까지 확인했습니다.

### 2026-04-30 보강 반영

- `WOORI_BANK_HTML`/`WOORI_CARD_HTML` 파일첨부 업로드는 저장 HTML과 암호화 VestMail 원본을 지원합니다. 암호화 원본은 업로드된 dynamic JavaScript를 실행하지 않고 서버 내 SEED/CBC 구현으로만 복호화하며, 비밀번호와 원본 파일은 저장하지 않습니다.
- 운영 CSV 반출은 spreadsheet formula 시작 문자열을 방어합니다.
- 회원가입, 비밀번호 변경, 비밀번호 재설정은 common/context-derived password를 차단합니다.
- JWT access/refresh secret은 32 bytes 이상 base64/base64url random secret, 서로 다른 값, placeholder 금지 조건을 env parse 단계에서 검증합니다.

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

- MFA/2FA
- 외부 파일 storage/다운로드 보안
- 외부 결제/SMS 연동
- 모바일 앱 전용 토큰 저장소

위 항목들은 기능이 생기기 전까지 억지로 구현하지 않습니다.

## 완료 단계 요약

| 단계                          | 결과                                                                           | 현재 기준                                    |
| ----------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------- |
| P0. 기준선과 증적 구조        | ASVS 판정 규칙과 증적 정책 고정                                                | `ASVS_L2_BASELINE_MATRIX.md`, ADR 0004       |
| P1. 인증/세션                 | 메모리 access token, refresh cookie, rotation/revoke/reuse detection 적용      | `auth` API, Web auth store, 요청 단위 테스트 |
| P2. 브라우저/API 경계         | CORS allowlist, 보안 헤더, `no-store`, origin 차단 적용                        | API bootstrap, Web security header 테스트    |
| P3. CI 보안 게이트            | security regression, runtime audit, Semgrep, Gitleaks, Prisma integration 정리 | `.github/workflows/ci.yml`, `package.json`   |
| P4. 보안 이벤트/운영 로그     | 로그인/refresh/origin/권한/readiness 실패 이벤트를 request-id와 연결           | 운영 로그, `ERROR_HANDLING_AND_LOGGING.md`   |
| P5. 접근통제/데이터 보호 증적 | current workspace 범위와 최소 응답 shape를 요청 테스트로 고정                  | `docs/API.md`, `VALIDATION_NOTES.md`         |

## 남은 운영 항목

1. 운영 HTTPS, HSTS, `SWAGGER_ENABLED=false` 배포 리허설과 증적 정리
2. 외부 감사 저장소 또는 장기 보관 정책 초안 정리
3. 운영 데이터 분류와 보존 기간 정책 구체화

runtime dependency audit의 날짜별 이력과 advisory 판정은 `VALIDATION_NOTES.md`를 우선합니다.

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

## 현재 완료 판정

현재 프로젝트는 아래 기준을 충족합니다.

- 세션이 브라우저 저장소에 직접 노출되지 않는다.
- 인증/세션/권한 실패 케이스가 자동화 테스트로 보호된다.
- current workspace 범위 바깥 데이터가 목록/집계 응답에 섞이지 않는다는 증적이 있다.
- 보안 헤더, anti-automation, 로그 정책이 코드와 문서에 같이 반영된다.
- CI가 dependency, secret, code 보안 스캔을 수행한다.
- 아직 구현하지 않은 ASVS 영역은 `N/A` 또는 `deferred`로 이유가 적혀 있다.

## 참고

- OWASP ASVS Project: <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Developer Guide - ASVS: <https://devguide.owasp.org/en/06-verification/01-guides/03-asvs/>
