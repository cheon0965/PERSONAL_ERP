# 1차 DB 백본 반영 설계안

## 1. 문서 목적

이 문서는 [business-logic-draft.md](../../domain/business-logic-draft.md) 와 [core-entity-definition.md](../../domain/core-entity-definition.md) 를 실제 `schema.prisma`와 연결하기 위한 **1차 DB 반영 기준안**이다.

목표는 두 가지다.

- 회계 도메인의 핵심 백본을 먼저 DB에 올려서 이후 구현이 큰 재작업 없이 확장되게 만든다.
- 아직 검증되지 않은 확장 범위까지 한 번에 고정하지 않고, 대표 시나리오 기준으로 세로 슬라이스 구현이 가능하게 만든다.

이 문서는 문서상 엔티티를 전부 한 번에 DB화하자는 제안이 아니다.
반대로 현재 `User / Account / Category / Transaction / RecurringRule` 중심 스키마 위에 기능만 계속 얹자는 제안도 아니다.

핵심 결정은 다음과 같다.

- **핵심 회계 백본은 먼저 DB에 반영한다.**
- **구현은 대표 시나리오 기준으로 하나씩 올린다.**
- **기존 인증/초기 CRUD 스키마는 즉시 파괴하지 않고, 점진 이행한다.**

---

## 2. 현재 스키마와 도메인 문서 사이의 간극

현재 [schema.prisma](../../../apps/api/prisma/schema.prisma) 는 다음 성격이 강하다.

- `User` 중심 단일 사용자 스키마
- `Account`, `Category`, `Transaction`, `RecurringRule` 중심의 초기 CRUD 구조
- 기간(`AccountingPeriod`)과 전표(`JournalEntry`)가 없는 단순 거래 기록 구조
- 결산, 마감, 이월, 재무제표 스냅샷 구조 부재

반면 도메인 문서는 다음 구조를 전제로 한다.

- `Tenant` 와 `TenantMembership` 기반 SaaS 경계
- `Ledger` 중심 회계 귀속
- `AccountingPeriod` 중심 월 운영
- `PlanItem` 과 `CollectedTransaction` 분리
- `JournalEntry` 와 `JournalLine` 중심 확정 회계 기록
- `ClosingSnapshot`, `BalanceSnapshotLine`, `CarryForwardRecord`, `FinancialStatementSnapshot` 중심 마감/보고

즉 지금 상태에서 기능만 계속 올리면, 나중에 아래 항목을 넣는 순간 재작업이 커질 가능성이 높다.

- 테넌트 경계
- 장부 경계
- 기간 잠금
- 전표 기반 확정 데이터
- 결산/마감/이월

---

## 3. 최종 설계 방향

### 3.1 큰 전략

이번 1차 DB 반영은 아래 전략을 따른다.

1. 인증과 현재 화면이 이미 의존하는 모델은 최대한 보존한다.
2. 대신 회계적으로 되돌리기 어려운 축을 먼저 추가한다.
3. 신규 회계 흐름은 더 이상 `Transaction` 테이블을 진실의 원천으로 삼지 않는다.
4. 대표 시나리오가 신규 백본 위에서 완주되면, 이후 화면과 기능을 점진적으로 새 구조로 옮긴다.

### 3.2 왜 이 전략이 맞는가

- 문서 기준과 실제 DB 구조가 너무 벌어지기 전에 중심 축을 맞출 수 있다.
- 현재 로그인, 인증, 데모 데이터, 기존 CRUD 화면을 한 번에 깨지 않는다.
- 추후 `Tenant / Ledger / Period / Journal` 축으로 자연스럽게 확장할 수 있다.
- 대표 시나리오를 완주하면서 실제 필요한 엔티티와 관계만 우선 검증할 수 있다.

---

## 4. 1차 반영 범위

### 4.1 Phase 1A: 지금 바로 DB에 올릴 백본

이 단계는 대표 시나리오의 핵심 회계 흐름을 가능하게 만드는 최소 백본이다.

- SaaS 경계
  - `Tenant`
  - `TenantMembership`
