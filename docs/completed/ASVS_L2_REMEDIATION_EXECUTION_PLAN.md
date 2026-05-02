# ASVS L2 Remediation Execution Plan 2026-04-30

## 최우선 작업 규칙

- 이 저장소의 모든 파일 읽기, 생성, 수정, 삭제 작업은 UTF-8 인코딩을 기준으로 수행한다.
- PowerShell에서는 `Get-Content -Encoding UTF8`, `Set-Content -Encoding UTF8` 또는 동등한 UTF-8 안전 명령을 사용한다.
- 검색은 가능하면 `rg --encoding utf-8`을 사용한다.
- 이 규칙은 후속 요약, 인수인계, 작업 메모에서 생략하지 않는다.

## 목표

현재 프로젝트를 "ASVS L2를 목표로 진행 중" 상태에서 "저장소 기준으로 ASVS L2 핵심 요구를 충족한다고 주장 가능한 상태"로 끌어올린다.

기준 버전은 OWASP ASVS 5.0.0이다.

- 공식 프로젝트: https://owasp.org/www-project-application-security-verification-standard/
- 기준 CSV: https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv

## 현재 판정

현재 저장소는 인증, 세션, RBAC, API 입력 검증, API 보안 헤더, 런타임 감사, CI 보안 잡의 기반이 있다. 다만 아래 blocker와 partial 항목 때문에 지금 상태를 ASVS L2 완전 충족으로 판정하지 않는다.

이번 실행계획은 "문서 보강"보다 "코드와 검증 증적을 먼저 고치는 순서"를 따른다.

## 실행 원칙

- Critical blocker는 기능 축소가 있더라도 fail-closed로 먼저 막는다.
- 보안 패치는 기존 사용자 흐름을 깨뜨릴 수 있으므로 API 테스트와 web 테스트를 각 단계마다 실행한다.
- ASVS 문서는 모든 코드 변경이 끝난 뒤 한 번에 최신 증거 기준으로 갱신한다.
- Docker가 필요한 Semgrep/Gitleaks는 로컬 Docker가 없는 환경에서는 CI 통과 증적으로 대체한다.

## 2026-04-30 적용 현황

상태: Phase 1-6 코드는 적용 완료, Phase 7-9는 운영 증적과 최종 검증 단계로 남긴다.

- Phase 1 완료: `WOORI_BANK_HTML`/`WOORI_CARD_HTML`의 HTML 복호화 경로에서 dynamic JavaScript 실행을 제거했다. 이후 정적 저장 HTML 업로드를 유지하고, 암호화 VestMail 원본은 서버 내 SEED/CBC 구현으로만 복호화하도록 복구했다.
- Phase 2 완료: Next.js web route 전체에 CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, frame 방어 헤더를 적용하고 테스트를 추가했다.
- Phase 3 완료: refresh cookie를 `__Host-refreshToken`, `Secure`, `HttpOnly`, `SameSite=Strict`, path `/` 기준으로 고정하고 legacy `refreshToken` 읽기/삭제 전환 경로를 남겼다.
- Phase 4 완료: 운영 CSV 반출 문자열 셀에 spreadsheet formula guard를 적용하고 요청 단위 테스트를 추가했다.
- Phase 5 완료: 회원가입, 비밀번호 변경, 비밀번호 재설정 경로에 common/context-derived password 차단 정책을 적용했다.
- Phase 6 완료: JWT access/refresh secret은 32 bytes 이상 base64/base64url random secret, 서로 다른 값, placeholder 금지 조건을 env parse 단계에서 검증한다.
- Phase 7 남음: 운영 rate limit 계측과 실제 배포 리허설 증적을 보강한다.
- Phase 8 남음: runtime audit moderate advisory를 만료형 allowlist와 CI 결과로 추적한다.
- Phase 9 진행 중: ASVS 기준 문서와 validation note를 최신 구현 상태로 맞추고 최종 승인 게이트를 실행한다.

## Phase 0. Baseline 고정

상태: 준비됨

목적: 이후 보안 패치가 기존 회귀를 만들었는지 비교할 기준을 고정한다.

작업:

