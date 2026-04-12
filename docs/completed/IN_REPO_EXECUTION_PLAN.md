# 저장소 내부 후속 작업 실행계획

> 보관 상태: `2026-04-12` 기준 저장소 내부 후속 작업을 모두 완료한 뒤 `docs/completed/`로 이동했다. 현재 운영 기준은 `docs/API.md`, `docs/VALIDATION_NOTES.md`, `docs/ACCOUNTING_MODEL_BOUNDARY.md`, `docs/DEVELOPMENT_GUIDE.md`를 우선한다.

## 목적

이 문서는 `PERSONAL_ERP`에서 **저장소 안에서 바로 실행 가능한 후속 작업만** 따로 묶어 관리하기 위한 실행계획이다.

2026-04-12 기준으로 이 문서에서 선별한 저장소 내부 후속 작업은 모두 완료 상태다.
즉, 현재는 "다음 저장소 내부 우선순위"를 정하는 문서라기보다, 완료 기준과 검증 범위를 기록하는 기준 문서에 가깝다.

여기서 말하는 "저장소 내부 작업"은 아래 조건을 모두 만족하는 변경만 뜻한다.

- `apps/`, `packages/`, `docs/`, `scripts/`, `.github/workflows/` 안의 코드/문서/테스트 수정으로 끝낼 수 있다.
- GitHub 저장소 설정, 운영 인프라, 외부 secret 등록, 실제 배포 환경 접근이 없어도 실행 순서를 설계할 수 있다.
- 완료 여부를 현재 저장소의 테스트와 검증 명령으로 판단할 수 있다.

반대로 아래 항목은 이 문서 범위에서 제외한다.

- GitHub secret `PRISMA_INTEGRATION_DATABASE_URL` 등록과 첫 성공 증적 확보
- 실제 운영 HTTPS/HSTS/Swagger 배포 리허설과 운영 증적 정리
- GitHub branch protection, required check, 조직/저장소 보안 설정 조정

## 선별 기준

아래 문서와 현재 코드 표면을 비교해, "문서상 남아 있는 일"이면서 실제 저장소 안에서도 아직 끝나지 않은 항목만 추렸다.

- `docs/PROJECT_PLAN.md`
- `docs/VALIDATION_NOTES.md`
- `docs/ACCOUNTING_MODEL_BOUNDARY.md`
- `docs/completed/VEHICLE_OPERATIONS_MODEL_PLAN.md`
- `docs/SCREEN_FLOW_GUIDE.md`
- `docs/completed/ALIGNMENT_PATCH_EXECUTION_PLAN.md`

## 현재 판단 요약

이번 실행계획에서 선별했던 내부 후속 작업은 아래 다섯 가지였다.

1. 차량 운영 요약 모델을 실제 projection/read model로 마무리한다.
2. 레거시 `Transaction` 물리 제거를 문서/테스트/스키마 관점에서 완료한다.
3. 메인 월 운영 루프를 브라우저 E2E에서 실제 상호작용까지 더 넓게 덮는다.
4. 로컬에서 CI 흐름을 더 비슷하게 재현할 수 있도록 스크립트와 문서를 보강한다.
5. Next.js ESLint plugin 감지 경고를 제거하고 설정 기준을 문서화한다.

## 우선순위 개요

| 우선순위 | 작업                                | 현재 상태 | 비고                                                                              |
| -------- | ----------------------------------- | --------- | --------------------------------------------------------------------------------- |
| P1       | 차량 운영 요약 모델 마무리          | 완료      | summary/read model과 물리/응답 표면 정리까지 반영됨                               |
| P1       | 레거시 `Transaction` 물리 제거      | 완료      | schema relation 제거, migration 추가, active reference guard와 문서 동기화 완료   |
| P1       | 메인 월 운영 루프 브라우저 E2E 보강 | 완료      | 계획 생성, 업로드 승격, 전표 확정, 재무제표, 차기 이월까지 분리된 spec으로 검증됨 |
| P2       | 로컬 CI 재현성 보강                 | 완료      | `ci:local:*` 스크립트와 Docker scan wrapper, 문서 매핑표 추가됨                   |
| P3       | Next.js ESLint plugin 경고 정리     | 완료      | flat config에서 `@next/next` 직접 등록과 `rootDir` 고정으로 build 경고 제거       |

## 1. 차량 운영 요약 모델 마무리 [P1]

### 왜 지금 필요한가

