# 핵심 엔티티 정의서

## 전표 기반 1인 사업자·소상공인 월별 재무 운영 시스템 (SaaS 운영 반영 / 구현 보강)

---

## 1. 문서 목적

본 문서는 비즈니스 로직 설계 초안을 기준으로, 본 프로젝트의 핵심 엔티티를 **실무적으로 구현 가능한 수준**으로 구체화한 정의서다.

이 문서의 목적은 다음과 같다.

- 어떤 데이터가 단순 참조 데이터인지, 어떤 데이터가 도메인 엔티티인지 구분한다.
- 어떤 엔티티가 Aggregate Root가 되어야 하는지 정한다.
- 각 엔티티의 책임, 상태, 필수 속성, 불변조건을 정의한다.
- SaaS 운영을 위한 **Platform User / Tenant / Membership / Actor 경계**를 회계 도메인과 충돌 없이 반영한다.
- 이후 유스케이스/상태 흐름표/DB 모델링 단계에서 흔들리지 않도록 기준을 고정한다.

이 문서는 **화면 설계 문서가 아니며**, **핵심 도메인 모델 문서**다.

---

## 2. 설계 전제

### 2.1 프로젝트 전제

본 시스템은 **1인 사업자와 소상공인의 월별 재무 운영을 계획하고, 실제 사업 거래를 수집·검토·확정하여 전표로 전기하고, 결산과 재무제표 산출 및 차기 이월까지 수행하는 전표 기반 월별 재무 운영 시스템**이다.

### 2.2 SaaS 전제

본 시스템은 SaaS 운영을 목표로 하므로, 회계 도메인 바깥에 다음 플랫폼 경계가 존재한다.

- `PlatformUser`: 플랫폼 로그인 사용자
- `Tenant`: 고객 데이터/과금/운영 단위
- `TenantMembership`: 사용자와 Tenant 사이의 역할 관계
- `TenantInvitation`: 멤버 초대 흐름
- `TenantSubscription`: 구독/플랜/과금 상태 경계
- `SupportAccessGrant`: 지원 인력의 제한적 접근 허용 경계
- `ActorRef`: 모든 쓰기 작업의 실행 주체 추적

### 2.3 핵심 원칙

- 전표가 회계적 진실의 단일 원천이다.
- 계획 데이터와 확정 데이터는 분리한다.
- 수집 데이터와 확정 데이터는 분리한다.
- 손익 거래와 비손익 거래를 구분한다.
- 기간 단위 운영과 마감/잠금이 존재한다.
- 사용자 자유 분개 규칙 편집은 초기 범위에서 제외한다.
- **모든 회계 데이터는 Tenant 경계 안에 존재한다.**
- **모든 쓰기 작업은 Actor를 남긴다.**

### 2.4 엔티티 분류 원칙

본 프로젝트의 엔티티는 다음 여섯 층으로 분류한다.

1. 플랫폼/SaaS 데이터
2. 기준 데이터
3. 계획 데이터
4. 수집 데이터
5. 확정 데이터
6. 보고 데이터

---

## 3. 엔티티 설계 원칙

### 3.1 Aggregate Root 우선 설계

다음 엔티티는 독립적인 생명주기와 강한 불변조건을 가지므로 Aggregate Root로 본다.

#### 플랫폼/SaaS Aggregate Root

- `PlatformUser`
- `Tenant`
- `TenantMembership`
- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`

#### 회계 도메인 Aggregate Root

- `Ledger`
- `AccountingPeriod`
- `FundingAccount`
- `RecurringRule`
- `PlanItem`
- `ImportBatch`
- `CollectedTransaction`
- `JournalEntry`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `CarryForwardRecord`
- `FinancialStatementSnapshot`
- `PeriodStatusHistory`

### 3.2 자식 엔티티 / Value Object

다음은 단독 생명주기를 갖기보다 상위 엔티티에 종속되거나 값 객체로 다루는 것이 자연스럽다.

- `JournalLine`
- `ImportedRow`
- `BalanceSnapshotLine`
- `Money`
- `DateRange`
- `PostingRuleRef`
- `LedgerMonth`
- `SourceFingerprint`
- `ActorRef`

### 3.3 읽기 모델은 엔티티와 구분

다음은 핵심 쓰기 모델이 아니라 read projection으로 취급한다.

- `BalanceSheetView`
- `MonthlyPnLView`
- `CashflowSummaryView`
- `NetWorthTrendView`
- `DashboardSummaryView`

즉, 재무제표 산출 결과는 중요하지만 **핵심 write-domain entity**로 두기보다 projection/snapshot 관점으로 다룬다.

### 3.4 자동전표 정책의 위치

`PostingPolicy`는 엔티티가 아니라 **도메인 정책/서비스 객체**로 본다.
`TransactionType`은 `postingPolicyKey`를 통해 어떤 자동전표 정책을 사용할지 식별한다.
즉, 자동전표 규칙은 사용자 CRUD 대상이 아니라 **내부 정책 객체와 기준 데이터의 조합**으로 운영한다.

### 3.5 멀티테넌시 구현 원칙

도메인 책임상 Ledger가 회계 귀속의 중심이지만, **SaaS 운영과 데이터 격리**를 위해 persistence 설계에서는 각 Aggregate Root에 `tenantId`를 보존하는 것을 권장한다.

이유:

- row-level security 적용 용이
- 인덱싱/조회 최적화
- 운영/감사 추적성 향상
- 지원 접근 통제 용이

### 3.6 금액 정밀도와 반올림 정책

본 프로젝트는 초기 범위에서 외화 회계를 제외하므로, **모든 회계 금액은 Ledger의 `baseCurrency` 기준 최소 통화단위(minor unit) 정수값으로 확정/저장**하는 것을 원칙으로 한다.

기본 정책:

- KRW 장부는 `1원` 단위 정수 금액만 저장한다.
- 수집/배분/비율 계산 과정에서 소수점이 생기더라도, **영속 엔티티에는 반올림 완료 금액만 저장**한다.
- 반올림 기준은 기본적으로 `HALF_UP`(사사오입)으로 한다.
- 여러 라인으로 배분하는 계산에서 반올림 차이가 생기면, 총액 일치를 위해 **마지막 라인 또는 정책상 지정된 조정 라인에 잔여 차이**를 몰아 보정한다.
- 반올림은 화면 표시마다 반복 적용하지 않고, **전표 라인 확정 또는 스냅샷 생성 시점**에 한 번만 확정한다.

즉, 조회/보고는 이미 확정된 금액을 사용해야 하며, 보고 단계에서 다시 다른 반올림 규칙을 적용해 원장·스냅샷과 불일치가 발생하면 안 된다.

---

## 4. 전체 엔티티 지도

### 4.1 플랫폼/SaaS 데이터

- `PlatformUser`
- `Tenant`
- `TenantMembership`
- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`

