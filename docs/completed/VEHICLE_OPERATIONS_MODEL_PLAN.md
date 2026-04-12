# 차량 운영 모델 분리 설계

> 보관 상태: `2026-04-12` 기준 차량 운영 모델 분리 작업을 완료한 뒤 `docs/completed/`로 이동했다. 현재 운영 기준은 `docs/API.md`, `docs/VALIDATION_NOTES.md`, `docs/ACCOUNTING_MODEL_BOUNDARY.md`를 우선한다.

## 목적

이 문서는 현재 `Vehicle` 기본 정보, `FuelLog` 이력, 차량 운영비 보조 지표가 한 계약과 한 화면에 느슨하게 묶여 있는 상태를 정리하고, 다음 구현 단계에서 어떤 경계로 분리할지 고정하기 위한 설계 문서다.

핵심은 아래 세 가지다.

- `차량 기본 정보`와 `차량 운영 이력`을 같은 write model로 다루지 않는다.
- 연료 이력과 정비 이력은 별도 운영 기록 모델로 분리한다.
- 차량 관련 지표는 `기본 엔티티 필드`가 아니라 `운영 요약 read model`로 수렴시킨다.

## 현재 상태와 문제

현재 구현은 차량 1차 CRUD, 연료 이력 분리 1차, 정비 이력 1차, 운영 요약 projection 정리까지 닫은 상태다.

- `packages/contracts/src/assets.ts`의 `VehicleItem`은 이제 차량 기본 정보만 담고, 연료 이력은 `VehicleFuelLogItem`으로 분리됐다.
- `GET /vehicles`와 `GET /vehicles/fuel-logs`, `GET /vehicles/maintenance-logs`는 이미 별도 계약과 쿼리로 나뉘어 있다.
- `apps/api/prisma/schema.prisma`의 `Vehicle`은 이제 `monthlyExpenseWon` 없이 기본 프로필과 `estimatedFuelEfficiencyKmPerLiter`만 유지한다.
- Web `/vehicles` 화면의 상단 운영 요약 카드와 차트는 `GET /vehicles/operating-summary` projection을 사용한다.
- 즉, 운영 이력 분리와 운영 요약 read model 정리는 1차 완료됐고, 이후 작업은 이 경계를 전제로 확장한다.

이 구조 정리로 차량 관리 화면의 기본/운영 요약 경계는 선명해졌고, 아래 원칙을 유지한 채 후속 확장을 진행한다.

- 차량 기본 정보 write model과 운영비/연비 요약 지표의 책임은 분리돼야 한다.
- `/vehicles` 응답은 가벼워졌지만, 운영 요약이 늘수록 `Vehicle` 기본 프로필 API가 다시 비대해질 여지가 있다.
- 운영비 같은 값은 원천 입력이 아니라 집계 결과라는 경계를 계속 유지해야 한다.
- 즉, 연료/정비 운영 이력 분리는 닫혔고, 남은 핵심 과제는 운영 요약 모델을 분리하는 것이다.

## 목표 경계

다음 단계부터 차량 도메인은 아래 네 층으로 읽히도록 정리한다.

### 1. Vehicle

차량 마스터이자 비교적 안정적인 프로필이다.

- 차량명
- 제조사
- 연료 종류
- 초기 주행거리
- 필요 시 선택적 기준 연비 필드

이 모델은 “무슨 차량을 관리 중인가”를 설명하는 기준선만 가진다.

### 2. VehicleFuelLog

연료 주입 또는 충전 1건을 나타내는 운영 이력이다.

- 차량 ID
- 기록일
- 주행거리
- 주입량 또는 충전량
- 금액
- 단가
- 가득 주유 여부

이 모델은 차량 마스터의 중첩 배열이 아니라 별도 CRUD 대상이다.

### 3. VehicleMaintenanceLog

정비 1건을 나타내는 운영 이력이다.

- 차량 ID
- 정비일
- 주행거리
- 정비 구분
- 정비처
- 금액
- 메모

정비는 연료 기록과 다르게 “이벤트 수가 적고 의미가 더 크다”는 특성이 있으므로 별도 모델로 둔다.

### 4. VehicleOperatingSummary

차량별 운영비, 실제 연비, 최근 정비일 같은 값은 write model이 아니라 요약 read model로 계산한다.

