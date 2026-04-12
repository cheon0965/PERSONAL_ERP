# 1차 화면 구현 우선순위

## 1. 문서 목적

이 문서는 [business-logic-draft.md](../../domain/business-logic-draft.md), [core-entity-definition.md](../../domain/core-entity-definition.md), [phase-1-db-backbone-design.md](./phase-1-db-backbone-design.md) 를 기준으로, 실제 화면 구현을 어떤 순서로 올려야 하는지 고정하기 위한 기준서다.

참고: 이 아카이브 문서에서 말하는 `transactions`는 당시 화면 shorthand를 뜻하며, 현재 API 구현 이름은 `collected-transactions`, Web 라우트는 `/transactions`입니다.

목표는 다음과 같다.

- 이미 있는 화면을 최대한 재사용하되, 대표 시나리오 완주에 필요한 화면부터 구현한다.
- 화면을 많이 만드는 것보다 `CollectedTransaction -> JournalEntry -> ClosingSnapshot -> FinancialStatementSnapshot -> CarryForwardRecord` 흐름을 먼저 완성한다.
- 문서와 실제 구현이 다시 어긋나지 않도록, 각 화면의 역할을 `읽기 모델`, `입력 화면`, `확정 화면`, `마감 화면`, `보고 화면`으로 구분한다.

---

## 2. 현재 화면 상태 요약

현재 웹 화면은 다음 성격으로 나뉜다.

### 2.1 이미 usable 한 기반 화면

- `login`
- `dashboard`
- `transactions`
- `recurring`
- `forecast`
- `settings`

이 화면들은 라우트, 공통 레이아웃, 인증 가드, 기본 조회/입력 폼까지 있다.

### 2.2 아직 도메인 백본과 완전히 맞지 않는 화면

- `dashboard`
- `transactions`
- `recurring`
- `forecast`

이 화면들은 사용자 경험상 이미 보이지만, 내부 데이터 흐름은 아직 `Tenant / Ledger / AccountingPeriod / JournalEntry` 중심으로 완전히 올라오지 않았다.

### 2.3 보조 운영 화면

- `insurances`
- `vehicles`
- `settings`

이 화면들은 코어 회계 흐름보다 뒤에 붙어도 된다.

### 2.4 제품 코어와 무관한 화면

- `design-system`

이 화면은 내부 UI 샘플 용도이므로 비즈니스 로직 구현 우선순위에 포함하지 않는다.

---

## 3. 대표 시나리오 기준 구현 원칙

1차 구현의 대표 시나리오는 다음 흐름으로 고정한다.

1. Owner가 Tenant, Ledger, FundingAccount, Category, OpeningBalance를 준비한다.
2. Owner가 첫 월의 `AccountingPeriod` 를 연다.
3. Editor 또는 System이 거래 1건을 `CollectedTransaction` 으로 만든다.
4. 검토 후 `JournalEntry / JournalLine` 으로 확정한다.
5. Owner가 월을 마감해 `ClosingSnapshot / BalanceSnapshotLine` 을 만든다.
6. 잠금 후 `FinancialStatementSnapshot` 을 생성한다.
7. 다음 월 기준을 위해 `CarryForwardRecord` 를 만든다.

따라서 화면 구현 순서도 이 흐름을 따라야 한다.

---

## 4. 구현 우선순위

## 4.1 Priority 1: 월 운영 시작 화면

### 목표

공식 회계 흐름의 시작점을 만든다.

### 새로 만들 것

- `월 운영 시작` 화면

### 핵심 기능

- 현재 Tenant / Ledger 확인
- 대상 년월 선택
- 이전 기간 잠금 여부 확인
- 첫 달이면 `OpeningBalanceSnapshot` 존재 여부 확인
- `AccountingPeriod` 생성 또는 오픈

### 연관 엔티티

- `Tenant`
- `TenantMembership`
- `Ledger`
- `AccountingPeriod`
- `OpeningBalanceSnapshot`