### 4.2 기준 데이터

- `Ledger`
- `AccountSubject`
- `TransactionType`
- `FundingAccount`
- `Category`

### 4.3 계획 데이터

- `RecurringRule`
- `PlanItem`

### 4.4 수집 데이터

- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`

### 4.5 확정 데이터

- `AccountingPeriod`
- `PeriodStatusHistory`
- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`
- `CarryForwardRecord`

### 4.6 보고 데이터

- `FinancialStatementSnapshot`
- `DashboardSummaryView`

---

## 5. 플랫폼/SaaS 핵심 엔티티

## 5.1 PlatformUser

### 역할

SaaS 플랫폼에 로그인하는 사용자다.  
인증 주체이며, 여러 Tenant에 참여할 수 있다.

### 필수 속성

- `platformUserId`
- `email`
- `displayName`
- `authProvider`
- `platformRole` (`CustomerUser`, `PlatformAdmin`, `SupportReadonly`)
- `status` (`Invited`, `Active`, `Suspended`, `Deleted`)
- `lastLoginAt`
- `createdAt`
- `updatedAt`

### 불변조건

- 이메일은 플랫폼 전체에서 유일해야 한다.
- 하나의 PlatformUser는 여러 TenantMembership을 가질 수 있다.
- `SupportReadonly`는 고객 데이터 쓰기 권한을 직접 가지지 않는다.

---

## 5.2 Tenant

### 역할

고객 데이터와 운영/과금/격리 경계를 나타내는 SaaS 단위다.  
회계 데이터는 반드시 하나의 Tenant에 귀속된다.

### 필수 속성

- `tenantId`
- `slug`
- `name`
- `tenantType` (`Personal`, `Shared`)
- `status` (`Trial`, `Active`, `Suspended`, `Archived`)
- `defaultLedgerId` (nullable)
- `createdAt`
- `updatedAt`

### 불변조건

- 하나의 Ledger는 정확히 하나의 Tenant에 속한다.
- Archived 또는 Suspended Tenant는 신규 쓰기 작업이 제한된다.
- `slug`는 플랫폼 내에서 유일해야 한다.

### 실무 포인트

초기 제품은 Tenant당 기본 1 Ledger 운영을 전제로 두되, Ledger 엔티티를 분리해두면 테스트/격리/향후 확장성 측면에서 유리하다.

---

## 5.3 TenantMembership

### 역할

특정 사용자가 특정 Tenant 안에서 어떤 역할을 가지는지를 나타낸다.  
모든 권한 판단의 핵심 기준이다.

### 필수 속성

- `membershipId`
- `tenantId`
- `platformUserId`
- `tenantRole` (`Owner`, `Manager`, `Editor`, `Viewer`)
- `status` (`Invited`, `Active`, `Suspended`, `Removed`)
- `joinedAt`
- `invitedByMembershipId` (nullable)
- `lastAccessAt`

### 불변조건

- 같은 Tenant 안에서 동일 사용자의 중복 Active Membership은 허용되지 않는다.
- Tenant에는 최소 1명의 Owner가 존재해야 한다.
- Removed 상태 Membership은 회계 쓰기 작업의 실행 주체가 될 수 없다.

### 실무 포인트

회계 데이터 권한은 `platformRole`이 아니라 `tenantRole`을 기준으로 판단하는 것이 맞다.

---

## 5.4 TenantInvitation

### 역할

새 사용자를 Tenant에 초대하는 흐름을 관리한다.

### 필수 속성

- `tenantInvitationId`
- `tenantId`
- `inviteeEmail`
- `targetRole`
- `status` (`Pending`, `Accepted`, `Expired`, `Cancelled`)
- `expiresAt`
- `invitedByMembershipId`
- `acceptedByPlatformUserId` (nullable)

### 불변조건

- 만료된 초대는 재사용할 수 없다.
- Accepted 상태 초대는 정확히 하나의 Membership 생성으로 귀결되어야 한다.

---

## 5.5 TenantSubscription

### 역할

Tenant의 과금/플랜/상태를 나타내는 SaaS 운영 엔티티다.  
회계 도메인 자체에는 직접 관여하지 않지만, 기능 사용 가능 범위와 운영 제한을 제어한다.

### 필수 속성