- [ ] 현재 브랜치와 작업 중 변경 사항을 확인한다.
- [ ] 기존 사용자 UI 변경 파일과 보안 패치 파일을 섞지 않는다.
- [ ] 아래 명령을 기준 검증으로 실행한다.

검증:

```powershell
npm.cmd run docs:check
npm.cmd run test:security:api
npm.cmd run test:web
npm.cmd run audit:runtime
```

현재 기준 결과:

- `docs:check`: 통과
- `test:security:api`: 통과, tests 305, fail 0
- `test:web`: 통과, tests 29, fail 0
- `audit:runtime`: 통과, high 0, critical 0
- `audit:runtime:full`: `postcss <8.5.10` moderate 3건, 현재 npm 기준 no fix available

완료 기준:

- 보안 패치 전 기준 결과가 이 문서 또는 후속 validation note에 남아 있다.

## Phase 1. Woori HTML dynamic JS execution 제거

상태: 최우선

영향: critical

관련 ASVS:

- v5.0.0-V1.3.2 dynamic code execution 회피
- v5.0.0-V1.3.3 dangerous context sanitization
- v5.0.0-V5.2 uploaded file 검증

문제 근거:

- `apps/api/src/modules/import-batches/woori-bank-html-statement.parser.ts:268`
- `apps/api/src/modules/import-batches/woori-bank-html-statement.parser.ts:294`
- `apps/api/src/modules/import-batches/application/use-cases/create-import-batch-from-file.use-case.ts:94`
- `apps/api/src/modules/import-batches/dto/create-import-batch-file.dto.ts:35`

현재 위험:

- Woori HTML 업로드 시 HTML에서 추출한 JavaScript를 `new Function(...)`으로 서버에서 실행하던 위험을 제거한다.
- 함수명이 `runDecryptionInSandbox`지만 Node 프로세스 내부 실행이므로 보안 sandbox로 볼 수 없다.
- 비밀번호가 JavaScript 문자열에 직접 보간된다.

실행 방안: 서버 JS 실행 제거와 정적 HTML 허용

- [x] `new Function` 경로가 런타임에서 호출되지 않도록 한다.
- [x] 암호화 VestMail 원본은 업로드된 JavaScript 실행 없이 서버 내 SEED/CBC 구현으로만 복호화한다.
- [x] 브라우저에서 열어 저장한 정적 Woori HTML 파일 업로드는 허용한다.
- [x] Web 업로드 화면에서는 Woori HTML을 파일 첨부 옵션으로 노출한다.
- [x] 기존 parser 파일은 정적 HTML 파싱 전용으로 유지한다.

권장 수정 파일:

- `apps/api/src/modules/import-batches/application/use-cases/create-import-batch-from-file.use-case.ts`
- `apps/api/src/modules/import-batches/dto/create-import-batch-file.dto.ts`
- `apps/api/test/*.test.ts`
- 필요 시 `apps/web/src/features/imports/*`

DTO 보강:

- [x] `password`에 `@Matches(/^\d{6}$/)`를 추가한다.
- [x] Woori HTML이 정적 HTML로 재허용되어도 DTO 자체는 positive validation을 갖게 둔다.

테스트:

- [x] `POST /import-batches/files`가 저장된 Woori HTML 요청을 배치로 생성한다.
- [x] `POST /import-batches/files`가 암호화 VestMail 원본을 비밀번호 숫자 6자리로 배치 생성한다.
- [x] `POST /import-batches/files`가 암호화 VestMail 원본의 누락/오류 비밀번호를 400으로 거부한다.
- [x] Woori HTML 비밀번호가 숫자 6자리가 아니면 DTO validation에서 실패한다.
- [x] `IM_BANK_PDF` 업로드 기존 테스트는 계속 통과한다.

검증:

```powershell
npm.cmd run test:security:api
rg --encoding utf-8 -n "new Function|runDecryptionInSandbox" apps\api\src
```

완료 기준:

- 인증된 editor/manager/owner도 서버에서 업로드 HTML JavaScript를 실행시킬 수 없다.
- `new Function` 호출 경로는 삭제되었거나 호출 불가능한 quarantine 상태다.
- 보안 테스트가 통과한다.

후속 방안 B: 기능 복구