- `docs/completed/VEHICLE_OPERATIONS_MODEL_PLAN.md`는 연료/정비 이력 분리 이후 남은 핵심 과제를 `VehicleOperatingSummary` read model 정리로 봤다.
- `docs/VALIDATION_NOTES.md` 기준으로도 이 항목은 차량 운영 요약 projection, write 계약, 물리 필드 정리까지 반영된 상태다.
- 현재 구현은 `Vehicle` 기본 프로필과 운영 요약 read model을 분리했고, `monthlyExpenseWon`은 더 이상 활성 코드 표면에 남지 않는다.

### 목표

- 차량 기본 프로필 write model과 운영 요약 read model을 분리한다.
- `monthlyExpenseWon`을 "차량 마스터 입력값"이 아니라 "운영 요약 전환 대상"으로 다루는 현재 방침을 실제 코드 구조에 반영한다.
- Web 화면의 합계/차트/보조 지표가 raw vehicle 필드가 아니라 summary projection을 기준으로 읽히게 만든다.

### 실행 단계

1. `packages/contracts`에 차량 운영 요약 전용 계약을 추가하거나 기존 차량 계약에서 summary 성격을 분리한다.
2. API에 차량 운영 요약 read model 또는 projection 조립 경계를 추가한다.
3. Web의 차량 화면 카드/차트/보조 문구가 summary 데이터에 의존하도록 옮긴다.
4. `monthlyExpenseWon`을 DTO, form, mapper, Prisma schema, seed, mock, 테스트에서 제거하고 summary projection 기준으로 회귀를 닫는다.
5. 문서(`docs/completed/VEHICLE_OPERATIONS_MODEL_PLAN.md`, `docs/VALIDATION_NOTES.md`, 필요 시 `docs/API.md`)를 새 구조에 맞게 동기화한다.

### 완료 기준

- 차량 운영 요약이 별도 read 경계로 설명 가능하다.
- Web의 운영 요약 표시가 `Vehicle` raw 필드에 직접 묶여 있지 않다.
- `monthlyExpenseWon`이 `Vehicle` 기본 모델/응답/스키마에 남지 않고, 운영 요약은 별도 projection으로 설명 가능하다.
- 관련 request/API/E2E 테스트가 새 read model 기준으로 통과한다.

### 검증

- `npm run check:quick`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

## 2. 레거시 `Transaction` 물리 제거 [P1]

### 왜 지금 필요한가

- `docs/ACCOUNTING_MODEL_BOUNDARY.md`는 신규 회계 흐름이 이미 공식 기준이고, 남은 저장소 내부 작업으로는 구형 `Transaction` 물리 제거가 핵심이라고 봤다.
- 당시 런타임에서 직접 read/write 경로는 이미 막혀 있었고, 남은 작업은 Prisma schema, migration, seed/test, 경계 문서를 같은 변경으로 맞추는 일이었다.

현재 상태 메모:

- 구형 `Transaction` 모델과 relation, 관련 enum은 활성 Prisma schema에서 제거했다.
- `apps/api/prisma/phase1-backbone.ts`는 더 이상 구형 거래 delegate를 사용하지 않는다.
- `apps/api/test/legacy-transaction-boundary.test.ts`는 active runtime/doc surface에 구형 거래 직접 참조가 다시 생기지 않도록 잠근다.

### 목표

- 구형 `Transaction`을 active schema와 테스트 기본 흐름에서 실제로 제거한다.
- 제거 후에도 신규 회계 흐름 경계가 문서와 테스트에서 더 분명해지게 만든다.
- 회귀 시 다시 구형 거래 표면이 커지지 않도록 guard를 남긴다.

### 실행 단계

1. schema와 relation, 남은 enum, test mock state에서 구형 거래 표면을 걷어낸다.
2. `phase1-backbone`, seed, 경계 테스트를 제거 이후 구조에 맞게 조정한다.
3. Prisma migration을 추가해 실제 schema 변경을 커밋한다.
4. active 문서는 제거 완료 상태와 guard 기준으로 다시 쓴다.
5. 과거 준비 메모와 체크리스트는 `docs/completed/`로 이동해 이력으로만 보관한다.

### 완료 기준

- `apps/api/src`, `apps/web/src`, `packages/contracts` 기준 런타임 direct dependency가 계속 0이다.
- 활성 Prisma schema에서 구형 `Transaction` 표면이 제거돼 있다.
- seed/test/docs가 신규 회계 흐름을 기본값으로 유지한다.
- 과거 준비 문서는 `docs/completed/`에만 남고, active 문서는 제거 완료 상태를 설명한다.