- `tenantSubscriptionId`
- `tenantId`
- `planCode`
- `billingCycle`
- `status` (`Trial`, `Active`, `PastDue`, `Suspended`, `Canceled`)
- `startedAt`
- `currentPeriodStart`
- `currentPeriodEnd`
- `suspendedAt` (nullable)
- `canceledAt` (nullable)

### 불변조건

- 하나의 Tenant는 동일 시점에 하나의 유효 구독만 가져야 한다.
- `Suspended` 또는 `Canceled` 상태는 신규 Ledger 생성/마감/내보내기 등의 정책 제한 근거가 될 수 있다.

### 실무 포인트

회계 도메인과 직접 결합하지 않되, SaaS 운영 정책과 접근 제어에서 중요하다.

---

## 5.6 SupportAccessGrant

### 역할

지원 인력이나 운영자가 특정 Tenant에 제한적으로 접근할 수 있도록 허용하는 엔티티다.

### 필수 속성

- `supportAccessGrantId`
- `tenantId`
- `granteePlatformUserId`
- `scope` (`Readonly`, `SupportDebug`, `EmergencyWrite`)
- `reason`
- `approvedByActorRef`
- `grantedAt`
- `expiresAt`
- `revokedAt` (nullable)
- `status` (`Active`, `Expired`, `Revoked`)

### 불변조건

- 만료 시간이 지난 접근 허용은 유효하지 않다.
- 기본 정책은 읽기 전용이며, 쓰기 접근은 예외적이어야 한다.
- 모든 지원 접근은 사유와 승인 주체를 남겨야 한다.

### 실무 포인트

SaaS 운영을 실제로 할 생각이라면, 지원 접근은 멤버십과 별개 모델로 두는 게 안전하다.

---

## 5.7 ActorRef (Value Object)

### 역할

모든 쓰기 작업이 **누가 어떤 경로로 수행했는지**를 추적하기 위한 값 객체다.

### 필드

- `actorType` (`TenantMembership`, `PlatformSupport`, `System`)
- `actorId`
- `platformUserId` (nullable)
- `tenantId` (nullable)

### 실무 포인트

`createdBy`, `reviewedBy`, `lockedBy` 같은 필드는 단순 userId보다 `ActorRef`로 모델링하는 것이 SaaS 운영/감사/지원 통제에 더 적합하다.

---

## 6. 회계 도메인 핵심 엔티티

## 6.1 Ledger

### 역할

1인 사업자·소상공인 월별 재무 운영 시스템의 최상위 회계 단위다.  
모든 기간/계정/전표/재무제표는 Ledger를 기준으로 귀속된다.

### 필수 속성

- `ledgerId`
- `tenantId`
- `name`
- `baseCurrency`
- `timeZone`
- `fiscalMonthStartRule`
- `status` (`Active`, `Archived`)
- `createdAt`
- `updatedAt`

### 불변조건

- 하나의 전표, 기간, 계정, 반복 규칙은 반드시 하나의 Ledger에 속한다.
- 기본 통화와 타임존은 장부 단위 기준값이다.
- Archived 상태에서는 신규 기간 개시나 신규 전표 확정이 제한된다.

### 실무 포인트

기존의 `ownerUserId` 직접 소유 모델보다 `tenantId` 기반 귀속 모델이 SaaS에 더 자연스럽다.

---

## 6.2 AccountingPeriod

### 역할

하나의 Ledger 안에서 월별 운영과 결산/마감을 관리하는 기간 엔티티다.  
월 운영 시작, 가결산, 마감, 잠금, 차기 이월의 기준이 된다.

### 필수 속성

- `periodId`
- `tenantId`
- `ledgerId`
- `year`
- `month`
- `status` (`Open`, `InReview`, `Closing`, `Locked`)
- `openedAt`
- `lockedAt` (nullable)
- `openedByActorRef`
- `lockedByActorRef` (nullable)
- `openingBalanceSnapshotId` (nullable)
- `closingSnapshotId` (nullable)
- `lastLifecycleEventId` (nullable)

### 불변조건

- 하나의 Ledger 안에서 동일 연월 Period는 유일해야 한다.
- `Locked` 상태 Period는 일반 수정이 금지된다.
- 전월 이월 없이 새 Period를 임의로 열 수 없도록 정책화할 수 있다.
- Period의 상태 변경은 `PeriodStatusHistory`를 통해 이력으로 남겨야 한다.
- 재오픈은 최신 `Locked` 기간에만 허용하고, 이미 `CarryForwardRecord` 또는 다음 기간 `OpeningBalanceSnapshot`이 생성된 상태라면 차단하는 것이 안전하다.

### 실무 포인트

v1 문서에서는 관계와 우선순위에만 등장하고 별도 정의가 없었으므로, SaaS/회계 양쪽 관점에서 반드시 명시돼야 한다.

---

## 6.3 AccountSubject

### 역할

전표 라인이 귀속되는 계정과목이다.  
손익/재산상태표/현금흐름 보고의 기준 체계가 된다.

### 성격

- 기준 데이터
- 내부 시스템 마스터
- 일반 사용자 CRUD 화면은 초기 범위에 없음

### 필수 속성

- `accountSubjectId`
- `tenantId`
- `ledgerId`
- `code`
- `name`
- `accountClass` (`Asset`, `Liability`, `Equity`, `Revenue`, `Expense`)
- `statementSection`
- `normalBalanceSide` (`Debit`, `Credit`)
- `isPostingAllowed`
- `isSystemManaged`
- `isActive`

### 불변조건