- [x] VestMail/SEED 복호화를 서버 내 순수 구현으로 대체한다.
- [x] 외부 HTML script는 절대 서버에서 실행하지 않는다.
- [x] 복호화 테스트 fixture는 synthetic fixture를 사용하고, 실제 개인정보가 담긴 파일을 저장소에 넣지 않는다.

## Phase 2. Web security headers 고정

상태: 높음

영향: high

관련 ASVS:

- v5.0.0-V3.4.1 HSTS
- v5.0.0-V3.4.3 CSP
- v5.0.0-V3.4.4 X-Content-Type-Options
- v5.0.0-V3.4.5 Referrer-Policy
- v5.0.0-V3.4.6 frame-ancestors

문제 근거:

- API header: `apps/api/src/common/infrastructure/security/browser-boundary.ts:31`
- Web config: `apps/web/next.config.mjs:116`

현재 위험:

- API에는 보안 헤더가 있다.
- Next.js web app의 HTML/document 응답에 대한 CSP, HSTS, frame-ancestors, Referrer-Policy, Permissions-Policy 증거가 저장소에 없다.

실행 방안:

- [ ] `apps/web/next.config.mjs`에 `async headers()`를 추가한다.
- [ ] 모든 web route에 기본 보안 헤더를 적용한다.
- [ ] 개발 환경에서 필요한 Next.js dev 기능과 충돌하지 않도록 production 중심 CSP를 설계한다.
- [ ] inline script/style 요구가 있다면 nonce/hash 기반이 가능한지 확인하고, 당장 어렵다면 단계적으로 CSP를 강화한다.

권장 기본 헤더:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), geolocation=(), microphone=()`
- `X-Frame-Options: DENY`
- `Content-Security-Policy` with `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`
- HTTPS 운영 환경에서 `Strict-Transport-Security: max-age=31536000; includeSubDomains`

주의:

- HSTS는 HTTPS가 보장되는 운영 배포에서만 적용한다.
- Next/Image, font, API origin, dev websocket이 있으면 CSP connect/img/font/script/style source를 실제 사용처 기준으로 조정한다.

테스트:

- [ ] web 테스트 또는 별도 unit test로 `next.config.mjs`의 header source가 존재하는지 검증한다.
- [ ] e2e smoke에서 주요 페이지가 CSP 때문에 깨지지 않는지 확인한다.

검증:

```powershell
npm.cmd run test:web
npm.cmd run test:e2e:smoke:build
```

완료 기준:

- 저장소 코드만으로 web 응답 보안 헤더 적용을 입증할 수 있다.
- API 문서와 ASVS matrix에 web/API header 범위가 분리되어 반영되어 있다.

## Phase 3. Refresh cookie hardening

상태: 높음

영향: medium-high

관련 ASVS:

- v5.0.0-V3.3.1 Secure + `__Host-` 또는 `__Secure-`
- v5.0.0-V3.3.3 `__Host-` 기본
- v5.0.0-V3.3.4 HttpOnly

문제 근거:

- `apps/api/src/modules/auth/auth.controller.ts:67`
- `apps/api/src/modules/auth/auth.controller.ts:74`

현재 상태:

- cookie 이름은 `refreshToken`이다.
- `HttpOnly`와 `SameSite=strict`는 적용되어 있다.
- `Secure`는 `APP_ORIGIN`이 HTTPS일 때 true다.
- path는 `/api/auth`다.

실행 방안:

- [ ] cookie 이름을 `__Host-refreshToken`으로 변경한다.
- [ ] 운영 cookie는 `Secure: true`, `HttpOnly: true`, `SameSite: strict`, `Path: /`, Domain 미설정으로 고정한다.
- [ ] 로컬 HTTP 개발 환경은 별도 dev cookie 정책을 명시한다.
- [ ] 전환 기간 동안 refresh/logout에서 legacy `refreshToken`도 읽고, logout 시 legacy cookie도 함께 clear한다.
- [ ] 테스트에서 `Set-Cookie` 속성을 검증한다.

권장 수정 파일:

- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/test/*.test.ts`
- `docs/API.md`
- `docs/ASVS_L2_BASELINE_MATRIX.md`

