# Round 0 기준선 잠금

## 1. 목적

이 문서는 Phase 1 실행 전 `Round 0: 기준선 잠금` 결과를 고정하기 위한 문서다.

Round 0의 목적은 다음과 같다.

- 지금부터 구현의 기준이 되는 문서 집합을 확정한다.
- 도메인 명칭과 현재 물리 모델 명칭의 매핑을 고정한다.
- 현재 DB, API, 화면이 어디까지 올라와 있는지 기준 상태를 남긴다.
- Round 1부터 무엇을 바꾸고 무엇은 아직 건드리지 않을지 분명히 한다.

이 문서가 있는 동안, 이후 구현은 이 기준선에서 출발한다.

---

## 2. 기준 문서 집합

Round 0 기준 문서는 아래 다섯 개로 잠근다.

- [business-logic-draft.md](../../domain/business-logic-draft.md)
- [core-entity-definition.md](../../domain/core-entity-definition.md)
- [phase-1-db-backbone-design.md](./phase-1-db-backbone-design.md)
- [phase-1-screen-implementation-order.md](./phase-1-screen-implementation-order.md)
- [phase-1-thin-first-execution-plan.md](./phase-1-thin-first-execution-plan.md)

역할은 이렇게 구분한다.

- `business-logic-draft.md`
  - 운영 사이클, 권한, 트랜잭션 경계, 상태 흐름의 기준
- `core-entity-definition.md`
  - 엔티티 책임, 불변조건, 관계, 구현 우선순위의 기준
- `phase-1-db-backbone-design.md`
  - 현재 스키마를 백본 구조로 옮기는 DB 전략 기준
- `phase-1-screen-implementation-order.md`
  - 화면 구현 순서 기준
- `phase-1-thin-first-execution-plan.md`
  - 얇게 전체를 먼저 연결하는 실행 순서 기준

---

## 3. 도메인 명칭과 현재 물리 모델 매핑

현재 구현은 도메인 명칭과 물리 모델 명칭이 완전히 1:1은 아니다.
Round 0에서는 아래 매핑을 공식 기준으로 잠근다.

| 도메인 명칭            | 현재 물리 모델 / 구현 명칭 | 비고                                    |
| ---------------------- | -------------------------- | --------------------------------------- |
| `PlatformUser`         | `User`                     | 물리 rename은 후속                      |
| `FundingAccount`       | `Account`                  | 1차에서는 확장 사용                     |
| `TransactionType`      | `LedgerTransactionType`    | 기존 enum `TransactionType`과 충돌 회피 |
| `CollectedTransaction` | `CollectedTransaction`     | 도메인 명칭과 일치                      |
| `JournalEntry`         | `JournalEntry`             | 도메인 명칭과 일치                      |
| `JournalLine`          | `JournalLine`              | 도메인 명칭과 일치                      |

즉 이후 구현에서는 “문서 용어는 도메인 명칭”, “코드 물리 모델은 현재 매핑”을 따르되, 새로운 외부 계약과 화면 문구는 가능한 한 도메인 명칭을 우선한다.

---

## 4. 현재 DB 기준선

### 4.1 이미 반영된 1차 백본

현재 Prisma와 실제 DB에는 아래 백본 테이블이 존재한다.

- `Tenant`
- `TenantMembership`
- `Ledger`
- `AccountingPeriod`
- `PeriodStatusHistory`
- `AccountSubject`
- `LedgerTransactionType`
- `PlanItem`
- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`
- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

또한 레거시 계층은 다음 상태로 유지한다.

- `User`
- `AuthSession`
- `UserSetting`
- `Account`
- `Category`
- `Transaction`
- `RecurringRule`

### 4.2 아직 없는 엔티티

아래는 아직 Prisma/실제 DB에 없다.

- `CarryForwardRecord`
- `FinancialStatementSnapshot`
- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`

이 중 앞의 두 개는 `Phase 1B`로 보고, 뒤 세 개는 후속 SaaS 확장 범위로 본다.

### 4.3 현재 데이터 상태

Round 0 시점 기준 실제 DB 상태는 다음과 같다.

- `Tenant`: 1
- `TenantMembership`: 1
- `Ledger`: 1
- `AccountSubject`: seed 존재
- `LedgerTransactionType`: seed 존재
- `Account`, `Category`, `Transaction`, `RecurringRule`: 기존 데이터 존재
- `AccountingPeriod`, `PlanItem`, `CollectedTransaction`, `JournalEntry`, `ClosingSnapshot`: 아직 운영 데이터 없음

### 4.4 backfill 상태

레거시 엔티티의 `tenantId / ledgerId` backfill은 완료된 상태로 본다.