- 동일 Ledger 내 `code`는 유일해야 한다.
- `accountClass`와 `normalBalanceSide`는 일관되어야 한다.
- `isSystemManaged = true`인 계정은 사용자 임의 수정 대상이 아니다.

---

## 6.4 TransactionType

### 역할

업무 이벤트를 회계 정책으로 연결하는 내부 거래유형 기준 데이터다.  
자동전표 규칙 선택의 기준이 된다.

### 필수 속성

- `transactionTypeId`
- `tenantId`
- `ledgerId`
- `code`
- `name`
- `businessClass`
- `postingPolicyKey`
- `requiresReview`
- `isIncomeAffecting`
- `isExpenseAffecting`
- `isSystemManaged`
- `isActive`

### 불변조건

- 하나의 CollectedTransaction 또는 PlanItem은 정확히 하나의 TransactionType으로 귀결된다.
- 거래유형은 손익/비손익 성격과 자동전표 정책을 함께 결정해야 한다.
- 카드 사용과 카드 대금 결제는 반드시 다른 거래유형이어야 한다.
- `postingPolicyKey`는 엔티티 자체가 아닌 내부 도메인 정책 객체를 식별하는 키여야 한다.

---

## 6.5 FundingAccount

### 역할

실제 자금이 움직이는 수단이다.  
현금, 은행계좌, 카드, 투자계좌, 대출계정 등 실무상 “지갑/계좌/수단”으로 인식되는 객체다.

### 필수 속성

- `fundingAccountId`
- `tenantId`
- `ledgerId`
- `name`
- `accountKind` (`Cash`, `Bank`, `Card`, `Investment`, `Loan`, `Etc`)
- `linkedAccountSubjectId`
- `institutionName`
- `maskedNumber`
- `settlementCycle`
- `status` (`Active`, `Inactive`, `Closed`)
- `createdByActorRef`
- `openedAt`
- `closedAt`

### 불변조건

- 하나의 FundingAccount는 하나의 대표 AccountSubject와 연결된다.
- 카드 계정은 일반 예금 계정과 다른 정산 정책을 가져야 한다.
- Closed 상태 계정은 신규 거래 연결이 불가하다.

---

## 6.6 Category

### 역할

사용자가 이해하기 쉬운 운영 분류 기준이다.  
손익 분석, 예산 분석, 대시보드, 카드 업로드 자동 분류 등에 사용된다.

### 필수 속성

- `categoryId`
- `tenantId`
- `ledgerId`
- `name`
- `categoryGroup`
- `direction` (`Income`, `Expense`, `Both`)
- `defaultExpenseAccountSubjectId`
- `defaultRevenueAccountSubjectId`
- `isSystemDefault`
- `isActive`

### 불변조건

- Category는 회계 계정과 1:1일 필요는 없지만, 최소한 기본 매핑 기준은 가져야 한다.
- Expense 전용 카테고리는 Revenue 계정으로 직접 연결되지 않는다.
- 비손익 거래는 Category 없이도 존재할 수 있다.

---

## 6.7 RecurringRule

### 역할

매월 또는 특정 주기에 반복 발생하는 계획성 거래의 발생 규칙이다.  
월 운영 초안을 생성하는 기준이 된다.

### 필수 속성

- `recurringRuleId`
- `tenantId`
- `ledgerId`
- `name`
- `transactionTypeId`
- `categoryId`
- `fundingAccountId`
- `amount`
- `cycleType` (`Monthly`, `Weekly`, `SpecificDay`, `BillingCycle`)
- `dayRule`
- `startDate`
- `endDate`
- `autoCreatePlan`
- `autoPostPolicy`
- `status` (`Active`, `Paused`, `Ended`)
- `createdByActorRef`

### 불변조건

- 종료일이 시작일보다 앞설 수 없다.
- 비활성 규칙은 초안을 생성하지 않는다.
- 하나의 규칙은 계획 생성의 기준이지 전표 자체가 아니다.

---

## 6.8 PlanItem

### 역할

특정 월에 생성된 **운영 초안 항목**이다.  
반복 규칙 또는 운영 계획에서 파생되며, 실제 거래와 매칭되어 종료된다.

### 필수 속성

- `planItemId`
- `tenantId`
- `ledgerId`
- `periodId`
- `sourceRecurringRuleId` (nullable)
- `transactionTypeId`
- `categoryId`
- `fundingAccountId`
- `plannedAmount`
- `plannedDate`
- `status` (`Draft`, `Matched`, `Confirmed`, `Skipped`, `Expired`)
- `matchedCollectedTransactionId` (nullable)
- `postedJournalEntryId` (nullable)
- `note`

### 불변조건

- PlanItem은 전표가 아니다.
- 같은 규칙으로 동일 월에 중복 초안 생성이 되면 안 된다.
- `Confirmed`는 운영상 종료 상태이며, 실제 전표 확정과 연결되어야 한다.
- 기간 종료 후 미처리 항목은 `Expired` 또는 `Skipped`로 종료되어야 한다.

---

## 6.9 ImportBatch

### 역할

카드/계좌 엑셀 업로드 또는 외부 거래 파일 수집의 단위 배치다.

### 필수 속성

- `importBatchId`
- `tenantId`
- `ledgerId`
- `sourceType` (`CardExcel`, `BankExcel`, `Csv`, `ManualImport`)
- `uploadedByActorRef`
- `sourceFileName`
- `sourceFileHash`
- `importedAt`
- `rowCount`
- `successCount`
- `errorCount`
- `status` (`Uploaded`, `Parsed`, `Validated`, `Completed`, `Failed`)

### 불변조건