### 이유

현재 화면들 중 이 역할을 하는 공식 시작 화면이 없다.  
문서상 프로젝트 시작점이 `월 운영 시작 + 계획 생성` 이므로, 이 화면이 먼저 있어야 이후 거래/확정/마감이 모두 period 문맥 위에서 움직인다.

---

## 4.2 Priority 2: 수집 거래 검토 및 확정 화면

### 목표

기존 `transactions` 화면을 단순 입력 화면에서 `CollectedTransaction` 검토/확정 화면으로 승격한다.

### 기존 화면 재사용

- 현재 `transactions` 화면을 확장한다.

### 추가할 것

- 상태 필터 (`Collected`, `Reviewed`, `ReadyToPost`, `Posted`, `Corrected`, `Locked`)
- 거래 상세 패널
- 검토 완료 처리
- 확정 전표 미리보기
- `Posted` 전환 액션

### 핵심 기능

- 거래를 특정 `AccountingPeriod` 문맥 안에서 본다.
- 하나의 `CollectedTransaction` 을 하나의 `JournalEntry` 로 확정한다.
- 확정 후 `postedJournalEntryId` 를 연결한다.
- 필요 시 연결된 `PlanItem` 을 `Confirmed` 로 종료한다.

### 연관 엔티티

- `CollectedTransaction`
- `JournalEntry`
- `JournalLine`
- `PlanItem`
- `AccountingPeriod`

### 이유

현재 이미 가장 많이 올라와 있는 화면이 `transactions` 이다.  
따라서 새 화면을 만드는 것보다 이 화면을 코어 write 흐름에 맞게 진화시키는 것이 가장 빠르고 재작업이 적다.

---

## 4.3 Priority 3: 전표 조회 화면

### 목표

확정 결과를 공식 회계 단위로 확인하는 화면을 만든다.

### 새로 만들 것

- `journal-entries` 또는 `ledger-entries` 화면

### 핵심 기능

- 기간별 전표 목록 조회
- 전표 상세 조회
- 차변/대변 라인 확인
- 원천 `CollectedTransaction` 연결 확인
- 정정/반전 전표 관계 확인

### 연관 엔티티

- `JournalEntry`
- `JournalLine`
- `CollectedTransaction`
- `AccountingPeriod`

### 이유

문서상 공식 진실 원천은 전표다.  
그런데 현재 UI에는 전표를 직접 보는 화면이 없다.  
`transactions` 확정 기능을 만든 다음에는 반드시 전표 조회 화면이 따라와야 한다.

---

## 4.4 Priority 4: 월 마감 화면

### 목표

`AccountingPeriod` 를 `Locked` 로 전환하고 `ClosingSnapshot` 을 만드는 공식 마감 화면을 만든다.

### 새로 만들 것

- `month-close` 또는 `period-close` 화면

### 핵심 기능

- 마감 전 체크리스트
- 미확정 거래 존재 여부 확인
- 잠금 가능 여부 검증
- `PeriodStatusHistory` 기록
- `ClosingSnapshot` 생성
- `BalanceSnapshotLine` 생성

### 연관 엔티티

- `AccountingPeriod`
- `PeriodStatusHistory`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

### 이유

문서상 마감은 핵심 운영 사이클의 종료 지점이다.  
여기까지 올라와야 비로소 “거래 입력 앱”이 아니라 “운영 ERP”가 된다.

---

## 4.5 Priority 5: 재무제표 화면

### 목표

잠금된 기간 기준의 공식 보고 화면을 만든다.

### 새로 만들 것

- `financial-statements` 화면

### 핵심 기능

- 기간 선택
- `FinancialStatementSnapshot` 조회
- 재산상태표, 월간 손익, 현금흐름 요약, 순자산 변동 요약 표시
- 잠금 전에는 preview, 잠금 후에는 공식 snapshot 표시

### 연관 엔티티

