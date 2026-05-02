# 협업 가이드

## 목표

이 저장소는 빠르게 기능을 붙일 수 있으면서도, 구조와 계약이 흐트러지지 않도록 협업 규칙을 명확하게 유지합니다.

## 기본 작업 순서

1. 최신 브랜치에서 작업 브랜치를 만듭니다.
2. 변경 전에 관련 문서와 계약 구조를 확인합니다.
3. 기능 구현 후 `npm run check:quick`와 `npm run test`를 실행합니다.
4. 동작 방식이 바뀌면 문서를 같이 수정합니다.
5. 리뷰 가능한 단위로 PR을 올립니다.

## 브랜치와 PR 기본 규칙

- 기본 브랜치는 `main`으로 고정합니다.
- 현재 운영 기준은 `main` 직접 push 대신 작업 브랜치 + PR 흐름입니다.
- PR을 머지할 때는 GitHub Actions `CI` 워크플로 통과를 기본 기준으로 봅니다.
- 브랜치 예시: `feat/auth-refresh`, `fix/dashboard-summary`, `docs/windows-env-guide`
- PR 제목 예시: `feat: add transaction mutation flow`
- PR 본문에는 목적, 변경 범위, 검증 방법, 문서 반영 여부를 적습니다.
- 계약, env, 마이그레이션, 운영 문서 변경이 있으면 PR 체크리스트에서 명시합니다.

## GitHub 저장소 설정 체크리스트

- 아래 항목은 `저장소 설정이 허용하는 범위에서 목표로 삼는 운영 기준`입니다.
- 기본 브랜치는 `main`으로 둡니다.
- `main` 보호 브랜치 규칙에서 PR 기반 머지를 강제합니다.
- `main` 보호 브랜치 규칙에서 상태 검사 통과를 강제합니다.
- 필수 상태 검사는 GitHub UI에 표시되는 `validate` 또는 `CI / validate` 항목으로 지정합니다.
- 머지 전에 브랜치 최신화를 요구해 오래된 CI 결과가 그대로 합쳐지지 않도록 합니다.
- `main` 직접 push는 차단합니다.
- 현재 기준 CODEOWNERS 기본 범위는 전체 저장소이며, 기본 책임자는 `@cheon0965`입니다.
- 저장소가 단일 유지보수 단계인 동안에는 승인 리뷰 강제를 기본값으로 두지 않고, 협업 인원이 늘면 CODEOWNERS 리뷰 강제를 다시 검토합니다.
- 현재 비공개 저장소 플랜이나 GitHub 설정 상태에 따라 규칙 집합/서버 강제가 바로 활성화되지 않을 수 있습니다.
- 이 경우에도 저장소 운영 규칙 자체는 `작업 브랜치 -> PR -> CI 확인`을 기본 흐름으로 유지합니다.

## 릴리즈와 태그 규칙

- 첫 기준 태그부터 `vMAJOR.MINOR.PATCH` 형식을 사용합니다.
- 호환성 깨짐은 MAJOR, 기능 추가는 MINOR, 버그 수정/문서/설정 변경은 PATCH를 올립니다.
- 초기 예시: `v0.1.0`, `v0.1.1`, `v0.2.0`
- 첫 공개 가능한 기준 커밋을 만든 뒤 `v0.1.0`을 시작 태그로 사용합니다.

## 구조 규칙

- 웹은 `app -> features -> shared` 흐름을 유지합니다.
- API 기본 흐름은 `컨트롤러 -> 서비스 -> 저장소 -> 변환기/계산기`입니다.
- 핵심 쓰기 흐름으로 승격된 모듈은 `컨트롤러 -> 유스케이스 -> 포트 -> 어댑터` 경계를 사용합니다.
  현재 승격 기준과 목록은 `docs/ARCHITECTURE.md`와 `docs/DEVELOPMENT_GUIDE.md`를 우선합니다.