- 하나의 ImportBatch는 원본 파일 단위 추적이 가능해야 한다.
- 동일 파일 재업로드 감지에 필요한 최소 정보(hash 등)를 가져야 한다.
- 배치 단위 오류와 행 단위 오류를 구분할 수 있어야 한다.

---

## 6.10 ImportedRow

### 역할

업로드 원본 파일의 행 단위 원본 정보다.  
파싱된 결과와 원본 추적을 보존하기 위해 ImportBatch에 종속된다.

### 필수 속성

- `importedRowId`
- `importBatchId`
- `rowNumber`
- `rawPayload`
- `parsedDate`
- `parsedAmount`
- `parsedDescription`
- `parseStatus`
- `parseErrorMessage`

### 불변조건

- ImportedRow는 원본 보존 목적이며, 회계 확정 데이터가 아니다.
- `parseStatus = Failed`인 행은 `CollectedTransaction`으로 승격되면 안 된다.

---

## 6.11 CollectedTransaction

### 역할

실제 거래 후보를 나타내는 핵심 수집 엔티티다.  
업로드 또는 수기 입력으로 들어오며, 검토 후 전표로 확정된다.

### 필수 속성

- `collectedTransactionId`
- `tenantId`
- `ledgerId`
- `sourceKind` (`Import`, `Manual`, `SystemGenerated`)
- `importBatchId` (nullable)
- `sourceFingerprint`
- `occurredAt`
- `amount`
- `direction` (`Inflow`, `Outflow`, `Neutral`)
- `description`
- `transactionTypeId` (nullable until classified)
- `categoryId` (nullable)
- `fundingAccountId`
- `counterpartyHint`
- `status` (`Collected`, `Reviewed`, `ReadyToPost`, `Posted`, `Corrected`, `Locked`)
- `matchedPlanItemId` (nullable)
- `postedJournalEntryId` (nullable)
- `createdByActorRef`
- `reviewedByActorRef` (nullable)
- `reviewedAt` (nullable)

### 불변조건

- 하나의 CollectedTransaction은 최대 하나의 전표에 원천 거래로 연결된다.
- `Posted` 상태이면 `postedJournalEntryId`가 반드시 존재해야 한다.
- `ReadyToPost` 상태는 전표 생성에 필요한 최소 필드가 채워져 있어야 한다.
- 손익 성격 거래유형은 `categoryId`가 확정되기 전까지 `ReadyToPost`가 될 수 없다.
- 동일 SourceFingerprint는 중복 후보 판단 근거가 된다.

### 시작 원칙

- 업로드 거래는 기본적으로 `Collected`에서 시작한다.
- 직접 입력 거래는 현재 구현 기준으로 `TRANSFER`이거나 Category가 이미 확정되어 있으면 `ReadyToPost`에서 시작한다.
- 손익 거래인데 Category가 비어 있으면 `Reviewed`에서 시작한다.

---

## 6.12 JournalEntry

### 역할

회계적으로 확정된 전표 헤더다.  
본 시스템의 단일 진실 원천이며, 재무제표와 집계의 기준이 된다.

### 필수 속성

- `journalEntryId`
- `tenantId`
- `ledgerId`
- `periodId`
- `entryNo`
- `entryDate`
- `postingDate`
- `entryType` (`Normal`, `Opening`, `CarryForward`, `Adjustment`, `Correction`, `Reversal`)
- `sourceKind` (`CollectedTransaction`, `PlanSettlement`, `OpeningBalance`, `CarryForward`, `ManualAdjustment`)
- `sourceRefId`
- `status` (`Posted`, `Reversed`, `Locked`)
- `summary`
- `createdByActorRef`
- `postedAt`
- `reversesJournalEntryId` (nullable)
- `correctsJournalEntryId` (nullable)
- `correctionReason` (nullable)

### 불변조건

- 차변 합계와 대변 합계는 반드시 일치해야 한다.
- 최소 2개 이상의 JournalLine을 가져야 한다.
- `Posted` 상태 전표는 일반 수정이 불가하다.
- `Reversal` 전표는 원본 전표를 `reversesJournalEntryId`로 참조해야 한다.
- `Correction` 또는 `Adjustment` 전표는 필요 시 `correctsJournalEntryId`와 `correctionReason`을 가져야 한다.
- 확정 후 취소는 `Reversal`로, 내용 정정은 `Correction` 또는 `Adjustment`로 처리하는 것이 기본 정책이다.
- 마감 후 기간의 전표는 신규 생성/수정 정책이 제한된다.
- 합계 검증은 반올림 완료된 JournalLine 금액 기준으로 수행해야 한다.

---

## 6.13 JournalLine

### 역할

전표의 차변/대변 라인이다.  
회계 계정 반영의 최소 단위다.

### 필수 속성

- `journalLineId`
- `journalEntryId`
- `lineNo`
- `accountSubjectId`
- `debitAmount`
- `creditAmount`
- `fundingAccountId` (nullable)
- `categoryId` (nullable)
- `memo`

### 불변조건

- 하나의 라인은 debit 또는 credit 한쪽만 양수여야 한다.
- 둘 다 0이거나 둘 다 양수일 수 없다.
- 상위 JournalEntry 차원에서 차대변 합계 균형이 맞아야 한다.
- `debitAmount`와 `creditAmount`는 Ledger 최소 통화단위로 반올림 완료된 값이어야 한다.

---

## 6.14 OpeningBalanceSnapshot

### 역할

프로젝트 최초 시작 또는 특정 기간 시작 시점의 오프닝 재무 상태를 보존하는 엔티티다.