### 검증

- `npm run check:quick`
- `npm run test`
- `npm run test:prisma`

## 3. 메인 월 운영 루프 브라우저 E2E 보강 [P1]

### 왜 지금 필요한가

- `docs/SCREEN_FLOW_GUIDE.md`의 중심 흐름은 `계획 항목 -> 업로드 배치 -> 수집 거래 -> 전표 -> 마감 -> 재무제표 -> 차기 이월`이다.
- 현재 브라우저 테스트는 로그인, 거래, 기준 데이터, 보험, 차량, 업로드 일부를 잘 덮고 있고, `plan-items`, `forecast`, `financial-statements`, `carry-forwards`, `imports -> collected-transactions -> journal-entries`의 핵심 월 운영 흐름도 전용 spec으로 보강됐다.

### 목표

- 문서가 설명하는 메인 월 운영 루프를 브라우저 상호작용 기준으로 더 분명히 자동 검증한다.
- 현재 큰 E2E spec을 도메인별로 나누면서도 핵심 cross-feature 시나리오는 유지한다.
- 화면 간 링크만 확인하는 수준을 넘어 실제 generate/action 이후 상태 반영까지 확인한다.

### 실행 단계

1. `plan-items` 생성과 결과 반영을 검증하는 브라우저 시나리오를 추가한다. 완료: `monthly-operations-loop.spec.ts`에서 생성 후 dashboard/forecast 반영까지 검증함.
2. `imports`에서 승격된 결과가 `transactions`/`journal-entries`와 이어지는 흐름을 강화한다. 완료: `imports-and-collect.spec.ts`에서 업로드 승격 후 전표 확정과 생성 전표 화면 진입까지 검증함.
3. `financial-statements`, `carry-forwards`는 단순 진입 검증이 아니라 generate 이후 상태 반영까지 확인한다. 완료: 잠금 월 기준 generate 후 공식 스냅샷/이월 결과와 forecast basis note까지 검증함.
4. `forecast`와 `dashboard`는 현재 period 문맥과 basis 상태가 화면에 반영되는지 확인한다. 완료: 현재 운영 월 문맥, 계획 반영 문구, 차기 이월 basis note를 브라우저에서 확인함.
5. 현재 E2E helper/fixture 구조를 유지하되 spec 책임을 더 작게 나눈다. 완료: giant spec 바깥으로 `monthly-operations-loop.spec.ts`, `imports-and-collect.spec.ts`가 월 운영 핵심 책임을 나눠 가짐.

### 완료 기준

- 메인 운영 루프의 핵심 단계가 브라우저 시나리오로 설명 가능하다.
- 내비게이션 smoke와 실제 사용자 행위 회귀가 구분되어 있다.
- 도메인별 E2E 실패 시 어느 흐름이 깨졌는지 바로 알 수 있다.

### 검증

- `npm run test:e2e`
- `npm run test:e2e:smoke:build`
- `npm run test`

## 4. 로컬 CI 재현성 보강 [P2]

### 왜 지금 필요한가

- 현재 `.github/workflows/ci.yml`에는 `validate`, `e2e-smoke`, `security-regression`, `prisma-integration`, `audit-runtime`, `semgrep-ce`, `gitleaks`가 정리되어 있다.
- 현재는 루트 `ci:local:*` 스크립트와 `docs/DEVELOPMENT_GUIDE.md`의 매핑표로 같은 흐름을 로컬에서도 다시 밟을 수 있다.

### 목표

- 현재 저장소 명령만으로 "로컬에서 CI에 최대한 가깝게 재현하는 방법"을 분명히 만든다.
- DB/Docker가 필요한 단계와 선택적 단계를 구분한다.
- 문서와 스크립트가 같은 흐름을 가리키도록 맞춘다.

### 실행 단계

1. 현재 CI job과 로컬 명령 매핑표를 문서에 명시한다. 완료: `docs/DEVELOPMENT_GUIDE.md`에 GitHub job -> `ci:local:*` 대응표를 추가함.
2. 루트 스크립트 또는 보조 스크립트에서 반복 실행 순서를 감싸는 얇은 진입점을 추가한다. 완료: `ci:local:validate`, `ci:local:core`, `ci:local:all`과 Docker scan wrapper를 추가함.
3. Docker/MySQL 선행조건, `npm run db:up`, `npm run db:down`, `npm run test:prisma` 사용 순서를 정리한다. 완료: DB/Docker 선행조건과 권장 순서를 개발 문서에 반영함.
4. browser smoke, API security, Prisma integration, runtime audit의 로컬 재현 조건을 문서화한다. 완료: 각 job의 로컬 실행 명령과 제약을 문서화함.