- `Account`: 누락 0
- `Category`: 누락 0
- `Transaction`: 누락 0
- `RecurringRule`: 누락 0

다만 스키마상 nullable은 아직 남아 있으므로, Round 1 이후 실제 런타임 경로를 충분히 전환한 뒤 not-null 강화 여부를 다시 판단한다.

---

## 5. 현재 API 기준선

현재 런타임 API에서 실제로 연결된 모듈은 아래다.

- 인증
- 자금수단
- 카테고리
- 수집 거래
- 반복 규칙
- 보험
- 차량
- 대시보드
- 전망

즉 현재는 아래 코어 모듈이 아직 런타임 진입점으로 없다.

- `AccountingPeriod`
- `JournalEntry`
- `ClosingSnapshot`
- `FinancialStatementSnapshot`
- `CarryForwardRecord`

Round 0 기준선에서는 이것을 “미구현 격차”로 인정하고, 구조 결함이 아니라 다음 라운드의 공식 작업 대상으로 본다.

---

## 6. 현재 화면 기준선

현재 화면은 세 층으로 나눈다.

### 6.1 기반 화면

- 로그인
- 대시보드
- 수집 거래
- 반복 규칙
- 전망
- 설정

### 6.2 보조 운영 화면

- 보험
- 차량

### 6.3 코어 회계 화면의 미구현 영역

아래는 아직 전용 화면이 없다.

- `AccountingPeriod` 시작 화면
- `JournalEntry` 조회 화면
- `ClosingSnapshot` 마감 화면
- `FinancialStatementSnapshot` 화면
- `CarryForwardRecord` 화면

즉 화면은 “코어 회계 전체를 다루는 상태”가 아니라 “일부 엔티티와 읽기 모델이 먼저 올라온 상태”로 정의한다.

---

## 7. Round 0에서 잠그는 구현 원칙

### 7.1 지금부터 코어 write의 공식 기준

- 원천 거래: `CollectedTransaction`
- 확정 회계: `JournalEntry / JournalLine`
- 기간 운영: `AccountingPeriod`
- 마감 결과: `ClosingSnapshot / BalanceSnapshotLine`
- 보고 결과: `FinancialStatementSnapshot`
- 차기 시작 연결: `CarryForwardRecord`

### 7.2 지금은 유지하지만 더 키우지 않을 것

- `Transaction` 직접 확장
- `userId` 단독 소유권 모델
- 화면 설명만 도메인 용어로 붙이고 내부는 계속 레거시로 두는 방식

### 7.3 새 구현은 반드시 period 문맥 안에 넣는다

Round 1 이후 새 코어 기능은 기본적으로 아래 문맥을 가진다.

- 현재 `Tenant`
- 현재 `TenantMembership`
- 현재 `Ledger`
- 대상 `AccountingPeriod`

즉 period 밖에서 임의로 거래를 쌓는 경로를 더 늘리지 않는다.

---

## 8. Round 1 착수 조건

Round 0이 끝났다고 보기 위한 조건은 아래다.

1. 기준 문서 집합이 확정돼 있다.
2. 도메인 명칭과 물리 모델 명칭 매핑이 정리돼 있다.
3. 현재 DB / API / 화면 기준선이 문서로 남아 있다.
4. 다음 라운드의 첫 작업 대상이 분명하다.

현재 이 네 조건을 충족하면 Round 0은 완료로 본다.

---

## 9. Round 1 첫 작업

Round 1의 첫 작업은 아래로 고정한다.

1. 로그인 이후 현재 `TenantMembership`와 기본 `Ledger`를 해석하는 런타임 문맥 정리
2. API request context를 `userId` 중심에서 `tenant/membership/ledger` 중심으로 확장
3. 설정 화면을 실제 현재 작업 장부 확인 화면으로 정리
4. 이후 `AccountingPeriod` 화면이 바로 붙을 수 있도록 기반 계약을 마련

즉 Round 1은 “장부 문맥이 없는 상태에서 period를 만들지 않기 위한 준비 단계”다.

---

## 10. 결론

Round 0은 구현을 미루는 단계가 아니라, 앞으로의 구현이 흔들리지 않게 시작 위치를 박아두는 단계다.

현재 기준선은 이렇게 잠근다.

- 문서는 충분히 준비돼 있다.
- DB 백본은 Phase 1A 수준까지 올라와 있다.
- 런타임 API와 화면은 아직 코어 흐름 전부를 덮지 못했다.
- 따라서 다음 라운드는 `Tenant / Membership / Ledger` 문맥 정리부터 들어간다.

즉 지금은 **Round 0부터 시작하는 것이 맞고**, 이 문서를 기준으로 Round 1에 바로 들어간다.