- `FinancialStatementSnapshot`
- `ClosingSnapshot`
- `JournalEntry`
- `AccountingPeriod`

### 이유

현재 `forecast` 는 운영 판단용 read model 이지만, 공식 보고 화면은 아니다.  
재무제표 화면이 있어야 문서상 “프로젝트의 끝”과 실제 제품 경험이 연결된다.

---

## 4.6 Priority 6: 차기 이월 화면

### 목표

잠금된 기간을 다음 월의 시작 기준으로 넘기는 화면을 만든다.

### 새로 만들 것

- `carry-forward` 화면

### 핵심 기능

- 대상 `ClosingSnapshot` 확인
- 다음 기간 확인
- `CarryForwardRecord` 생성
- 다음 월 오프닝 기준 표시

### 연관 엔티티

- `CarryForwardRecord`
- `ClosingSnapshot`
- `BalanceSnapshotLine`
- `OpeningBalanceSnapshot`

### 이유

문서상 프로젝트의 마지막 단계는 재무제표와 차기 이월 기준 확정이다.  
이 화면까지 가야 대표 시나리오가 완결된다.

---

## 5. 기존 화면 처리 원칙

### 5.1 `transactions`

- 유지한다.
- 다만 단순 입력 화면이 아니라 `CollectedTransaction` 검토/확정 화면으로 확장한다.

### 5.2 `recurring`

- 유지한다.
- 1차에서는 `RecurringRule` 입력/조회까지만 유지한다.
- 이후 `PlanItem` 탭 또는 연결 화면을 붙여 계획 생성 흐름으로 확장한다.

### 5.3 `dashboard`

- 유지한다.
- 당장은 운영 read model 로 둔다.
- 전표/마감/재무제표가 올라온 뒤 공식 수치 기준을 새 백본으로 교체한다.

### 5.4 `forecast`

- 유지한다.
- 공식 보고 화면이 아니라 운영 예측 화면으로 위치를 명확히 둔다.

### 5.5 `insurances`, `vehicles`

- 후순위다.
- 코어 회계 흐름이 올라온 뒤 연결 정밀도를 높인다.

### 5.6 `settings`

- Tenant / Ledger / 운영 기간 기본 정보 확인 화면으로 점진 확장 가능하다.
- 하지만 1차 핵심 구현의 시작점으로 쓰지는 않는다.

---

## 6. 실제 구현 순서 제안

아래 순서대로 가는 것을 권장한다.

1. `월 운영 시작` 화면 신설
2. 기존 `transactions` 화면을 `CollectedTransaction 검토/확정` 화면으로 확장
3. `JournalEntry` 조회 화면 신설
4. `월 마감` 화면 신설
5. `FinancialStatementSnapshot` 화면 신설
6. `CarryForwardRecord` 화면 신설
7. `recurring` 화면에 `PlanItem` 연계 추가
8. `ImportBatch / ImportedRow` 업로드 화면 추가

이 순서면 대표 시나리오를 가장 짧은 경로로 완주할 수 있다.

---

## 7. 지금 당장 손대지 않을 것

- `insurances` / `vehicles` 고도화
- 다중 Tenant 선택 화면
- SupportAccessGrant 운영 화면
- 복잡한 승인 흐름
- 고급 분석 리포트

---

## 8. 결론

지금 가장 자연스러운 다음 단계는 **새 화면을 많이 늘리는 것보다, `월 운영 시작 -> 수집 거래 확정 -> 전표 조회 -> 월 마감` 까지의 코어 회계 흐름을 먼저 세우는 것**이다.

특히 첫 착수는 다음 둘 중 하나가 아니라, 반드시 이 순서로 간다.

1. `월 운영 시작` 화면
2. `transactions` 화면의 `CollectedTransaction -> JournalEntry` 확장

이 두 축이 올라와야 이후 마감, 재무제표, 차기 이월이 자연스럽게 이어진다.