### 완료 기준

- 새 팀원이 GitHub Actions 화면이 아니라 저장소 문서만 보고도 로컬 검증 흐름을 따라갈 수 있다.
- CI 단계와 로컬 실행 순서의 대응 관계가 분명하다.
- 반복 실행 시 사람이 직접 순서를 조립해야 하는 부담이 줄어든다.

### 검증

- `npm run check`
- `npm run test:e2e:smoke:build`
- `npm run test:security:api`
- `npm run test:prisma`

## 5. Next.js ESLint Plugin 경고 정리 [P3]

### 왜 지금 필요한가

- build는 통과했지만 Next.js ESLint plugin 감지 경고가 남아 있었다.
- 경고를 그냥 두면 "무시 가능한 경고"인지 "구성 누락"인지 팀 내 공통 판단이 서지 않았다.

### 목표

- 경고 원인을 코드/설정 기준으로 확정한다.
- root flat config에서 Web workspace가 Next plugin을 명시적으로 인지하도록 맞춘다.
- 이후 Web lint 규칙 변경 시 유지해야 할 설정 기준을 문서에 남긴다.

### 실행 단계

1. Web workspace ESLint/Next 설정과 build 경로를 비교해 경고 원인을 재현한다.
2. `eslint.config.mjs` flat config에서 `@next/next` plugin과 `settings.next.rootDir`를 직접 등록한다.
3. 경고 처리 결과와 유지 규칙을 `docs/DEVELOPMENT_GUIDE.md`에 반영한다.

### 완료 기준

- `npm run build` 결과에서 Next.js ESLint plugin 감지 경고가 사라진다.
- 이후 동일 경고가 다시 나와도 판단 기준이 문서로 남아 있다.

### 검증

- `npm run build`
- `npm run check:quick`

## 권장 실행 순서

1. 차량 운영 요약 모델 마무리
2. 레거시 `Transaction` 물리 제거
3. 메인 월 운영 루프 브라우저 E2E 보강
4. 로컬 CI 재현성 보강
5. Next.js ESLint plugin 경고 정리

이 순서를 권장하는 이유는 앞의 세 단계가 도메인 경계와 핵심 회귀를 먼저 안정화하고, 뒤의 두 단계가 그 결과를 팀 개발 흐름과 툴링에 고정하는 성격이기 때문이다.

## 단계별 산출물

- Phase 1 완료 후: 차량 도메인 경계 정리, 관련 계약/API/Web/test 동기화
- Phase 2 완료 후: 구형 `Transaction` schema 제거, migration 반영, active reference guard 고정
- Phase 3 완료 후: 메인 월 운영 루프 브라우저 회귀 시나리오 확장
- Phase 4 완료 후: 로컬 CI 재현용 문서/스크립트 정리
- Phase 5 완료 후: Next.js ESLint 경고 처리 기준 고정

## 완료 판단

이 실행계획은 아래 조건을 만족하면 저장소 내부 범위에서 완료로 본다.

1. 차량 운영 요약과 차량 기본 write model의 경계가 코드와 문서에서 함께 설명 가능하다.
2. 레거시 `Transaction` 제거 결과가 문서/테스트/스키마 기준으로 정리되어 있다.
3. 메인 월 운영 루프 핵심 단계가 브라우저 테스트에서 실제 상호작용으로 검증된다.
4. 로컬 개발자가 현재 저장소 문서만으로 CI와 유사한 검증 흐름을 재현할 수 있다.
5. Next.js ESLint plugin 경고가 제거되거나, 남아 있어도 허용 이유가 문서화되어 있다.

현재 상태에서는 위 1~5 조건이 모두 충족됐다.
따라서 이 문서가 처음 선별했던 저장소 내부 후속 작업은 완료로 본다.

## 제외 항목 메모

아래 항목은 중요하지만 이 문서의 실행 범위에는 넣지 않는다.

- `PRISMA_INTEGRATION_DATABASE_URL` GitHub secret 등록과 첫 GitHub `prisma-integration` 성공 증적
- 운영 HTTPS/HSTS/Swagger 실제 배포 값 검증
- GitHub required check, branch protection, 저장소 보안 설정 조정

이 항목들은 저장소 밖 후속 문맥에서 별도로 관리한다.
