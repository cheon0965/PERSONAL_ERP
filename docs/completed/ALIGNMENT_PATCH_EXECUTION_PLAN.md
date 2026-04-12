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

2026-04-05 기준 이 문서에 적었던 저장소 내부 정합성 패치 PR-1부터 PR-7까지는 대부분 반영 완료 상태다.

- `apps/api`, `apps/web`, `packages/contracts`, `docs`의 역할 분리는 현재도 유지되고 있다.
- `npm run check:quick`, `npm run test`, `npm run build`, `npm run test:e2e:smoke:build`는 현재 기준으로 통과한다.
- 차량 연료 이력/정비 이력 분리까지 포함한 보험/차량 쓰기 흐름, 문서 드리프트 자동화, runtime audit 분류까지 문서와 코드에 반영됐다.
- `test:prisma`는 코드와 CI workflow wiring까지 반영됐지만, 실제 GitHub secret 등록과 첫 통과 증적은 저장소 밖 후속으로 남아 있다.

## 진행 현황 한눈에 보기

- `완료`: PR-1 `Baseline Restore`
- `완료`: PR-2 `Docs And Command Alignment`
- `부분 완료`: PR-3 `Prisma Integration Hardening`
  저장소 코드와 CI workflow wiring은 끝났고, GitHub secret 등록과 첫 통과 증적만 남아 있다.
- `완료`: PR-4 `Insurance Write Flow Phase 1`
- `완료`: PR-5 `Vehicles Write Flow Phase 1`
- `완료`: 차량 연료 이력 read/write 분리와 `/vehicles` 응답 슬림화
- `완료`: 차량 정비 이력 Phase 1
- `완료`: PR-6 `Drift Guard Automation`
- `완료`: PR-7 `Runtime Security Follow-up`
- `부분 완료`: LegacyTransaction 경계 정리
  schema 표면과 신규 seed/가드레일은 정리됐지만, 물리 테이블과 backfill 브리지 코드는 남아 있다.
- `미착수`: Next.js ESLint plugin 감지 경고 원인 확정

## 다음 작업

- 2026-04-05 기준 차량 운영 요약 모델 정리와 monthlyExpenseWon 전환 기준 고정까지 반영 완료

- 기준 문서: `docs/completed/VEHICLE_OPERATIONS_MODEL_PLAN.md`
- 목적: 차량 기본 프로필 write model과 운영 요약 read model의 경계를 더 분명히 하고, `monthlyExpenseWon` 같은 보조 지표의 전환 기준을 고정한다.

### 저장소 밖 후속

1. `PRISMA_INTEGRATION_DATABASE_URL` GitHub secret 등록과 첫 `prisma-integration` 통과 증적 확보
2. Docker 기반 로컬 CI 재현성 보강
3. 운영 HTTPS/HSTS/Swagger 배포 리허설과 보안 증적 정리

### 후순위 내부 후속

1. Next.js ESLint plugin 감지 경고 원인 확정과 문서화
2. LegacyTransaction 물리 테이블 제거 가능성 검토

## 정합성 이슈 및 처리 상태

### 1. 기본 품질 게이트 복구 [`완료`]

- `check:quick` 포맷 드리프트를 정리했고, 현재 `npm run check:quick`는 통과 상태다.

### 2. `/design-system` 문서 불일치 정리 [`완료`]

- 문서가 실제 현재 라우트와 맞도록 정리했고, 존재하지 않는 페이지를 현재형으로 설명하지 않도록 맞췄다.

### 3. browser smoke 명령 노출 위치 정리 [`완료`]

- 루트 명령 진입점과 문서 설명을 맞췄다.

### 4. Prisma 통합 검증 재현성 고정 [`부분 완료`]

- `PRISMA_INTEGRATION_DATABASE_URL` 우선 규칙, 로컬 fallback, CI 전용 강제 규칙, workflow job 연결까지 완료했다.
- 실제 secret 등록과 첫 성공 증적은 저장소 밖 후속이다.

### 5. 보험/차량 1차 쓰기 흐름과 차량 연료/정비 운영 이력 분리 [`완료`]

- 보험 생성/수정, 차량 생성/수정, 차량 연료 이력 생성/수정, 차량 정비 이력 생성/수정까지 반영 완료했다.
- 이 축의 다음 제품 작업은 차량 운영 요약 모델 정리다.

### 6. 문서/스크립트/Swagger surface 드리프트 자동화 [`완료`]

- `docs:check:npm-run`, `docs:check:surface`, `docs:check`를 추가했고 `check:quick`에 연결했다.

### 7. runtime audit high 이슈 분류 [`완료(추적 예외 유지)`]

- `critical 0`, `high 4` 상태를 재검토했고, 즉시 해결 불가 항목은 tracked exception으로 문서화했다.