테스트:

- [ ] login 응답이 `__Host-refreshToken`을 설정한다.
- [ ] refresh 응답이 새 cookie 이름으로 rotation한다.
- [ ] logout이 새 cookie와 legacy cookie를 모두 제거한다.
- [ ] HTTPS origin 설정 테스트에서 `Secure`가 포함된다.

검증:

```powershell
npm.cmd run test:security:api
```

완료 기준:

- 운영 배포 기준 refresh cookie가 ASVS cookie prefix 요구를 만족한다.
- 이전 cookie 이름으로 인한 사용자 세션 잔여 위험을 logout/refresh에서 정리한다.

## Phase 4. CSV formula injection 방어

상태: 높음

영향: medium

관련 ASVS:

- v5.0.0-V1.2.10 CSV and Formula Injection

문제 근거:

- `apps/api/src/modules/operations-console/operations-console.service.ts:1167`

현재 위험:

- CSV export는 따옴표, 쉼표, 개행은 처리한다.
- `=`, `+`, `-`, `@`, tab, carriage return 같은 formula 시작 문자 방어는 없다.

실행 방안:

- [ ] CSV cell 문자열 정규화 함수를 추가한다.
- [ ] trim 전 원문 기준으로 위험 시작 문자를 판단한다.
- [ ] 위험 셀 앞에 `'`를 붙인 뒤 CSV escaping을 적용한다.
- [ ] 숫자 타입은 숫자로 의도한 값이면 그대로 두되, 문자열 필드는 모두 formula guard를 통과시킨다.

권장 수정 파일:

- `apps/api/src/modules/operations-console/operations-console.service.ts`
- `apps/api/test/*.test.ts`

테스트 입력:

- `=HYPERLINK("http://example.test","x")`
- `+SUM(1,1)`
- `-10+20`
- `@cmd`
- tab으로 시작하는 문자열

검증:

```powershell
npm.cmd run test:security:api
```

완료 기준:

- CSV export의 사용자 제어 문자열이 spreadsheet formula로 실행되지 않는다.

## Phase 5. Password policy L2 보강

상태: 중간

영향: medium

관련 ASVS:

- v5.0.0-V6.2.4 top password denylist
- v5.0.0-V6.2.9 최소 64자 이상 허용
- v5.0.0-V6.2.11 context-specific words denylist
- v5.0.0-V6.2.12 breached password check

문제 근거:

- `apps/api/src/modules/auth/dto/register.dto.ts:20`
- `apps/api/src/modules/auth/dto/register.dto.ts:21`

현재 상태:

- 최소 8자, 최대 128자는 적용되어 있다.
- common password, 제품명, 이메일 local-part, leaked password 차단 근거가 없다.

실행 방안:

- [ ] `PasswordPolicyService` 또는 동등한 domain helper를 추가한다.
- [ ] register, accept invitation, change password, reset password에서 같은 정책을 재사용한다.
- [ ] top/common password denylist를 저장소에 포함한다.
- [ ] 이메일 local-part, 사용자 이름, `personal`, `erp`, `personal-erp` 같은 context 단어 포함을 거부한다.
- [ ] breached password check는 운영 네트워크 의존성을 고려해 단계화한다.

현실적인 1차 적용:

- [ ] 저장소 내 denylist 기반 차단
- [ ] 사용자 context 기반 차단
- [ ] 최소 길이 8 유지, 최대 길이 128 유지
- [ ] 64자 이상 password가 정상 통과하는 테스트 추가

2차 적용:

- [ ] HIBP k-anonymity API 또는 사내 breach corpus 연동 방안 ADR 작성
- [ ] 외부 API 장애 시 fail-open/fail-closed 정책 결정

권장 수정 파일:

- `apps/api/src/modules/auth/application/*`
- `apps/api/src/modules/auth/dto/*`
- `apps/api/test/*.test.ts`
- 필요 시 `security/password-denylist.txt`

검증:

```powershell
npm.cmd run test:security:api
```

완료 기준:

- 주요 비밀번호 설정 경로가 같은 정책을 적용한다.
- common/context password가 거부된다.
- 64자 이상의 안전한 passphrase가 허용된다.