- 기간 기준 운영비 합계
- 실제 연비
- 최근 주유/정비 요약
- 필요 시 보험/수집 거래와 연결된 보조 집계

즉, `monthlyExpenseWon`은 장기적으로 `Vehicle` 기본 필드가 아니라 summary projection으로 이동하는 것이 맞다.

## 설계 원칙

### 1. `/vehicles`는 차량 프로필만 책임진다

`GET /vehicles`, `POST /vehicles`, `PATCH /vehicles/:id`는 차량 기본 정보 관리만 담당한다.

연료 이력이나 정비 이력을 이 계약에 중첩해서 넣지 않는다.

### 2. 운영 이력은 별도 API와 별도 테스트로 분리한다

연료 이력과 정비 이력은 각각 독립적인 생성/수정/조회 테스트를 가진다.

차량 기본 정보 CRUD 테스트가 이력을 대신 검증하지 않는다.

### 3. 회계 확정 모델과 직접 섞지 않는다

연료 이력과 정비 이력은 운영 근거 데이터다.

실제 회계적 진실은 계속 `CollectedTransaction`, `JournalEntry`에 남는다.

즉, 차량 운영 모델은 회계 확정 경로를 대체하지 않는다.

### 4. 파생 지표는 입력 필드보다 요약 모델로 이동시킨다

`monthlyExpenseWon`은 사용자가 직접 관리하는 “차량 마스터 속성”이라기보다 기간별 운영비 집계에 가깝다.

따라서 이 값은 `Vehicle` 기본 필드가 아니라 read model 쪽에서만 다루는 방향을 기준으로 삼고, 현재 구현도 그 기준에 맞춘다.

### 5. 연비 필드는 단기 호환과 실제 계산을 분리한다

현재 `estimatedFuelEfficiencyKmPerLiter`는 폼과 카드에 이미 연결돼 있다.

단기적으로는 “사용자 입력 기준 연비”로 유지할 수 있지만, 실제 평균 연비나 최근 연비는 연료 이력 기반 계산값으로 분리해 보여준다.

## 단계별 구현 순서

### Phase 1. 연료 이력 분리

가장 먼저 할 일은 현재 `VehicleItem.fuelLogs` 의존을 끊는 것이다.

- `Vehicle` 기본 정보 응답과 연료 이력 응답을 분리한다.
- Web `/vehicles` 화면은 차량 목록 쿼리와 최근 연료 기록 쿼리를 분리한다.
- 현재 E2E와 요청 단위 API 테스트도 차량 기본 정보와 연료 이력 테스트를 나눠 갖는다.
- 이후 단계에서도 운영비 성격의 값은 `Vehicle` 기본 필드가 아니라 summary projection에서만 관리한다.

이 단계의 목표는 “차량 목록 API가 연료 이력 read model까지 끌고 다니지 않게 만드는 것”이다.

### Phase 2. 정비 이력 1차 도입

연료 이력 분리 후 정비 이력을 독립 모델로 추가한다.

- 최소 필드 기준의 정비 로그 write/read를 만든다.
- Web은 차량 개요 화면 안에 정비 이력 영역을 추가하되, 차량 프로필 폼과는 분리한다.
- 정비 금액은 운영비 요약에 반영할 수 있지만 회계 확정 데이터와 직접 동치로 취급하지 않는다.

이 단계의 목표는 “차량 도메인이 주유 기록 테이블 하나에만 의존하지 않도록 운영 이력 축을 완성하는 것”이다.

현재 상태 메모:

- 2026-04-05 기준 `VehicleItem.fuelLogs` 제거, `GET /vehicles/fuel-logs`, `POST /vehicles/:id/fuel-logs`, `PATCH /vehicles/:vehicleId/fuel-logs/:fuelLogId`, Web `/vehicles` 연료 기록 생성/수정 흐름까지 반영 완료
- 2026-04-05 기준 `GET /vehicles/maintenance-logs`, `POST /vehicles/:id/maintenance-logs`, `PATCH /vehicles/:vehicleId/maintenance-logs/:maintenanceLogId`, Web `/vehicles` 정비 기록 생성/수정 흐름까지 반영 완료
- 따라서 현재 남은 우선 구조 과제는 연료/정비 이력 추가가 아니라 운영 요약 모델 정리다.