### 필수 속성

- `openingBalanceSnapshotId`
- `tenantId`
- `ledgerId`
- `effectivePeriodId`
- `createdAt`
- `sourceKind` (`InitialSetup`, `CarryForward`)
- `createdByActorRef`
- `status`

### 불변조건

- 최초 월 운영 시작 전에는 OpeningBalanceSnapshot이 반드시 존재해야 한다.
- CarryForward로 생성된 오프닝은 이전 ClosingSnapshot과 논리적으로 이어져야 한다.
- 상세 잔액은 `BalanceSnapshotLine`으로 보존해야 한다.

---

## 6.15 ClosingSnapshot

### 역할

특정 기간 마감 시점의 확정 잔액과 핵심 요약값을 보존하는 엔티티다.

### 필수 속성

- `closingSnapshotId`
- `tenantId`
- `ledgerId`
- `periodId`
- `closedAt`
- `lockedByActorRef`
- `status`
- `totalAssets`
- `totalLiabilities`
- `netWorth`
- `periodProfitOrLoss`

### 불변조건

- ClosingSnapshot은 `Locked` 기간에 대해서만 생성된다.
- ClosingSnapshot 값은 마감 시점 전표 기준과 일치해야 한다.
- 상세 잔액은 `BalanceSnapshotLine`으로 계정별/자금수단별 기준을 보존해야 한다.
- 차기 이월은 ClosingSnapshot을 근거로 생성된다.
- `totalAssets`, `totalLiabilities`, `netWorth`, `periodProfitOrLoss`는 별도 표시용 반올림값이 아니라 원장 집계 후 확정된 최소 통화단위 금액이어야 한다.

---

## 6.16 BalanceSnapshotLine

### 역할

오프닝/클로징 스냅샷의 상세 잔액 라인이다.  
계정별, 필요 시 자금수단별 잔액을 보존하여 차기 이월과 검증에 사용한다.

### 필수 속성

- `balanceSnapshotLineId`
- `tenantId`
- `ledgerId`
- `snapshotKind` (`Opening`, `Closing`)
- `openingBalanceSnapshotId` (nullable)
- `closingSnapshotId` (nullable)
- `accountSubjectId`
- `fundingAccountId` (nullable)
- `balanceAmount`
- `balanceSide` (`Debit`, `Credit`)
- `memo` (nullable)

### 불변조건

- 하나의 라인은 Opening 또는 Closing 중 한 스냅샷에만 속해야 한다.
- 하나의 스냅샷 안에서 동일 계정/동일 자금수단 조합은 유일해야 한다.
- CarryForward는 Closing 기준 BalanceSnapshotLine을 바탕으로 생성되어야 한다.
- `balanceAmount`는 Ledger 최소 통화단위 기준으로 저장되어야 하며, 스냅샷 생성 시 추가 반올림으로 총계가 바뀌면 안 된다.

---

## 6.17 CarryForwardRecord

### 역할

전기 마감 결과를 다음 월 오프닝으로 이월한 기록이다.

### 필수 속성

- `carryForwardRecordId`
- `tenantId`
- `ledgerId`
- `fromPeriodId`
- `toPeriodId`
- `sourceClosingSnapshotId`
- `createdJournalEntryId` (nullable)
- `createdByActorRef`
- `createdAt`

### 불변조건

- 한 기간에서 다음 기간으로의 이월은 중복 생성되면 안 된다.
- 자산/부채/순자산 중심 이월이어야 하며 손익 계정은 직접 이월하지 않는다.
- CarryForward는 이전 기간의 ClosingSnapshot 및 BalanceSnapshotLine과 논리적으로 일치해야 한다.

---

## 6.18 PeriodStatusHistory

### 역할

AccountingPeriod의 상태 전이 이력을 남기는 엔티티다.  
오픈, 검토, 마감, 재오픈, 잠금 등 기간 운영 이벤트를 감사 가능하게 만든다.

### 필수 속성

- `periodStatusHistoryId`
- `tenantId`
- `ledgerId`
- `periodId`
- `fromStatus` (nullable)
- `toStatus`
- `eventType` (`Open`, `MoveToReview`, `StartClosing`, `Lock`, `Reopen`, `ForceLock`)
- `reason` (nullable)
- `changedByActorRef`
- `changedAt`

### 불변조건

- 모든 Period 상태 전이는 최소 하나의 PeriodStatusHistory를 남겨야 한다.
- `Reopen` 이벤트는 기본 운영 흐름이 아니라 예외 이벤트로 취급한다.
- `Locked` 상태에서 다시 상태를 바꾸는 경우 반드시 사유가 필요하다.

---

## 6.19 FinancialStatementSnapshot

### 역할

마감된 전표를 기준으로 산출된 재무제표 결과를 시점별로 보존하는 보고 스냅샷이다.

### 필수 속성

- `financialStatementSnapshotId`
- `tenantId`
- `ledgerId`
- `periodId`
- `statementType` (`BalanceSheet`, `PnL`, `Cashflow`, `NetWorthChange`)
- `version`
- `generatedByActorRef`
- `generatedAt`
- `payload`

### 불변조건

- 공식 FinancialStatementSnapshot은 `Locked` 기간에 대해서만 확정 생성한다.
- 결산 전 미리보기 리포트는 별도 read model로 제공할 수 있으나, 공식 스냅샷과 혼동하지 않는다.
- 공식 재무제표 숫자는 JournalEntry/ClosingSnapshot 기준 확정 금액을 그대로 사용해야 하며, 별도 보고용 반올림으로 원장과 불일치하면 안 된다.