- 회계 귀속 및 기간
  - `Ledger`
  - `AccountingPeriod`
  - `PeriodStatusHistory`
- 회계 기준 마스터
  - `AccountSubject`
  - `TransactionType`
  - `FundingAccount` 성격의 확장된 자금수단
  - `Category` 의 Ledger 귀속화
- 계획 및 수집
  - `RecurringRule` 의 Ledger 귀속화
  - `PlanItem`
  - `ImportBatch`
  - `ImportedRow`
  - `CollectedTransaction`
- 확정 회계
  - `JournalEntry`
  - `JournalLine`
  - `OpeningBalanceSnapshot`
  - `ClosingSnapshot`
  - `BalanceSnapshotLine`

### 4.2 Phase 1B: 대표 시나리오 완결을 위해 바로 뒤따를 항목

이 단계는 Phase 1A가 안정화되면 바로 붙인다.

- `CarryForwardRecord`
- `FinancialStatementSnapshot`

### 4.3 지금은 뒤로 미룰 항목

아래 항목은 중요하지만 1차 DB 백본 착수 시점에는 고정하지 않는다.

- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`
- 사용자 자유 계정과목/거래유형/분개 템플릿
- 다중 통화
- 고급 승인 워크플로
- 고급 분석/비교 리포트

---

## 5. 설계 원칙

### 5.1 추가 우선, 파괴적 변경 후순위

1차에서는 기존 모델을 바로 삭제하거나 대대적으로 rename 하지 않는다.
먼저 필요한 테이블과 FK를 **추가**하고, 코드가 새 구조를 사용하기 시작한 뒤에 정리한다.

### 5.2 인증 루트는 우선 유지

현재 `User` 와 `AuthSession` 은 로그인과 세션 흐름의 중심이므로 1차에서는 유지한다.

도메인 관점에서는 `User` 를 사실상 `PlatformUser` 대응 모델로 취급하되, 물리 rename은 후속 단계로 미룬다.

### 5.3 Tenant와 Ledger는 분리한다

- `Tenant` 는 데이터 격리와 운영 경계다.
- `Ledger` 는 회계 귀속 경계다.

초기 제품은 Tenant당 기본 1 Ledger 운영을 전제로 두되, DB에는 `Ledger` 를 독립 엔티티로 둔다.

### 5.4 계획, 원천, 확정, 보고를 섞지 않는다

- 계획 데이터는 `PlanItem`
- 원천 수집 데이터는 `CollectedTransaction`
- 확정 회계 데이터는 `JournalEntry` / `JournalLine`
- 마감/보고 데이터는 `ClosingSnapshot` / `FinancialStatementSnapshot`

이 네 층은 물리적으로도 분리한다.

### 5.5 `Transaction` 은 더 이상 확장하지 않는다

현재 `Transaction` 테이블은 초기 CRUD 단계에서는 유용했지만, 도메인 기준의 회계적 진실 원천이 되기에는 부족하다.

1차 이후 신규 회계 흐름은 `Transaction` 위에 더 얹지 않는다.
필요하면 읽기 호환용 또는 임시 마이그레이션 브리지로만 유지한다.

### 5.6 금액은 최소 화폐단위 정수로 저장한다

도메인 문서 기준대로 모든 회계 금액은 `KRW` 최소 단위 정수(`Int`)를 원칙으로 한다.

- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`
- `FinancialStatementSnapshot`

위 값은 모두 동일한 반올림 정책을 공유해야 한다.

### 5.7 Tenant ID는 쓰기 루트와 조회핵심 엔티티에 명시 보존한다

회계 귀속의 중심은 Ledger지만, 실무적 조회와 데이터 격리를 위해 아래 엔티티에는 `tenantId` 를 직접 둔다.

- `Ledger`
- `AccountingPeriod`
- `FundingAccount`
- `Category`
- `RecurringRule`
- `PlanItem`
- `ImportBatch`
- `CollectedTransaction`
- `JournalEntry`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `CarryForwardRecord`
- `FinancialStatementSnapshot`

### 5.8 감사 주체는 최소 형태라도 반드시 남긴다