- `dashboard`, `funding-account-status`, `forecast`는 `컨트롤러 -> 읽기 서비스 -> 읽기 저장소/계산 -> 투영` 흐름을 사용합니다.
- 공용 계약은 `packages/contracts`를 단일 소스로 사용합니다.
- 사용자 경계가 필요한 데이터는 `user.currentWorkspace`와 `tenantId` / `ledgerId` / `membershipRole` 기준으로 다룹니다.
- `dashboard`, `funding-account-status`, `forecast`는 읽기/조합 컨텍스트로 보고, `collected-transactions`, `recurring-rules`의 쓰기 규칙을 직접 소유하지 않습니다.
- 다른 모듈의 저장소, 어댑터, 컨트롤러를 직접 가져다 쓰는 방식은 기본 규칙으로 사용하지 않습니다.
- 모듈 바깥에서 공개 경계가 있는 API 모듈을 참조할 때는 해당 모듈의 `public.ts`만 공식 진입점으로 사용합니다.
- 서비스 분리, 메시지 브로커, 아웃박스, 게이트웨이 도입은 별도 ADR 없이 진행하지 않습니다.

## 비밀정보 규칙

- `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` 같은 비밀값은 저장소 밖 SECRET 폴더에 둡니다.
- 현재 문서의 기본 SECRET 폴더 예시는 루트 [`.secret-dir.local`](./.secret-dir.local) 에 정의된 `C:\secrets\personal-erp` 입니다.
- 실제 기준 파일은 `C:\secrets\personal-erp\api.env`, `C:\secrets\personal-erp\web.env` 입니다.
- `.secret-dir.local`에는 `PERSONAL_ERP_SECRET_DIR` 경로만 기록합니다.
- macOS/Linux에서는 같은 의미의 절대 경로를 사용하고, 자세한 예시는 `README.md`와 `ENVIRONMENT_SETUP.md`를 기준으로 맞춥니다.
- 실제 비밀값 파일은 Git에 추가하지 않습니다.

## 데이터베이스 변경 규칙

- 스키마 변경은 `npm run db:migrate` 기준으로 진행합니다.
- `db:push:unsafe`는 로컬 복구나 예외 상황이 아니면 기본 흐름으로 쓰지 않습니다.
- 스키마 PR에는 migration 파일이 함께 포함되어야 합니다.

## 대체 응답 규칙

- 데모 대체 응답은 기본적으로 끈 상태가 기준입니다.
- 로컬 개발에서만 `NEXT_PUBLIC_ENABLE_DEMO_FALLBACK=true`로 명시적으로 켭니다.
- 현재 권장 위치는 `C:\secrets\personal-erp\web.env` 입니다.
- 대체 응답 정책이 바뀌면 [FALLBACK_POLICY.md](./docs/FALLBACK_POLICY.md) 를 같이 갱신합니다.

## 테스트 규칙

