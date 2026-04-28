# 운영월 오픈/마감 분리 실행 정리

> 현재 정책 대체 안내: 이 문서는 과거에 적용했던 "운영월 오픈/마감 분리" 실행 기록이다. 2026-04-22 기준 최신 정책은 하나의 최신 진행월만 열어 두고, 다음 월은 최근 월 마감 이후 여는 월별 운영 모델이다. 업로드 배치의 운영월 자동 생성도 운영 시작 전 기초데이터 적재 또는 신규 계좌/카드 기초 업로드 예외로 제한된다. 현재 구현 기준은 `docs/API.md`, `docs/DEMO_GUIDE.md`, `docs/domain/business-logic-draft.md`를 우선한다.

## 목표

- 월 오픈과 월 마감을 서로 독립된 회계 작업으로 분리한다.
- 업로드 배치가 거래일 기준 월을 자동 준비하는 동작과 수동 월 운영 정책이 충돌하지 않게 맞춘다.
- 잠금월 입력 금지, 차기 이월/오프닝 스냅샷 종속성 보호는 그대로 유지한다.

## 문제 정리

- 기존 수동 `POST /accounting-periods`는 이전 월이 `LOCKED`여야만 다음 월을 열 수 있었다.
- 반면 업로드 배치는 거래일 기준 월이 없으면 해당 월을 직접 `OPEN`으로 생성했다.
- 그래서 실제 운영에서는:
  - 다음 월을 먼저 열어 두고 당월 업무를 시작하고 싶어도 수동 화면에서는 막히고
  - 업로드 배치는 같은 상황에서 월을 생성해 버려 정책이 서로 달랐다.
- 또한 재오픈은 `가장 최근 운영 기간만` 허용하고 있어, 다음 월이 이미 열린 상태의 직전 마감월 정정이 불필요하게 막혔다.

## 회계 방향

- 당시 방향은 다음 월 사전 오픈을 허용하는 것이었다. 현재 정책에서는 최근 월 마감 전 다음 월 오픈을 허용하지 않는다.
- 월 마감은 별도 명시 작업으로만 수행한다.
- 잠금월은 계속 입력 금지다.
- 재오픈은 “가장 최근 월인지”가 아니라 “차기 이월 또는 다음 월 오프닝 스냅샷 같은 종속 산출물이 이미 생겼는지”로 판단한다.

## 적용 내용

1. 월 오픈 정책 완화

- `apps/api/src/modules/accounting-periods/open-accounting-period.use-case.ts`
- 이전 월 `LOCKED` 선행 강제를 제거했다.
- 대신 기존처럼:
  - 동일 월 중복 생성 금지
  - 가장 최근 운영월보다 이후 월만 생성 가능
  - 첫 월은 오프닝 잔액 필수
  - 첫 월 이후 오프닝 잔액 직접 생성 금지
    를 유지했다.

2. 재오픈 정책 정리

- `apps/api/src/modules/accounting-periods/reopen-accounting-period.use-case.ts`
- `가장 최근 운영 기간만 재오픈 가능` 제한을 제거했다.
- 대신 기존 종속성 보호를 유지했다.
  - 차기 이월 record 존재 시 차단
  - 다음 월 opening balance snapshot 존재 시 차단

3. 전이 정책 정리

- `apps/api/src/modules/accounting-periods/accounting-period-transition.policy.ts`
- 더 이상 쓰지 않는 `이전 기간 잠금 선행` 검증 함수를 제거했다.

4. 회귀 테스트 추가

- `apps/api/test/accounting-periods.request-api.test.ts`
- 검증 시나리오를 추가/수정했다.
  - 당시 정책 기준: 이전 월이 아직 열려 있어도 다음 월 오픈 가능
  - 여러 운영월이 열려 있을 때 `current`는 가장 최근 열린 월 반환
  - 다음 월이 이미 열려 있어도 종속 산출물이 없으면 마감월 재오픈 가능

5. 화면/문서 정리

- `apps/web/src/features/accounting-periods/accounting-periods-page.sections.tsx`
- `apps/web/src/features/accounting-periods/accounting-periods-page.lifecycle-section.tsx`
- `docs/API.md`
- `docs/DEMO_GUIDE.md`
- 새 정책에 맞게 월 오픈/마감 분리, 재오픈 종속성 기준을 반영했다.

## 기대 효과

- 업로드 배치의 자동 월 생성과 수동 월 운영 화면이 같은 방향으로 움직인다.
- 당시 정책 기준으로는 다음 월 사전 오픈을 통해 월초 운영 준비와 전월 잔여 업로드 충돌을 줄이려 했다. 현재 정책에서는 최신 진행월 하나를 유지하고, 업로드 배치 자동 운영월 생성은 기초데이터 예외로 제한한다.
- 마감 보호와 이월 종속성 보호는 유지되어 회계적 통제는 계속 보장된다.

## 검증

- `npm.cmd run typecheck --workspace @personal-erp/api`
- `npm.cmd run compile:test --workspace @personal-erp/api`
- `node --test --test-concurrency=1 --test-isolation=none apps/api/.test-dist/apps/api/test/accounting-periods.request-api.test.js`
- `npm.cmd run lint --workspace @personal-erp/api`
- `npm.cmd run build --workspace @personal-erp/web`

## 과거 추가 보완: 거래일 기준 월 선택

### 배경