1차에서는 완전한 범용 감사 프레임워크보다, 회계적 중요 write 경로에 필요한 최소 주체 정보를 우선 저장한다.

- 상태 변경 이력(`PeriodStatusHistory`)
- 전표 생성/정정
- 마감/잠금
- 이월 생성

---

## 6. 1차 DB 모델 제안

## 6.1 유지 모델

### `User`

- 역할: 플랫폼 인증 사용자
- 유지 이유: 현재 로그인/세션/API가 이미 의존
- 1차 조치:
  - 즉시 삭제/rename 하지 않음
  - `TenantMembership.userId` 의 참조 대상이 됨

### `AuthSession`

- 역할: refresh token 세션
- 유지 이유: 현재 인증 흐름 핵심
- 1차 조치:
  - 변경 없이 유지

### `UserSetting`

- 역할: 사용자 개인 환경설정
- 1차 조치:
  - 회계 백본과 독립적으로 유지
  - 단, 장부 기준 설정과 혼동하지 않도록 회계 기준값은 Ledger 또는 Snapshot 계층으로 이동

---

## 6.2 신규 SaaS 경계

### `Tenant`

핵심 컬럼:

- `id`
- `slug`
- `name`
- `status`
- `defaultLedgerId` nullable
- `createdAt`
- `updatedAt`

제약:

- `slug` unique
- 하나의 Tenant는 기본적으로 하나의 기본 Ledger를 가진다.
- Suspended/Archived Tenant는 신규 쓰기 제한 근거가 된다.

### `TenantMembership`

핵심 컬럼:

- `id`
- `tenantId`
- `userId`
- `role` (`Owner`, `Manager`, `Editor`, `Viewer`)
- `status`
- `joinedAt`
- `invitedByMembershipId` nullable
- `lastAccessAt` nullable

제약:

- `(tenantId, userId)` unique
- Tenant마다 최소 1명의 `Owner`

비고:

- 초기 제품은 `SupportAccessGrant` 를 아직 두지 않으므로 일반 쓰기 권한은 전부 Membership을 통해 판정한다.

---

## 6.3 회계 귀속 및 기준 마스터

### `Ledger`

핵심 컬럼:

- `id`
- `tenantId`
- `name`
- `baseCurrency`
- `timezone`
- `status`
- `openedFromYearMonth`
- `closedThroughYearMonth` nullable
- `createdAt`
- `updatedAt`

제약:

- `(tenantId, name)` unique 권장
- 하나의 Ledger는 정확히 하나의 Tenant에 속한다.

### `AccountingPeriod`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `year`
- `month`
- `startDate`
- `endDate`
- `status` (`Open`, `InReview`, `Closing`, `Locked`)
- `openedAt`
- `lockedAt` nullable
- `createdAt`
- `updatedAt`

제약:

- `(ledgerId, year, month)` unique
- 마감 후 일반 수정 금지

### `PeriodStatusHistory`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId`
- `fromStatus`
- `toStatus`
- `reason`
- `actorType`
- `actorMembershipId` nullable
- `changedAt`

제약:

- `AccountingPeriod` 상태 변경마다 1건 이상 기록

### `AccountSubject`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `code`
- `name`
- `statementType`
- `normalSide`
- `subjectKind`
- `isSystem`
- `isActive`
- `sortOrder`

제약:

- `(ledgerId, code)` unique

비고:

- 초반에는 시스템 제공 계정과목 체계를 seed로 고정한다.

### `TransactionType`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `code`
- `name`
- `flowKind`
- `postingPolicyKey`
- `isActive`
- `sortOrder`

제약:

- `(ledgerId, code)` unique

비고:

- 사용자 자유 설계는 뒤로 미루고, 초기 제품은 고정된 거래유형만 허용한다.

### `FundingAccount`

도메인상 목표 엔티티는 `FundingAccount` 다.
다만 1차 이행에서는 기존 `Account` 테이블을 확장해 이 역할을 맡기는 것이 안전하다.

1차 조치:

- 기존 `Account` 에 `tenantId`, `ledgerId`, `status`, `isActive` 성격 컬럼 추가
- 기존 `balanceWon` 은 조회 보조값 또는 점진 폐기 대상으로 본다.
- 실제 확정 잔액은 이후 `JournalEntry` 와 `BalanceSnapshotLine` 기준으로 계산한다.