## Phase 6. JWT secret entropy 검증 강화

상태: 중간

영향: medium

관련 ASVS:

- v5.0.0-V11.2.3 최소 128-bit 보안 강도
- v5.0.0-V11.5.1 non-guessable random 값 128-bit entropy

문제 근거:

- `apps/api/src/config/api-env.ts:235`
- `apps/api/src/config/api-env.ts:238`

현재 위험:

- JWT secret은 최소 길이 16만 검증한다.
- 낮은 엔트로피의 사람이 만든 문자열을 코드가 거부한다고 입증하기 어렵다.

실행 방안:

- [ ] `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 검증을 별도 함수로 분리한다.
- [ ] base64url 또는 base64 secret을 권장 형식으로 정한다.
- [ ] decoded byte 길이 32바이트 이상을 요구한다.
- [ ] access secret과 refresh secret이 서로 같으면 부팅 실패시킨다.
- [ ] env example과 development guide에 생성 명령을 추가한다.

권장 생성 명령:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

권장 수정 파일:

- `apps/api/src/config/api-env.ts`
- `env-examples/*`
- `docs/DEVELOPMENT_GUIDE.md`
- `apps/api/test/*.test.ts`

검증:

```powershell
npm.cmd run test:security:api
npm.cmd run typecheck:api
```

완료 기준:

- 짧거나 사람이 만든 JWT secret은 env parsing 단계에서 실패한다.
- 32바이트 이상 CSPRNG secret만 통과한다.
- access/refresh secret 재사용이 거부된다.

## Phase 7. 운영 rate limit 증적 강화

상태: 중간

영향: medium

관련 ASVS:

- v5.0.0-V2.4.1 anti-automation
- v5.0.0-V6.3.1 credential stuffing / brute force 방어

문제 근거:

- `apps/api/src/modules/auth/auth-rate-limit.service.ts:9`
- `apps/api/src/modules/auth/auth-rate-limit.service.ts:20`

현재 상태:

- login, refresh, register, reset 관련 제한은 구현되어 있다.
- 저장소 구현은 in-memory `Map`이라 API 인스턴스가 늘어나면 공유되지 않는다.

실행 방안:

- [ ] rate limit 저장소 interface를 분리한다.
- [ ] 현재 in-memory 구현은 local/dev adapter로 명시한다.
- [ ] 운영 adapter 후보를 정한다.
- [ ] 당장 Redis를 도입하지 않는다면 reverse proxy, WAF, API gateway rate limit 설정을 운영 증적으로 문서화한다.

선택지 A: 저장소 안에서 바로 강화

- [ ] Prisma/MySQL 기반 auth rate limit bucket을 추가한다.
- [ ] TTL cleanup 전략을 추가한다.
- [ ] 동시 요청 race condition을 고려해 atomic update 또는 transaction을 쓴다.

선택지 B: 운영 경계에서 강화

- [ ] Cloudflare, Nginx, ALB/WAF 등 실제 배포 경계의 rate limit 규칙을 문서화한다.
- [ ] auth endpoint별 limit과 key 전략을 명시한다.

완료 기준:

- ASVS 문서에서 "운영 환경에서도 brute force 제한이 공유된다"는 증거가 남는다.
- local/dev in-memory 제한과 production 제한의 책임 경계가 분명하다.

## Phase 8. Runtime audit moderate advisory 처리

상태: 추적

영향: medium-low

현재 결과:

- `npm.cmd run audit:runtime`: high 0, critical 0으로 통과
- `npm.cmd run audit:runtime:full`: `postcss <8.5.10` moderate 3건
- 현재 npm 기준 no fix available

실행 방안:

- [ ] `security/runtime-audit-allowlist.json`에는 high/critical만 예외로 허용한다는 현재 정책을 유지한다.
- [ ] moderate advisory는 `docs/VALIDATION_NOTES.md`에 추적 상태로 남긴다.
- [ ] `next`, `postcss`, `@mui/material-nextjs` 업데이트 가능 여부를 주기적으로 확인한다.
- [ ] fix가 나오면 즉시 dependency patch PR로 처리한다.

검증:

```powershell
npm.cmd run audit:runtime
npm.cmd run audit:runtime:full
```

완료 기준:

- high/critical gate는 계속 0으로 유지된다.
- moderate advisory의 위험 수용 사유와 재검토 조건이 문서에 남는다.

## Phase 9. ASVS 문서 최신화

상태: 마지막 단계

영향: medium-low

문제 근거:

- `docs/ASVS_L2_BASELINE_MATRIX.md:138`
- `apps/api/src/modules/auth/auth.controller.ts:175`
- `apps/api/src/modules/auth/auth.controller.ts:192`

현재 문제:

- baseline matrix는 비밀번호 재설정이 없다고 적지만 실제 API에는 forgot/reset password가 구현되어 있다.
- ASVS 문서가 실제 구현 상태와 일부 어긋나 있다.

실행 방안:

- [ ] `docs/ASVS_L2_BASELINE_MATRIX.md`를 현재 구현 기준으로 갱신한다.
- [ ] `docs/ASVS_L2_EXECUTION_PLAN.md`에서 완료/남은 작업을 이번 phase 기준으로 재정렬한다.
- [ ] 각 ASVS 영역에 evidence 파일, 테스트 명령, 남은 운영 증적을 분리해 적는다.
- [ ] "완전 충족", "부분 충족", "운영 증적 필요", "N/A" 판정 기준을 일관되게 맞춘다.

권장 수정 파일:

- `docs/ASVS_L2_BASELINE_MATRIX.md`
- `docs/ASVS_L2_EXECUTION_PLAN.md`
- `docs/API.md`
- `docs/VALIDATION_NOTES.md`

검증:

```powershell
npm.cmd run docs:check
```

완료 기준:

- 문서가 실제 코드와 테스트 상태를 반영한다.
- 비밀번호 재설정, cookie, web headers, runtime audit, Woori HTML 안전 복호화 복구 상태가 모두 최신이다.

## 최종 승인 게이트

모든 phase 완료 후 아래 명령을 실행한다.

```powershell
npm.cmd run docs:check
npm.cmd run test:security:api
npm.cmd run test:web
npm.cmd run audit:runtime
npm.cmd run build
```

Docker 사용 가능 환경 또는 CI에서는 추가로 실행한다.

```powershell
npm.cmd run ci:local:semgrep
npm.cmd run ci:local:gitleaks
```

ASVS L2 주장 가능 조건:

- Woori HTML dynamic JS execution이 제거되어 있고, 암호화 VestMail 원본은 서버 내 SEED/CBC 구현으로만 복호화된다.
- web/API 보안 헤더 범위가 저장소와 운영 증적으로 확인된다.
- refresh cookie가 운영 기준으로 `__Host-` 또는 `__Secure-` 요구를 충족한다.
- password, JWT secret, CSV export, rate limit의 partial 항목이 코드 또는 운영 증적으로 보강되어 있다.
- `ASVS_L2_BASELINE_MATRIX.md`와 `ASVS_L2_EXECUTION_PLAN.md`가 실제 구현과 일치한다.
- CI에서 runtime audit, security regression, Semgrep, Gitleaks가 통과한다.

## 권장 작업 순서

1. 완료: Phase 1 `WOORI_BANK_HTML` dynamic JS execution 제거
2. 완료: Phase 2 Web security headers 고정
3. 완료: Phase 3 Refresh cookie hardening
4. 완료: Phase 4 CSV formula injection 방어
5. 완료: Phase 5 Password policy L2 보강
6. 완료: Phase 6 JWT secret entropy 검증 강화
7. 남음: Phase 7 운영 rate limit 증적 강화
8. 남음: Phase 8 runtime audit moderate advisory 추적
9. 진행 중: Phase 9 ASVS 문서 최신화

## 다음 작업 시작점

다음 작업은 Phase 7-9를 묶어 진행한다.

남은 목표:

- 운영 rate limit 설정과 관측 증적을 배포 환경 기준으로 남긴다.
- runtime audit moderate advisory와 Docker 기반 Semgrep/Gitleaks는 CI 통과 증적으로 관리한다.
- `docs:check`, `test:security:api`, `test:web`, `audit:runtime`, `build` 최종 게이트를 통과시킨다.
