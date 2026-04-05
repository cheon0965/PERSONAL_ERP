# 현재 정합성 개선 패치 실행계획

## 목적

이 문서는 현재 `PERSONAL_ERP` 저장소 전반을 점검하면서 확인한 정합성 이슈, 문서 드리프트, 검증 공백, 다음 기능 우선순위를 하나의 실행 기준으로 묶기 위한 문서다.

핵심은 아래 세 가지를 현재 기준으로 고정하는 것이다.

- 무엇이 현재 구현과 어긋나 있는가
- 어떤 순서로 실제 개선 패치를 적용할 것인가
- 각 단계가 끝났다고 판단하는 완료 기준은 무엇인가

도메인 정책 자체의 상위 기준은 계속 `docs/domain/business-logic-draft.md`, `docs/domain/core-entity-definition.md`를 우선한다. 이 문서는 현재 저장소 운영과 패치 실행 순서를 정리하는 실무 기준 문서다.

## 이번 점검 범위

- 루트 문서: `README.md`, `docs/README.md`, `docs/PROJECT_PLAN.md`, `docs/VALIDATION_NOTES.md`
- 구현 경계: `apps/api`, `apps/web`, `packages/contracts`
- 테스트와 운영 스크립트: `package.json`, workspace `package.json`, `scripts/`, `.github/workflows/ci.yml`
- 현재 라우트/엔드포인트/문서 링크 정합성

이번 점검에서 실행한 대표 검증은 아래와 같다.