추가 제약:

- `(ledgerId, name)` unique 권장
- 자금수단은 반드시 하나의 Ledger에 속한다.

### `Category`

1차 조치:

- 기존 `Category` 에 `tenantId`, `ledgerId`, `isActive` 추가
- `kind` 는 유지하되, 실제 회계 처리 기준은 `TransactionType` 과 함께 판단

추가 제약:

- `(ledgerId, kind, name)` unique 권장

---

## 6.4 계획 및 수집 계층

### `RecurringRule`

1차 조치:

- 기존 `RecurringRule` 에 `tenantId`, `ledgerId`, `transactionTypeId`, `fundingAccountId`, `categoryId` 정리
- 기존 `accountId` 는 `fundingAccountId` 의미로 수렴

제약:

- 규칙은 Ledger 경계 안에서만 동작
- 월 운영 시작 시 `PlanItem` 생성의 원천이 됨

### `PlanItem`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId`
- `recurringRuleId` nullable
- `transactionTypeId`
- `fundingAccountId`
- `categoryId` nullable
- `title`
- `plannedAmount`
- `plannedDate`
- `status` (`Draft`, `Matched`, `Confirmed`, `Skipped`, `Expired`)
- `matchedCollectedTransactionId` nullable
- `postedJournalEntryId` nullable
- `createdAt`
- `updatedAt`

제약:

- 계획 데이터와 확정 데이터는 분리
- `Confirmed` 면 `postedJournalEntryId` 존재

### `ImportBatch`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId` nullable
- `sourceKind`
- `fileName`
- `fileHash`
- `rowCount`
- `parseStatus`
- `uploadedByMembershipId`
- `uploadedAt`

제약:

- 원본 배치 단위 보존

### `ImportedRow`

핵심 컬럼:

- `id`
- `batchId`
- `rowNumber`
- `rawPayload`
- `parseStatus`
- `parseError`
- `sourceFingerprint`
- `createdCollectedTransactionId` nullable

제약:

- `(batchId, rowNumber)` unique
- 파싱 실패 행은 `CollectedTransaction` 으로 승격하지 않는다.

### `CollectedTransaction`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId` nullable
- `importBatchId` nullable
- `importedRowId` nullable
- `transactionTypeId`
- `fundingAccountId`
- `categoryId` nullable
- `title`
- `occurredOn`
- `amount`
- `status` (`Collected`, `Reviewed`, `ReadyToPost`, `Posted`, `Corrected`, `Locked`)
- `sourceFingerprint`
- `matchedPlanItemId` nullable
- `postedJournalEntryId` nullable
- `memo` nullable
- `createdAt`
- `updatedAt`

제약:

- `(ledgerId, sourceFingerprint)` unique 권장
- `Posted` 면 `postedJournalEntryId` 존재
- 원천 거래와 전표는 분리

---

## 6.5 확정 회계 및 마감 계층

### `JournalEntry`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId`
- `entryNumber`
- `entryDate`
- `sourceKind`
- `sourceCollectedTransactionId` nullable
- `sourcePlanItemId` nullable
- `status`
- `memo` nullable
- `reversesJournalEntryId` nullable
- `correctsJournalEntryId` nullable
- `correctionReason` nullable
- `createdByActorType`
- `createdByMembershipId` nullable
- `createdAt`
- `updatedAt`

제약:

- `(ledgerId, entryNumber)` unique
- 차변/대변 합계 일치
- 하나의 `CollectedTransaction` 은 최대 하나의 `JournalEntry`

### `JournalLine`

핵심 컬럼:

- `id`
- `journalEntryId`
- `lineNumber`
- `accountSubjectId`
- `fundingAccountId` nullable
- `debitAmount`
- `creditAmount`
- `description` nullable

제약:

- `(journalEntryId, lineNumber)` unique
- `debitAmount` 와 `creditAmount` 는 최소 화폐단위 정수