### Phase 3. 운영 요약 모델 정리 [`완료`]

연료/정비 이력이 분리되면 summary projection을 정리한다.

- 차량별 월 운영비
- 실제 연비
- 최근 정비 상태
- 필요 시 보험/수집 거래와 연결된 보조 요약

현재 상태 메모:

- 2026-04-11 기준 `GET /vehicles/operating-summary`를 추가했고, Web `/vehicles` 상단 카드와 차트는 이 summary projection을 우선 사용한다.
- 2026-04-11 기준 차량 create/update 계약과 Web 폼에서 `monthlyExpenseWon` 입력을 제거했고, 같은 날 `VehicleItem`, Prisma `Vehicle`, seed/mock/test 표면에서도 해당 필드를 제거했다.
- 따라서 운영 요약 read model, write 계약 정리, 물리 필드 제거까지는 반영됐고, 이제 차량 화면은 연료/정비 기록 기반 운영 요약만 별도 projection으로 읽는다.

## 계약과 스키마에 대한 결정

### 유지할 것

- `Vehicle` 자체는 계속 `Asset & Coverage` 컨텍스트의 기준 엔티티로 유지한다.
- 현재 `estimatedFuelEfficiencyKmPerLiter`는 단기 호환을 위해 당분간 남겨도 된다.
- 현재 `FuelLog` 물리 테이블은 첫 단계에서 즉시 DB 이름을 바꾸지 않아도 된다.

### 바꿀 것

- contracts 표면에서는 `VehicleItem`이 장기적으로 연료 이력 배열을 가지지 않게 만든다.
- 연료 이력은 명시적 별도 타입으로 분리한다.
- 정비 이력은 새 타입과 새 저장 모델로 도입한다.
- `monthlyExpenseWon` 성격의 값은 장기적으로도 `Vehicle` 기본 필드가 아니라 summary projection 쪽에서만 다룬다.

### 미루는 것

- 연료/정비 로그를 자동으로 수집 거래에 매칭하는 규칙 엔진
- 영수증 OCR
- 정비 주기 추천이나 AI 조언
- 차량 감가상각 같은 회계 정책 자동화

## Web 화면 방향

현재 `/vehicles` 경로는 유지하되 화면 책임을 나눈다.

- 상단: 차량 프로필과 운영 요약
- 중단: 최근 연료 기록
- 하단 또는 후속 탭: 정비 이력

중요한 점은 “한 화면에 보인다”와 “한 계약으로 저장한다”를 분리하는 것이다.

즉, 같은 route에 남아 있어도 쿼리와 mutation은 프로필, 연료, 정비를 각각 분리한다.

## 문서와 검증 반영 기준

이 설계가 실제 구현으로 이어질 때는 아래 문서를 같이 맞춘다.

- `packages/contracts`
- `docs/API.md`
- `docs/VALIDATION_NOTES.md`
- `docs/PROJECT_PLAN.md`
- `docs/completed/ALIGNMENT_PATCH_EXECUTION_PLAN.md`

검증은 최소 아래 범위를 다시 닫는다.

- 차량 프로필 요청 단위 API 테스트
- 연료 이력 요청 단위 API 테스트
- 정비 이력 요청 단위 API 테스트
- `/vehicles` 브라우저 대표 흐름
- `npm run check:quick`
- `npm run test`

## 바로 다음 구현 우선순위

이 문서 기준으로 차량 모델 분리 이후 저장소 내부 정리 과제는 모두 완료됐다.

연료 이력 분리, 정비 이력 Phase 1, 운영 요약 projection, `monthlyExpenseWon` write/response/physical 정리, 이어진 레거시 `Transaction` 물리 제거와 Next.js ESLint 경고 정리까지 반영 완료로 본다.

이후 차량 도메인 후속 작업은 더 이상 경계 정리 성격이 아니라, 실제 신규 요구가 생길 때 그 요구를 별도 우선순위로 다루는 단계다.

## 한 줄 결정

차량 도메인은 이제 `Vehicle 기본 정보`와 `연료/정비 운영 이력`, `운영 요약`을 분리하는 방향으로 고정하며, 다음 구현은 운영 요약 모델 정리부터 시작한다.