- 당시 사전 오픈 정책에서는 여러 운영월이 동시에 `OPEN`/`IN_REVIEW` 상태일 수 있었다.
- 기존 수기 수집 거래와 반전/정정 전표는 `현재 열린 최신 월` 하나만 기준으로 날짜를 검사했다.
- 이 상태에서는 업로드 배치가 이전 열린 월 거래를 정상 등록해도, 수기 보완/조회/조정 화면이 같은 월을 자연스럽게 다루지 못할 수 있다.

### 적용 방향

- 기본 화면 문맥은 계속 현재 운영월을 중심으로 유지한다.
- 저장/조정 가능 여부는 거래일을 포함하는 열린 운영월을 직접 찾아 판단한다.
- 전표 번호를 발번해야 하는 반전/정정 전표는 `OPEN`/`IN_REVIEW` 월만 허용한다.
- 잠금월은 기존처럼 입력/조정 대상에서 제외한다.

### 적용 내용

1. API 기간 가드 확장

- `AccountingPeriodWriteGuardPort`에 `assertJournalEntryDateAllowed`를 추가했다.
- 수집 거래는 거래일을 포함하는 `OPEN`/`IN_REVIEW`/`CLOSING` 월에 저장한다.
- 반전/정정 전표는 거래일을 포함하는 `OPEN`/`IN_REVIEW` 월에만 생성한다.

2. Web 기간 판정 공유

- `apps/web/src/features/accounting-periods/accounting-period-selection.ts`를 추가했다.
- 수집 거래 입력/목록과 전표 반전/정정 화면이 같은 방식으로 열린 월 목록을 해석한다.

3. 수집 거래 화면 보완

- 수집 거래 목록은 현재 최신 월 하나만 보지 않고 열린 운영월 범위의 거래를 표시한다.
- 수집 거래 등록/수정은 기본 날짜는 현재 운영월 기준으로 유지하되, 다른 열린 운영월 날짜도 허용한다.

4. 전표 조정 화면 보완

- 반전/정정 전표는 현재 월 기본값을 유지하되, 전표 입력 가능한 열린 운영월 날짜를 허용한다.
- 현재 운영 기준 월이 `CLOSING` 등 전표 입력 불가 상태이면, 입력 가능한 다른 열린 월을 조정 기본 월로 사용한다.

### 추가 검증

- `npm.cmd run typecheck --workspace @personal-erp/api`
- `npm.cmd run compile:test --workspace @personal-erp/api`
- `npm.cmd run build --workspace @personal-erp/web`
- `node --test --test-concurrency=1 --test-isolation=none apps/api/.test-dist/apps/api/test/transactions.request-api.create.test.js apps/api/.test-dist/apps/api/test/transactions.request-api.journal-adjustments.test.js`
- `npm.cmd run lint --workspace @personal-erp/api`
- `npm.cmd run docs:check`

## 추가 보완: 월별 재오픈 작업대

### 배경

- 백엔드는 특정 잠금월 재오픈을 지원하지만, 웹 화면은 사실상 `가장 최근 잠금월 1개`만 재오픈 대상으로 다루고 있었다.
- 이 때문에 업로드 배치 차단 후 사용자가 특정 과거 월만 다시 열고 싶은 경우에도, 화면에서는 월별 재오픈 흐름이 자연스럽게 드러나지 않았다.

### 적용 내용

1. 잠금월 선택형 재오픈

- `apps/web/src/features/accounting-periods/accounting-periods-page.tsx`
- `apps/web/src/features/accounting-periods/accounting-periods-page.lifecycle-section.tsx`
- 재오픈 작업대에서 잠금월 목록을 직접 선택하도록 바꾸고, 선택한 월을 재오픈 API 대상으로 사용한다.
- 현재 열린 월이 있어도 `월 마감`과 `재오픈`을 같은 작업대에서 탭으로 분리해 처리한다.

2. 기간 이력에서 재오픈 진입 강화

- `apps/web/src/features/accounting-periods/accounting-periods-page.sections.tsx`
- `apps/web/src/features/accounting-periods/accounting-periods-page.workspace-sections.tsx`
- 잠금월 행마다 `재오픈 검토` 버튼을 제공하고, 선택한 월이 재오픈 작업대에 바로 반영되도록 쿼리 파라미터를 연결했다.

3. 월별 재오픈 가능/불가 사유 표시

- `apps/web/src/features/accounting-periods/accounting-period-reopen-eligibility.ts`
- `apps/web/src/features/accounting-periods/accounting-periods-page.tsx`
- 잠금월별로 차기 이월 존재 여부와 다음 월 오프닝 스냅샷 존재 여부를 조회해, 재오픈 가능/차단 상태를 미리 계산한다.
- 이력 표와 재오픈 작업대에서 `재오픈 가능`, `차기 이월 생성됨`, `오프닝 스냅샷 있음`, `조건 확인 실패` 같은 상태를 저장 전부터 보여 준다.

4. 안내 문구 정리

- `apps/web/src/features/accounting-periods/accounting-periods-page.model.ts`
- `apps/web/src/features/accounting-periods/accounting-periods-page.status-section.tsx`
- 더 이상 `최근 잠금월만 재오픈`처럼 보이지 않도록 화면 설명과 상태 문구를 `잠금월 재오픈` 기준으로 정리했다.

### 검증

- `npm.cmd run build --workspace @personal-erp/web`