### `OpeningBalanceSnapshot`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `effectivePeriodId`
- `sourceKind` (`InitialSetup`, `CarryForward`)
- `createdAt`
- `createdByActorType`
- `createdByMembershipId` nullable

제약:

- 첫 월 오픈 전 반드시 존재

### `ClosingSnapshot`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId`
- `lockedAt`
- `totalAssetAmount`
- `totalLiabilityAmount`
- `totalEquityAmount`
- `periodPnLAmount`
- `createdAt`

제약:

- `(periodId)` unique
- `Locked` 기간에 대해서만 생성

### `BalanceSnapshotLine`

핵심 컬럼:

- `id`
- `snapshotKind` (`Opening`, `Closing`)
- `openingSnapshotId` nullable
- `closingSnapshotId` nullable
- `accountSubjectId`
- `fundingAccountId` nullable
- `balanceAmount`

제약:

- Opening 또는 Closing 중 하나에만 속해야 함
- 총계는 상위 Snapshot과 논리적으로 일치해야 함

---

## 6.6 Phase 1B 후속 엔티티

### `CarryForwardRecord`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `sourceClosingSnapshotId`
- `targetPeriodId`
- `createdJournalEntryId` nullable
- `createdAt`
- `createdByActorType`
- `createdByMembershipId` nullable

제약:

- `(sourceClosingSnapshotId)` unique
- `ClosingSnapshot` 기준과 논리적으로 일치

### `FinancialStatementSnapshot`

핵심 컬럼:

- `id`
- `tenantId`
- `ledgerId`
- `periodId`
- `statementKind`
- `currency`
- `payload`
- `createdAt`

제약:

- `(periodId, statementKind)` unique 권장
- 공식 숫자는 `JournalEntry` / `ClosingSnapshot` 기준 확정값과 일치

---

## 7. 기존 모델의 처리 원칙

### 7.1 `Account` 는 1차에서 확장, 2차에서 명칭 정리

지금 당장 `Account` 를 물리 삭제하고 `FundingAccount` 를 새로 만들면 코드 충격이 크다.
따라서 1차에서는 기존 `Account` 를 확장해 사용하고, 코드/화면이 안정화된 뒤 도메인 명칭 정리를 검토한다.

### 7.2 `Transaction` 은 브리지 또는 읽기 호환용으로만 유지

`Transaction` 은 다음 이유로 더 이상 확장하지 않는다.

- 기간 귀속과 전표 확정 개념이 부족하다.
- 차대변 구조가 없다.
- 결산/잠금/정정 흐름을 담기 어렵다.

따라서 신규 회계 기능은 `CollectedTransaction` 과 `JournalEntry` 위에 구현한다.

### 7.3 `InsurancePolicy`, `Vehicle`, `FuelLog` 는 후속 정렬

이 모델들은 현재 `userId` 기준이다.
1차 회계 백본 단계에서는 우선 유지하되, 다중 Tenant 협업 기능을 본격적으로 열기 전에 `tenantId` 또는 `ledgerId` 귀속 전략을 별도로 정리한다.

즉 1차 범위에서는 다음 원칙을 둔다.

- 보험/차량 도메인은 기존 방식 유지 가능
- 단, 회계 확정 데이터의 진실 원천으로 사용하지 않음
- 이후 회계 백본과 연결할 때는 별도 migration으로 옮김

---

## 8. DB migration 순서 제안

### 8.1 Step 1

신규 SaaS/회계 백본 테이블을 추가한다.