- `npm run check:quick`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e:smoke:build`
- `npm run test:prisma`

## 현재 상태 요약

현재 저장소는 구조 경계 자체는 비교적 잘 유지되고 있다.

- `apps/api`, `apps/web`, `packages/contracts`, `docs`의 역할 분리가 명확하다.
- API 모듈 목록과 Web navigation, 주요 문서 설명은 대체로 현재 구현과 맞는다.
- `lint`, `typecheck`, `test`, `build`, `test:e2e:smoke:build`는 현재 기준으로 통과한다.
- `git status --short` 기준으로 작업 트리는 비어 있었다.
- 루트와 `docs/` 문서에서 참조하는 로컬 링크는 현재 기준으로 깨져 있지 않았다.

다만 “전반 구조는 안정적”이라는 판단과 별개로, 지금 바로 손봐야 하는 실무 이슈도 명확하다.

## 확정 이슈 목록

### 1. `check:quick`가 포맷 드리프트로 즉시 실패한다

가장 우선해서 복구해야 할 기준선이다.

- 현재 `package.json`의 `check:quick`는 `format:check -> lint -> typecheck` 순서다.
- 실제 실행 결과, `format:check` 단계에서 13개 파일이 포맷 드리프트로 걸리며 이후 단계로 진행되지 못한다.
- 별도로 실행한 `lint`, `typecheck`, `test`, `build`는 통과했기 때문에 지금의 핵심 문제는 “기능 실패”보다 “기본 품질 게이트가 빨간 상태”라는 점이다.

현재 포맷 드리프트가 확인된 파일:

- `packages/contracts/src/accounting.ts`
- `apps/api/test/accounting-periods.request-api.test.ts`
- `apps/api/test/financial-reporting.request-api.test.ts`
- `apps/api/test/prisma-integration.test-support.ts`
- `apps/api/test/reference-data.request-api.test.ts`
- `apps/api/test/request-api.test-prisma-mock-accounting-periods.ts`
- `apps/api/test/request-api.test-state.ts`
- `apps/api/test/workflow.prisma.integration.test.ts`
- `README.md`
- `docs/ACCOUNTING_MODEL_BOUNDARY.md`
- `docs/README.md`
- `docs/VALIDATION_NOTES.md`
- `scripts/run-api-prisma-integration.cjs`

### 2. 현재 기준 문서에 `/design-system` 페이지가 존재하는 것처럼 적혀 있다

문서가 구현보다 앞서 있다.

- `docs/DESIGN_SYSTEM.md`는 디자인 검증 전용 샘플이 `/design-system` 페이지에 있다고 설명한다.
- `docs/PROJECT_PLAN.md`도 MVP 범위에 디자인 시스템 샘플 페이지를 포함한 것처럼 읽힌다.
- 하지만 실제 현재 라우트와 최근 build output 기준으로 `/design-system`은 존재하지 않는다.

즉, 현재 기준에서는 아래 둘 중 하나가 필요하다.

- 문서를 현재 구현에 맞게 수정한다.
- 또는 실제 `/design-system` 페이지를 복구한다.

현 시점 권장안은 “문서 진실성 우선”이다. 즉, 먼저 현재 기준 문서에서 존재 표현을 정리하고, 필요하면 별도 UX 작업으로 페이지를 다시 도입한다.

### 3. `test:e2e:smoke:build:browser` 문서 설명과 실제 명령 노출 위치가 어긋나 있다

문서-스크립트 정합성 이슈다.

- `docs/VALIDATION_NOTES.md`는 `npm run test:e2e:smoke:build:browser`를 일반 검증 명령처럼 설명한다.
- 실제 스크립트는 `apps/web/package.json`에만 있고, 루트 `package.json`에는 같은 이름의 래퍼 스크립트가 없다.
- 현재 루트에서 공식적으로 바로 실행 가능한 것은 `npm run test:e2e:smoke:build`까지다.

권장안은 아래 둘 중 하나다.

- 루트 `package.json`에 `test:e2e:smoke:build:browser` 래퍼를 추가한다.
- 또는 문서를 workspace 기준 명령으로 명확히 바꾼다.

현재는 온보딩과 문서 일관성을 위해 루트 래퍼를 추가하는 쪽이 더 낫다.

### 4. `test:prisma` 환경이 아직 “고정된 심화 검증” 상태가 아니다

현재 검증 체계의 남은 공백이다.

- `npm run test:prisma` 자체는 실행되지만, 이번 환경에서는 `DATABASE_URL` 미도달로 3개 시나리오가 모두 skip되었다.
- 문서도 이미 이 공백을 인정하고 있지만, 여전히 “대표 심화 검증”이 환경 의존적이다.
- 즉, 현재 저장소는 기본 테스트는 안정적이지만 실DB 경계 검증은 환경 준비가 되어야만 의미가 생긴다.

여기서는 단순히 문서만 고치는 것이 아니라, “어떤 env를 주면 실제로 반드시 돈다”는 재현 가능한 기준을 추가로 고정해야 한다.

### 5. 보험/차량 도메인 1차 쓰기 흐름은 닫혔고, 남은 공백은 차량 세부 운영 모델이다

이 항목은 이번 정합성 개선 패치에서 실질적으로 해소된 제품 공백이다.

- 2026-04-05 기준 보험 도메인은 `POST /insurance-policies`, `PATCH /insurance-policies/:id`, Web `/insurances` 생성/수정 흐름까지 반영 완료 상태다.
- 같은 날 차량 도메인도 `POST /vehicles`, `PATCH /vehicles/:id`, Web `/vehicles` 생성/수정 흐름까지 반영해 읽기 전용 상태를 벗어났다.
- 같은 날 차량 정비 이력도 `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`, Web `/vehicles` 정비 기록 생성/수정 흐름까지 반영해 별도 운영 기록 모델의 첫 단계를 닫았다.
- 현재 남은 범위는 차량 연료 이력 read/write 분리와 `/vehicles` 응답 슬림화 같은 구조 분리 단계다.

즉, 이 축의 남은 제품 공백은 “보험/차량 기본 관리 부재”가 아니라 “차량 세부 운영 이력 모델을 언제 어떻게 분리할 것인가”로 축소됐다.

### 6. 문서와 스크립트 드리프트를 자동으로 잡는 장치가 약하다

현재는 사람의 주의에 많이 기대고 있다.

- 문서가 존재하지 않는 라우트를 설명해도 바로 막히지 않는다.
- 문서가 루트에 없는 `npm run` 명령을 적어도 CI가 즉시 잡아주지 않는다.
- Swagger/API 문서/문서 인덱스의 동기화도 원칙은 있으나 자동화는 제한적이다.

이 항목은 즉시 기능 장애는 아니지만, 같은 종류의 드리프트가 다시 반복될 가능성을 높인다.

### 7. `audit-runtime`의 잔여 `high` 취약점 대응 또는 예외 판단이 아직 남아 있다

이번 세션에서는 네트워크 기반 재검증을 하지 않았지만, 기존 계획 문서에 남아 있는 중기 보안 과제다.

- 현재 CI gate는 `critical` 기준 실패 판정에 맞춰져 있다.
- 문서에는 Nest 전이 의존성 기준 `high` 취약점 4건이 별도 대응 또는 예외 판단 대상으로 남아 있다고 기록돼 있다.

즉, 이 항목은 “당장 로컬 개발 루프를 막는 문제”는 아니지만, 배포 신뢰성과 감사 설명력을 위해 결국 정리해야 한다.

### 8. Web build 시 Next.js ESLint plugin 감지 경고가 남는다

현재 빌드 자체는 통과하지만, 품질 경고를 완전히 설명 가능한 상태로 만들 필요가 있다.

- `eslint.config.mjs`는 `next/core-web-vitals`를 flat config 방식으로 가져오고 있다.
- 그럼에도 `next build` 중 `The Next.js plugin was not detected in your ESLint configuration` 경고가 출력된다.

이 항목은 실제 lint 실패는 아니므로 우선순위는 높지 않다. 다만 “의도된 flat config 한계”인지, “실제로 Next 권장 설정이 완전히 먹지 않는 상태”인지 한 번은 판단하고 기록해야 한다.

### 9. 레거시 `Transaction`은 아직 물리 테이블과 브리지 코드로 남아 있다

이 항목은 구조 부채로 보는 피드백이 충분히 합리적이다.

- 현재 공식 회계 흐름의 기준선은 이미 `CollectedTransaction -> JournalEntry / JournalLine -> ClosingSnapshot -> FinancialStatementSnapshot -> CarryForwardRecord`다.
- 그런데 DB에는 여전히 `Transaction` 물리 테이블이 남아 있고, pre-phase1 데이터 정합성을 위한 backfill 유틸이 이 경계를 직접 다룬다.
- 따라서 “런타임 핵심 모델은 아니지만, 완전히 제거된 것도 아니다”가 가장 정확한 현재 상태다.

다만 지금 바로 할 수 있는 개선은 분명하다.

- Prisma schema 표면에서 이 테이블을 `LegacyTransaction`으로 명시해 신규 모델과 혼동되지 않게 한다.
- 새 demo seed가 더 이상 레거시 `Transaction` rows를 만들지 않게 한다.
- 레거시 Prisma delegate 사용이 허용된 브리지 파일 밖으로 퍼지지 않도록 테스트 가드레일을 둔다.

즉, 이 항목의 단기 목표는 “즉시 제거”가 아니라 “레거시임을 코드에서 더 선명하게 드러내고, 새 사용을 끊고, 남은 직접 접점을 backfill 경계로 좁히는 것”이다.

## 우선순위 원칙

이번 개선 패치는 아래 순서로 진행한다.

1. 기본 품질 게이트를 다시 초록으로 돌리는 작업
2. 현재 상태를 설명하는 문서와 실제 명령/라우트의 불일치 제거
3. 심화 검증 재현성과 운영 설명력 보강
4. 실제 제품 기능 공백 해소
5. 반복 드리프트 방지 자동화와 보안 후속 정리

즉, 단기 안정화와 중기 제품 확장을 한 문서에 담되, 실제 패치 적용은 “기준선 복구 -> 문서 진실성 -> 검증 강화 -> 기능 확장” 순서로 가져간다.

## 권장 PR 분할

### PR-1. Baseline Restore

목표:

- `check:quick`를 다시 통과시키는 것

작업 범위:

- 포맷 드리프트 13개 파일 정리
- `npm run check:quick` 재검증

완료 기준:

- `npm run check:quick` 통과
- 기능 변경 없이 포맷과 문서 표기만 달라진 상태

주의:

- 이 PR에서는 기능 추가나 문서 정책 변경을 섞지 않는다.
- diff를 최대한 기계적 정리로 유지한다.

### PR-2. Docs And Command Alignment

목표:

- 현재 상태를 설명하는 문서가 실제 구현과 명령 구조와 맞도록 정리

작업 범위:

- `/design-system` 관련 현재 상태 표현 정리
- 루트 `package.json`에 `test:e2e:smoke:build:browser` 래퍼 추가 여부 반영
- `README.md`, `docs/README.md`, `docs/DESIGN_SYSTEM.md`, `docs/PROJECT_PLAN.md`, `docs/VALIDATION_NOTES.md` 정합성 정리

권장 결정:

- `/design-system`은 당장 페이지 복구보다 문서 진실성 복구를 우선한다.
- `test:e2e:smoke:build:browser`는 루트 래퍼를 추가해 문서와 사용자 경험을 단순화한다.

완료 기준:

- 문서에 적힌 현재 상태 라우트가 실제 build output과 어긋나지 않는다.
- 문서에 적힌 `npm run` 명령이 실제 저장소 기준으로 실행 가능하다.
- 문서 인덱스와 README 링크가 최신 상태를 가리킨다.

### PR-3. Prisma Integration Hardening

목표:

- `test:prisma`를 “환경이 되면 반드시 재현 가능한 심화 검증”으로 고정

작업 범위:

- `scripts/run-api-prisma-integration.cjs`의 env 탐색과 실패 메시지 정리
- 실DB 테스트용 env 준비 규칙 명시
- 필요하면 테스트 전용 DB 연결 키 또는 별도 env 파일 규칙 도입
- `docs/VALIDATION_NOTES.md`, `ENVIRONMENT_SETUP.md`, `docs/DEVELOPMENT_GUIDE.md` 반영

권장 구현 방향:

- 운영/개발 기본 `DATABASE_URL`과 별도로, 실DB 대표 검증용 연결 대상을 명시적으로 분리하는 쪽을 우선 검토한다.
- 현재 구현은 `PRISMA_INTEGRATION_DATABASE_URL` 우선, `DATABASE_URL` fallback 규칙으로 고정하는 방향을 기준으로 진행한다.
- 테스트 DB가 준비되지 않은 경우에는 “무엇이 없어서 skip인지”를 지금보다 더 분명히 드러낸다.
- 테스트 DB가 준비된 경우에는 `npm run test:prisma`가 실제 시나리오를 끝까지 수행하도록 고정한다.

완료 기준:

- 준비된 환경에서 `npm run test:prisma`가 skip이 아니라 실제 통합 시나리오를 수행한다.
- 준비되지 않은 환경에서는 skip 이유와 설정 방법이 문서/출력에 명확히 나타난다.

현재 상태 메모:

- 2026-04-05 기준 `PRISMA_INTEGRATION_DATABASE_URL` 우선, 로컬 `DATABASE_URL` fallback, CI 전용 secret 강제 규칙까지 코드로 반영 완료
- 같은 날 `.github/workflows/ci.yml`에 `prisma-integration` job을 추가했고, `secrets.PRISMA_INTEGRATION_DATABASE_URL`를 읽어 실제 MySQL 경계 검증을 수행하도록 연결 완료
- 저장소 코드와 workflow wiring은 끝났지만, 실제 GitHub 저장소/조직 secret 값 등록과 첫 통과 증적 확보는 저장소 밖 후속 작업으로 남아 있다

### PR-4. Insurance Write Flow Phase 1

목표:

- 보험 도메인에 최소 쓰기 흐름을 도입

현재 상태 메모:

- 2026-04-05 기준 `POST /insurance-policies`, `PATCH /insurance-policies/:id`, Web `/insurances` 생성/수정 폼, 요청 단위 API 테스트, 브라우저 상호작용 테스트까지 반영 완료

권장 범위:

- `POST /insurance-policies`
- `PATCH /insurance-policies/:id`
- 생성/수정 폼과 목록 갱신
- 요청 단위 API 테스트와 Web 상호작용 테스트 추가

권장 이유:

- 보험 도메인이 차량보다 구조가 단순해 Phase 1 쓰기 흐름의 첫 대상으로 적합하다.

완료 기준:

- contracts, API, Web, 테스트, 문서가 같은 PR에서 맞춰진다.
- 읽기 전용 보조 화면이 아니라 제한적 관리 화면으로 승격된다.

### PR-5. Vehicles Write Flow Phase 1

목표:

- 차량 도메인에 최소 쓰기 흐름을 도입

현재 상태 메모:

- 2026-04-05 기준 `POST /vehicles`, `PATCH /vehicles/:id`, Web `/vehicles` 생성/수정 폼, 요청 단위 API 테스트, 브라우저 상호작용 테스트까지 반영 완료

권장 범위:

- 차량 기본 정보 생성/수정
- 필요 시 연료 이력은 별도 하위 단계로 분리
- 복잡한 정비 이력/세부 운영 모델은 1차 범위에서 제외

권장 이유:

- 차량은 보험보다 필드와 확장 방향이 더 많아 한 PR에 너무 많은 범위를 싣기 쉽다.
- 따라서 차량 기본 정보 CRUD와 연료 이력 세부 모델은 분리하는 것이 안정적이다.

완료 기준:

- 차량 기본 정보 쓰기 흐름이 contracts, API, Web, 테스트, 문서와 함께 닫힌다.
- 차트/표가 더미 조회 화면이 아니라 실제 관리 흐름과 연결된다.

### PR-6. Drift Guard Automation

목표:

- 같은 종류의 문서/스크립트 드리프트가 다시 생기지 않도록 자동 점검 추가

현재 상태 메모:

- 2026-04-05 기준 `scripts/check-doc-npm-run-commands.cjs`를 추가했고, 루트 `npm run docs:check:npm-run`으로 단독 실행할 수 있도록 연결 완료
- 같은 날 `npm run check:quick`에 이 검사를 포함시켜 문서에 적힌 `npm run` 명령이 루트/workspace 스크립트와 어긋나면 로컬/CI에서 바로 실패하도록 반영 완료
- 2026-04-05 기준 `scripts/check-doc-surface-drift.cjs`를 추가했고, 루트 `npm run docs:check:surface`로 `docs/API.md`, `docs/VALIDATION_NOTES.md`의 Web/API surface를 실제 `apps/web/app` 라우트와 controller 기반 Swagger surface에 대조하도록 연결 완료
- 같은 날 `npm run docs:check`를 도입해 위 두 문서 정합성 검사를 한 번에 실행하고, `npm run check:quick`에도 포함시켜 문서·Swagger·라우트 드리프트가 로컬/CI에서 바로 실패하도록 반영 완료

작업 범위:

- 문서에 적힌 `npm run <script>`가 실제 루트 또는 workspace 스크립트에 존재하는지 검사하는 스크립트 도입
- 문서 동기화 체크리스트를 `docs/DEVELOPMENT_GUIDE.md` 또는 별도 보조 스크립트와 연결
- 필요하면 `check:quick` 또는 별도 CI step에 연결

권장 최소 범위:

- 우선 `README.md`와 `docs/*.md`에 적힌 `npm run` 명령 존재 여부 검사부터 시작한다.
- Web 라우트와 controller 기반 Swagger surface 대조까지 자동화하고, 더 넓은 자연어 수준 문장 검증은 이후 단계에서 검토한다.

완료 기준:

- 문서에 존재하지 않는 스크립트명을 적었을 때 CI 또는 로컬 검증이 실패한다.
- `docs/API.md`, `docs/VALIDATION_NOTES.md`에 적힌 Web/API surface가 실제 라우트와 Swagger surface와 어긋나면 CI 또는 로컬 검증이 실패한다.

### PR-7. Runtime Security Follow-up

목표:

- `audit-runtime` 잔여 `high` 취약점의 상태를 정리

현재 상태 메모:

- 2026-04-05 기준 runtime audit를 재실행했고 결과는 `critical 0`, `high 4`
- 남은 4건은 최신 `@nestjs/config 4.0.3`, `@nestjs/swagger 11.2.6`이 내부에서 `lodash 4.17.23`, `path-to-regexp 8.3.0`을 exact dependency로 유지하는 데서 왔다
- 로컬 override 재적용과 재설치를 시도했지만 실제 설치 트리는 변하지 않았고, 이번 라운드의 결론은 “즉시 해결 불가, tracked exception으로 문서화”다
- `npm run audit:runtime`는 `critical` gate를 유지하고, 상세 재검토는 `npm run audit:runtime:full`로 수행하도록 정리했다

작업 범위:

- `npm run audit:runtime` 재실행
- 각 advisory를 업그레이드, override, 예외 문서화 중 하나로 분류
- 필요 시 `docs/VALIDATION_NOTES.md`, `docs/ASVS_L2_EXECUTION_PLAN.md`, `docs/ASVS_L2_BASELINE_MATRIX.md` 동기화

완료 기준:

- 잔여 `high` 취약점이 “미확인 상태”로 남지 않는다.
- 대응 완료 또는 예외 판단 근거가 문서로 남는다.

## 실행 순서 요약

### 즉시 착수 순서

1. PR-1 `Baseline Restore`
2. PR-2 `Docs And Command Alignment`
3. PR-3 `Prisma Integration Hardening`

### 그 다음 기능 확장 순서

4. 차량 연료 이력 read/write 분리와 `/vehicles` 응답 슬림화

### 반복 회귀 방지와 운영 후속

5. `PRISMA_INTEGRATION_DATABASE_URL` GitHub secret 등록과 첫 `prisma-integration` 통과 증적 확보
6. Docker 기반 로컬 CI 재현성 보강
7. 운영 HTTPS/HSTS/Swagger 배포 리허설과 보안 증적 정리

## 각 단계 공통 완료 기준

모든 단계는 아래 조건을 기본 공통 완료 기준으로 삼는다.

- 관련 contracts, API, Web, 테스트, 문서가 같은 변경 안에서 맞춰진다.
- `README.md`, `docs/README.md`, 관련 상세 문서의 설명이 서로 충돌하지 않는다.
- 기본 검증은 최소 `npm run check:quick`, `npm run test`를 다시 통과한다.
- build나 브라우저 smoke에 영향이 있는 변경이면 `npm run build`, `npm run test:e2e:smoke:build`까지 다시 확인한다.

## 이번 문서 기준 권장 결정 사항

현재 바로 결정해 두는 편이 좋은 항목은 아래와 같다.

- `/design-system`은 우선 문서에서 현재 상태 표현을 정리하고, 실제 페이지 복구는 별도 UX 작업으로 분리한다.
- `test:e2e:smoke:build:browser`는 루트 래퍼 스크립트를 추가해 문서와 명령 진입점을 단순화한다.
- `test:prisma`는 장기적으로 “전용 테스트 DB 기준”을 명시하는 방향으로 굳히고, CI에서는 `PRISMA_INTEGRATION_DATABASE_URL` 전용으로만 실행한다.
- 보험/차량 쓰기 흐름은 보험 1차 -> 차량 1차 순으로 분리 적용했고, 차량 세부 운영 모델 분리 기준은 `docs/VEHICLE_OPERATIONS_MODEL_PLAN.md`에 고정한 뒤 연료 이력 분리 -> 정비 이력 1차 순으로 확장한다.

## 한 줄 결론

현재 저장소는 구조적으로는 안정적이지만, 실제 패치 우선순위는 `기본 게이트 복구 -> 문서와 명령 정합성 복구 -> Prisma 검증 고정 -> 보험/차량 쓰기 확장 -> 드리프트 자동화 -> 보안 후속 정리` 순서로 가져가는 것이 가장 안전하다.