---

## 6.20 Money (Value Object)

### 역할

회계 금액의 통화, 저장 단위, 비교 규칙을 일관되게 다루기 위한 값 객체다.  
수집 거래, 전표 라인, 스냅샷 금액 필드는 모두 동일한 Money 정책을 따라야 한다.

### 필드

- `currency`
- `amountInMinorUnit`

### 불변조건

- `currency`는 기본적으로 Ledger의 `baseCurrency`와 일치해야 한다.
- `amountInMinorUnit`은 최소 통화단위 기준 정수여야 한다.
- KRW 기준 영속 금액에는 소수점이 존재할 수 없다.
- 계산 중간값은 임시 정밀도로 처리할 수 있지만, 엔티티 저장 전에는 반드시 반올림 정책을 적용해야 한다.
- 여러 금액을 분할해 생성한 라인의 합은 원본 총액과 정확히 일치해야 한다.

---

## 7. 엔티티 간 관계

### 7.1 플랫폼 관계

- `PlatformUser` 1 - N `TenantMembership`
- `Tenant` 1 - N `TenantMembership`
- `Tenant` 1 - N `TenantInvitation`
- `Tenant` 1 - N `TenantSubscription`
- `Tenant` 1 - N `SupportAccessGrant`
- `Tenant` 1 - N `Ledger`

### 7.2 회계 도메인 핵심 관계

- `Ledger` 1 - N `FundingAccount`
- `Ledger` 1 - N `Category`
- `Ledger` 1 - N `RecurringRule`
- `Ledger` 1 - N `AccountingPeriod`
- `RecurringRule` 1 - N `PlanItem`
- `ImportBatch` 1 - N `ImportedRow`
- `ImportBatch` 1 - N `CollectedTransaction`
- `CollectedTransaction` 0..1 - 1 `PlanItem`
- `CollectedTransaction` 0..1 - 1 `JournalEntry`
- `JournalEntry` 1 - N `JournalLine`
- `AccountingPeriod` 1 - N `JournalEntry`
- `AccountingPeriod` 1 - N `PeriodStatusHistory`
- `AccountingPeriod` 1 - 1 `ClosingSnapshot`
- `AccountingPeriod` 1 - N `FinancialStatementSnapshot`
- `OpeningBalanceSnapshot` 1 - N `BalanceSnapshotLine`
- `ClosingSnapshot` 1 - N `BalanceSnapshotLine`
- `ClosingSnapshot` 1 - 1 `CarryForwardRecord`

### 7.3 관계 설계 원칙

- 실제 원천 거래는 CollectedTransaction에 남기고, 회계 확정은 JournalEntry에 남긴다.
- PlanItem은 계획 데이터이며 직접 재무제표 기준이 되지 않는다.
- FinancialStatementSnapshot은 JournalEntry/ClosingSnapshot을 근거로 생성된다.
- 모든 회계 엔티티는 Tenant 경계를 벗어나지 않는다.

---

## 8. 상태 흐름 관점의 엔티티 책임

### 8.1 플랫폼 단계

- `PlatformUser`
- `Tenant`
- `TenantMembership`
- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`

### 8.2 계획 단계

- `RecurringRule`
- `PlanItem`

### 8.3 수집 단계

- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`

### 8.4 확정 단계

- `JournalEntry`
- `JournalLine`

### 8.5 마감 단계

- `AccountingPeriod`
- `PeriodStatusHistory`
- `ClosingSnapshot`
- `BalanceSnapshotLine`
- `CarryForwardRecord`

### 8.6 보고 단계

- `FinancialStatementSnapshot`

---

## 9. 구현 우선순위

### 1차 구현 필수

#### SaaS 경계

- `PlatformUser`
- `Tenant`
- `TenantMembership`

#### 회계 도메인

- `Ledger`
- `AccountingPeriod`
- `AccountSubject`
- `TransactionType`
- `FundingAccount`
- `Category`
- `RecurringRule`
- `PlanItem`
- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`
- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`
- `CarryForwardRecord`
- `PeriodStatusHistory`
- `FinancialStatementSnapshot`

### 2차 구현 권장

- `TenantInvitation`

### 3차 확장

- `TenantSubscription`
- `SupportAccessGrant`
- `CategoryRule`
- `AutoMatchRule`
- `StatementLineMap`
- `AdjustmentWorkflow`

### 주의

비즈니스 로직 설계 초안 기준으로 보면, **업로드 수집 / 거래유형별 자동전표 / 차기 이월 / 재무제표 산출**은 핵심 흐름이므로 관련 엔티티는 1차 범위에 포함한다.

---

## 10. 실무 구현 시 유의점

### 10.1 엔티티와 테이블을 1:1로 고정하지 않는다

엔티티는 도메인 책임 기준이다.  
DB 설계에서는 일부를 합치거나 분리할 수 있다.

### 10.2 화면 존재 여부와 엔티티 존재 여부를 혼동하지 않는다

- `AccountSubject`, `TransactionType`은 엔티티/기준 데이터로는 필요하다.
- 그러나 일반 사용자에게 CRUD 화면을 꼭 열 필요는 없다.

### 10.3 CollectedTransaction과 JournalEntry를 합치지 않는다

이 둘을 합치는 순간:

- 업로드 원본 추적성
- 검토 단계
- 정정 정책
- 중복 처리
  가 모두 약해진다.

### 10.4 Period와 Snapshot은 반드시 남긴다

ERP다운 시스템은 “현재 상태 조회”만이 아니라 **기간 단위 확정 결과**가 남아야 한다.