- `Tenant`
- `TenantMembership`
- `Ledger`
- `AccountingPeriod`
- `PeriodStatusHistory`
- `AccountSubject`
- `TransactionType`
- `PlanItem`
- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`
- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

### 8.2 Step 2

기존 사용자마다 기본 Tenant/Membership/Ledger 를 1개씩 backfill 한다.

기본 규칙:

- `User` 1명당 `Tenant` 1개
- 해당 User는 그 Tenant의 `Owner`
- Tenant당 기본 `Ledger` 1개

### 8.3 Step 3

기존 `Account`, `Category`, `RecurringRule`, `Transaction` 에 `tenantId`, `ledgerId` 를 추가하고 backfill 한다.

주의:

- 이 단계는 기존 CRUD 화면을 깨지 않도록 nullable -> backfill -> not null 순서로 간다.

### 8.4 Step 4

초기 회계 기준 마스터를 seed 한다.

- 기본 `AccountSubject`
- 기본 `TransactionType`
- 필요 시 기본 `Category` 보정

### 8.5 Step 5

새로운 write 흐름을 신규 백본으로 연결한다.

예시:

- 월 운영 시작 -> `AccountingPeriod`
- 반복 규칙 생성 -> `PlanItem`
- 업로드 -> `ImportBatch` / `ImportedRow` / `CollectedTransaction`
- 확정 -> `JournalEntry` / `JournalLine`
- 마감 -> `ClosingSnapshot` / `BalanceSnapshotLine`

### 8.6 Step 6

신규 흐름이 안정화되면 `Transaction` 의 직접 write를 중단한다.

이후 선택지:

- 읽기 모델로만 유지
- 또는 `JournalEntry` / `CollectedTransaction` 기반 조회로 교체 후 제거

---

## 9. 대표 시나리오와의 정합성

대표 시나리오인 다음 흐름과 1차 백본은 직접 연결된다.

1. Owner가 Tenant, Ledger, FundingAccount, Category, RecurringRule, OpeningBalanceSnapshot을 준비한다.
2. 월을 열어 `AccountingPeriod` 를 만든다.
3. System이 `RecurringRule` 을 바탕으로 `PlanItem` 을 생성한다.
4. Editor가 카드 엑셀을 업로드해 `ImportBatch`, `ImportedRow`, `CollectedTransaction` 을 만든다.
5. 사용자가 거래를 검토해 `ReadyToPost` 로 보낸다.
6. 시스템이 `JournalEntry` 와 `JournalLine` 을 생성하고, 연결된 `PlanItem` 이 있으면 `Confirmed` 로 끝낸다.
7. Owner가 월 마감을 실행한다.
8. 시스템이 `ClosingSnapshot` 과 `BalanceSnapshotLine` 을 만든다.
9. Phase 1B에서 `CarryForwardRecord` 와 `FinancialStatementSnapshot` 을 붙여 시나리오를 완결한다.

즉 Phase 1A만으로도 핵심 회계 운영은 시작할 수 있고, Phase 1B를 붙이면 문서상 대표 시나리오와 완전히 맞물린다.

---

## 10. 지금 구현에 바로 들어갈 때의 원칙

### 10.1 이번 라운드에서 먼저 건드릴 Prisma 축

- `Tenant`
- `TenantMembership`
- `Ledger`
- `AccountingPeriod`
- `PeriodStatusHistory`
- `AccountSubject`
- `TransactionType`
- `Account` 확장
- `Category` 확장
- `RecurringRule` 확장
- `PlanItem`
- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`
- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

### 10.2 이번 라운드에서 아직 크게 손대지 않을 축

- `AuthSession`
- 프런트의 기존 보험/차량 도메인
- `CarryForwardRecord`
- `FinancialStatementSnapshot`
- SaaS 운영 확장 엔티티

### 10.3 금지 원칙

- `Transaction` 을 회계 진실 원천으로 승격하지 않는다.
- `CollectedTransaction` 과 `JournalEntry` 를 합치지 않는다.
- `Tenant` 와 `Ledger` 를 동일 개념으로 합치지 않는다.
- 마감 총계만 저장하고 상세 잔액(`BalanceSnapshotLine`) 을 생략하지 않는다.

---

## 11. 최종 결론

지금 시점의 가장 안전한 선택은 다음과 같다.

- **DB 전체를 한 번에 대대적으로 갈아엎지 않는다.**
- **하지만 회계 백본은 지금 바로 추가한다.**
- **대표 시나리오에 필요한 백본부터 올리고, 기능은 그 위에서 세로 슬라이스로 구현한다.**

이 방식이면 도메인 문서와 실제 스키마의 간극을 줄이면서도, 현재 앱의 로그인/기존 CRUD/데모 흐름을 한 번에 깨지 않고 이행할 수 있다.