### 8. Next.js ESLint plugin 감지 경고 [`미착수`]

- build는 통과하지만 경고 원인 판단과 기록은 아직 남아 있다.

### 9. LegacyTransaction 구조 부채 축소 [`부분 완료`]

- `LegacyTransaction` 명시화, 신규 seed 차단, 브리지 외 사용 가드까지 반영했다.
- 물리 테이블 제거와 backfill 완전 퇴역은 후속 설계 범위다.

### 10. 차량 운영 요약 모델 정리 [`완료`]

- 연료/정비 이력 분리에 이어 `monthlyExpenseWon` 전환 기준을 고정하고 운영 요약 read model의 경계를 정리했다.
- `Vehicle` 기본 write model에서 `monthlyExpenseWon`은 이제 "전환 예정 필드"로 명시되었고, Web/API 모두 summary projection을 향하도록 맞췄다.

## 권장 PR 분할

### PR-1. Baseline Restore [`완료`]

- 결과: 포맷 드리프트를 정리하고 `npm run check:quick`를 통과 상태로 복구했다.

### PR-2. Docs And Command Alignment [`완료`]

- 결과: `/design-system` 문서 표현과 browser smoke 명령 진입점을 현재 구현과 맞췄다.

### PR-3. Prisma Integration Hardening [`부분 완료`]

- 결과: env 규칙, skip 메시지, CI workflow wiring을 정리했다.
- 남은 일: GitHub secret 등록과 첫 `prisma-integration` 통과 증적 확보.

### PR-4. Insurance Write Flow Phase 1 [`완료`]

- 결과: `POST /insurance-policies`, `PATCH /insurance-policies/:id`, Web 생성/수정 흐름, 테스트, 문서를 반영했다.

### PR-5. Vehicles Write Flow Phase 1 [`완료`]

- 결과: `POST /vehicles`, `PATCH /vehicles/:id`, Web 생성/수정 흐름, 테스트, 문서를 반영했다.

### 차량 정비 이력 Phase 1 [`완료`]

- 결과: `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`, Web 생성/수정 흐름, 테스트, 문서를 반영했다.

### 차량 연료 이력 read/write 분리와 `/vehicles` 응답 슬림화 [`완료`]

- 결과: `VehicleItem.fuelLogs` 결합을 제거했고, `GET /vehicles/fuel-logs`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`, Web 생성/수정 흐름, 테스트, 문서를 반영했다.

### PR-6. Drift Guard Automation [`완료`]

- 결과: 문서의 `npm run` 명령과 Web/API surface를 자동 대조하는 가드를 추가했다.

### PR-7. Runtime Security Follow-up [`완료(추적 예외 유지)`]

- 결과: runtime audit 결과를 재분류하고 gate와 상세 검토 명령을 분리했다.

## 각 단계 공통 완료 기준

모든 단계는 아래 조건을 기본 공통 완료 기준으로 삼는다.

- 관련 contracts, API, Web, 테스트, 문서가 같은 변경 안에서 맞춰진다.
- `README.md`, `docs/README.md`, 관련 상세 문서의 설명이 서로 충돌하지 않는다.
- 기본 검증은 최소 `npm run check:quick`, `npm run test`를 다시 통과한다.
- build나 브라우저 smoke에 영향이 있는 변경이면 `npm run build`, `npm run test:e2e:smoke:build`까지 다시 확인한다.

## 이번 문서 기준 권장 결정 사항

현재 바로 결정해 두는 편이 좋은 항목은 아래와 같다.

- `/design-system`은 현재처럼 문서 진실성을 우선 유지하고, 실제 페이지 복구는 별도 UX 작업으로 분리한다.
- `test:e2e:smoke:build:browser`는 루트 래퍼 스크립트를 유지해 문서와 명령 진입점을 단순화한다.
- `test:prisma`는 CI에서 `PRISMA_INTEGRATION_DATABASE_URL` 전용으로 실행하고, 저장소 밖에서는 secret 등록과 첫 통과 증적 확보를 후속으로 진행한다.
- 차량 세부 운영 모델 분리 기준은 `docs/completed/VEHICLE_OPERATIONS_MODEL_PLAN.md`에 고정하고, 다음 저장소 작업은 차량 운영 요약 모델 정리와 `monthlyExpenseWon` 전환 기준 고정으로 둔다.

## 한 줄 결론

현재 저장소는 내부 정합성 패치가 대부분 끝난 상태이며, 다음 실제 저장소 작업은 `차량 운영 요약 모델 정리와 monthlyExpenseWon 전환 기준 고정`이고, 그 다음은 `PRISMA_INTEGRATION_DATABASE_URL` secret 등록과 운영/CI 후속 정리다.