### 10.5 SaaS에서는 Tenant와 Ledger를 분리한다

- Tenant는 운영/격리/과금 경계
- Ledger는 회계 귀속 경계
  이 둘을 분리해야 향후 운영과 확장이 유리하다.

### 10.6 Actor는 userId 하나로 끝내지 않는다

감사, 지원 접근, 시스템 배치까지 고려하면 `ActorRef` 모델이 훨씬 안전하다.

### 10.7 PostingPolicy는 엔티티가 아니라 정책 객체로 둔다

- `TransactionType.postingPolicyKey`는 정책 식별자다.
- 분개 규칙 자체를 사용자 CRUD 엔티티로 만들지 않는다.
- 자동전표 로직은 도메인 서비스/정책 객체에서 구현한다.

### 10.8 이월은 요약값이 아니라 상세 잔액 기준으로 수행한다

- `ClosingSnapshot`의 총계 수치만으로는 차기 이월이 부족하다.
- 계정별/필요 시 자금수단별 상세 잔액은 `BalanceSnapshotLine`으로 유지한다.
- 다음 기간 오프닝은 해당 상세 잔액 기준으로 생성한다.

### 10.9 상태 변경 이력은 엔티티로 남긴다

- 마감, 잠금, 재오픈은 단순 timestamp 업데이트로 끝내지 않는다.
- `PeriodStatusHistory`를 통해 감사 가능한 이력을 유지한다.

### 10.10 반올림 정책은 엔티티 바깥 정책이 아니라 도메인 규칙으로 고정한다

- 금액 반올림은 UI 포맷터나 보고서 계층에서 임의 처리하지 않는다.
- `Money`, `JournalLine`, `ClosingSnapshot`, `FinancialStatementSnapshot`이 동일한 반올림 기준을 공유해야 한다.
- 배분 과정의 반올림 잔차 처리 방식까지 문서화해야 월마감/재무제표/이월 수치가 흔들리지 않는다.

### 10.11 거래 확정은 CollectedTransaction 단위 트랜잭션으로 묶는다

- `CollectedTransaction` 하나의 `Posted` 전환, `JournalEntry`/`JournalLine` 생성, 관련 `PlanItem` 종료, `ActorRef` 기록은 하나의 write transaction으로 처리하는 것이 안전하다.
- 확정 직전에는 잠금 기간 여부, 현재 상태, 기존 `postedJournalEntryId` 존재를 transaction 경계 안에서 다시 확인해야 중복 확정과 반쪽 저장을 줄일 수 있다.
- 이 경계가 흔들리면 전표는 생성됐는데 원거래 상태가 남거나, 초안만 종료되는 식의 불일치가 생길 수 있다.
- `ImportBatch`는 파싱/수집 경계이지 회계 확정 경계가 아니다.

### 10.12 공식 마감은 Period 잠금과 Snapshot 생성을 함께 묶는다

- 운영 기간 오픈 시 `AccountingPeriod`, 최초 `PeriodStatusHistory`, 필요 시 `OpeningBalanceSnapshot` 생성도 하나의 write transaction으로 묶는 편이 안전하다.
- `AccountingPeriod` 상태 변경, `PeriodStatusHistory`, `ClosingSnapshot`, `BalanceSnapshotLine` 생성은 하나의 write transaction으로 묶는 것을 권장한다.
- 반면 `FinancialStatementSnapshot` 생성은 잠금 후 재실행 가능한 후처리로 분리하는 것이 안전하다.
- `CarryForwardRecord`와 다음 기간 오프닝 생성도 잠금 성공 후 별도 use case로 분리하되, `ClosingSnapshot`과 논리적으로 일치해야 한다.
- 재오픈은 마감 산출물 삭제만이 아니라, 이미 생성된 차기 이월/다음 기간 오프닝과 충돌하지 않는지도 함께 확인해야 한다.

### 10.13 업로드 오류와 중복 후보는 원천 엔티티에서 보존한다

- `ImportBatch`와 `ImportedRow`는 파싱 실패와 행 단위 오류를 남기는 책임을 가진다.
- `SourceFingerprint`는 자동 확정 트리거가 아니라 중복 후보 식별 근거로 사용한다.
- 동일 `SourceFingerprint`는 hard unique로 바로 차단하지 않고, duplicate candidate로 보류 판단하는 것이 현재 thin-first 정책에 맞다.
- 파싱 실패 행은 `CollectedTransaction`으로 승격하지 않는 것이 안전하다.
- 유일한 `PlanItem`이 맞고 category 보완이 가능하며 duplicate candidate가 없을 때만 `READY_TO_POST`까지 자동 준비한다.

---

## 11. 최종 정리

이 프로젝트의 핵심 엔티티 설계는 다음 철학을 따른다.

- 사용자는 Tenant Membership을 통해 권한을 가진다.
- Tenant는 데이터 격리의 최상위 경계다.
- Ledger는 회계 귀속의 최상위 경계다.
- 시스템은 실제 거래를 수집하고 검토한다.
- 확정된 거래만 전표로 반영한다.
- 전표가 회계적 진실의 단일 원천이 된다.
- 기간을 결산하고 잠근다.
- 정정, 재오픈, 마감 이력을 감사 가능하게 남긴다.
- 확정된 결과를 재무제표와 차기 이월로 연결한다.

즉, 본 프로젝트의 엔티티 설계는 **SaaS 운영을 위한 사용자/테넌트/멤버십 경계**와, **전표를 중심으로 월별 재무 운영 사이클을 닫는 회계 도메인**을 함께 만족하는 것을 목표로 한다.