- 최소 실행 기준: `npm run check:quick`
- PR 전 권장 기준: `npm run test`
- `npm run check:quick`에는 `npm run docs:check`가 포함되며, 문서의 `npm run` 표기와 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/OPERATIONS_CHECKLIST.md`, `docs/VALIDATION_NOTES.md`의 웹/API 표면이 실제 라우트와 컨트롤러 기반 Swagger 표면과 맞는지 함께 확인합니다.
- 인증/세션, CORS, 보안 헤더, 브라우저/API 경계 정책을 바꿨다면 `npm run test:security:api`를 같이 봅니다.
- `package.json` 또는 잠금 파일을 바꿨다면 `npm run audit:runtime`와 CI `audit-runtime` 결과를 같이 확인합니다.
- 불가피한 런타임 보안 권고 예외를 추가할 때는 `security/runtime-audit-allowlist.json`에 `id`, `package`, `severity`, `trackedAt`, `expiresOn`, `reason`을 함께 남기고, 해소되면 바로 제거합니다.
- 남아 있는 런타임 보안 권고 상세를 다시 볼 때는 `npm run audit:runtime:full`을 사용합니다.
- 브라우저 흐름을 건드리면 `npm run test:e2e`를 추가로 봅니다.
- Next.js build 결과물, 공용 라우팅, 인증 복원, 운영 체크리스트 스모크 검증에 영향을 줄 수 있다면 `npm run test:e2e:smoke:build:browser`를 추가로 봅니다.
- Prisma/MySQL 경계를 건드리면 `npm run test:prisma`를 대표 심화 검증으로 사용합니다.
- 인증, 소유권 검증, 월말 계산 로직을 건드리면 관련 테스트를 같이 수정합니다.
- 금액 필드나 금액 집계/반올림/배분을 건드리면 `@personal-erp/money` 도우미 함수와 `npm run money:check` 기준을 함께 확인합니다.

## 금액 규칙

- HTTP 계약의 금액은 `MoneyWon` 의미의 `number`이며 KRW 원 단위 안전한 정수만 허용합니다.
- Prisma 영속 금액 컬럼은 `Decimal(19,0)` 기준으로 유지하고, API 변환기/어댑터 경계에서 `MoneyWon(number)`로 변환합니다.
- 금액 합산, 차감, `HALF_UP` 반올림, 배분 잔차 보정은 `@personal-erp/money`를 사용하고 `money` 패키지 밖에서 직접 `Number(...)`, `+/-`, `+=/-=`를 새로 추가하지 않습니다.
- 이 규칙은 `npm run money:check`와 `npm run check:quick`에 포함된 정적 가드로 검증합니다.

## 문서 갱신 규칙

- env 키 또는 SECRET 경로 방식 변경: `ENVIRONMENT_SETUP.md`
- 배포/운영 절차 변경: `docs/OPERATIONS_CHECKLIST.md`, `docs/DOCKER_DEPLOYMENT.md`
- 협업 흐름 변경: `CONTRIBUTING.md`
- 구조 변경: `docs/ARCHITECTURE.md`
- 현재 기능 범위 변경: `docs/CURRENT_CAPABILITIES.md`, `docs/API.md`
- 금액 계약/연산/검증 기준 변경: `docs/API.md`, `docs/VALIDATION_NOTES.md`, `docs/ARCHITECTURE.md`
- 설계 결정 기록: `docs/adr/`

## 계약과 문서 동기화 규칙

- Web과 API가 함께 쓰는 요청/응답 형태 변경은 항상 `packages/contracts`부터 반영합니다.
- 현재 구현된 엔드포인트 목록, DTO 검증, 인증 노출 상태는 Swagger(`api/docs`)를 기준으로 확인합니다.
- `docs/API.md`는 사람이 읽는 API 요약과 인증/쓰기 흐름 설명만 유지합니다.
- `README.md`는 저장소 진입점과 빠른 시작만 담당하고, 상세 API 기준 문서 역할은 맡기지 않습니다.
- `docs/CURRENT_CAPABILITIES.md`는 현재 구현된 기능과 운영 지원 범위의 요약 기준입니다.
- `docs/VALIDATION_NOTES.md`는 “지금 실제로 무엇을 검증하고 있는가”와 남은 공백만 기록합니다.
- `docs/PROJECT_PLAN.md`는 중기 로드맵, `PORTFOLIO_ARCHITECTURE_GUIDE.md`는 프로젝트 목적, 판단 원칙, 현재 아키텍처 설명을 기록합니다.
- API, env, 대체 응답 정책, 테스트 범위가 바뀌면 관련 문서를 같은 PR에서 함께 갱신합니다.
- 이 우선순위 자체가 바뀌는 구조 결정이면 ADR을 추가합니다.

## ADR 작성 기준

다음 중 하나에 해당하면 ADR 추가를 권장합니다.

- 장기적으로 유지할 구조 경계를 바꿀 때
- 테스트 또는 배포 전략을 바꿀 때
- 앱 간 계약 관리 방식을 바꿀 때
