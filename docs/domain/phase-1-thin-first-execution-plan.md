# 1차 얇은 선구현 실행계획

## 1. 문서 목적

이 문서는 [business-logic-draft.md](./business-logic-draft.md), [core-entity-definition.md](./core-entity-definition.md), [phase-1-db-backbone-design.md](./phase-1-db-backbone-design.md), [phase-1-screen-implementation-order.md](./phase-1-screen-implementation-order.md)를 기준으로, 프로젝트 전반을 **엔티티 설계에 맞게 얇게 먼저 구현하고 이후 깊게 확장하는 실행 순서**를 고정하기 위한 계획서다.

여기서 말하는 전략은 다음과 같다.

- 코어 엔티티 전체를 한 번에 깊게 완성하지 않는다.
- 대신 핵심 엔티티 전반에 최소 동작 경로를 먼저 만든다.
- DB, API, 화면, 테스트를 엔티티 기준으로 함께 얇게 연결한다.
- 코어 회계 흐름이 끝까지 이어진 뒤에 자동화, 예외 처리, UX 고도화, 보조 도메인 확장을 깊게 넣는다.

즉 이 문서는 “무엇을 먼저 완벽하게 만들까”가 아니라, “어떤 순서로 전체 구조를 먼저 살아 있게 만들까”에 대한 기준이다.

---

## 2. 왜 이 방식이 맞는가

현재 프로젝트는 다음 상태에 가깝다.

- 도메인 문서와 엔티티 정의는 비교적 잘 정리되어 있다.
- Prisma와 실제 DB에도 1차 백본 구조가 상당 부분 반영되어 있다.
- 그러나 런타임 API와 화면은 아직 일부 엔티티만 얇게 연결된 과도기 상태다.

이 상태에서 특정 영역만 깊게 파기 시작하면 다음 문제가 생길 수 있다.

- `Transaction` 중심 레거시 흐름이 다시 커진다.
- `AccountingPeriod -> JournalEntry -> ClosingSnapshot` 코어 흐름이 뒤로 밀린다.
- 화면과 API가 엔티티 설계보다 앞서 독자적으로 굳어진다.
- 나중에 전체 구조를 다시 맞추는 비용이 커진다.

반대로 얇게 선구현하면 장점이 있다.

- 코어 엔티티 전체에 실제 진입점이 생긴다.
- 문서, DB, API, 화면의 정합성을 빠르게 맞출 수 있다.
- 대표 시나리오를 초기에 끝까지 검증할 수 있다.
- 이후 깊게 들어갈 때 어느 엔티티를 확장해야 하는지 기준이 선명해진다.

---

## 3. 기본 원칙

### 3.1 엔티티 설계 우선

- 화면이나 API 이름보다 엔티티 정의를 먼저 따른다.
- 엔티티 간 책임이 겹치면 문서 기준 책임으로 되돌린다.
- 특히 `CollectedTransaction`과 `JournalEntry`를 합치지 않는다.

### 3.2 얇은 구현의 정의

어떤 엔티티가 “얇게 구현되었다”고 보려면 최소한 아래가 있어야 한다.

1. DB에 물리 모델이 존재한다.
2. 최소 조회 또는 생성 API가 있다.
3. 대표 시나리오 안에서 실제로 한 번 호출된다.
4. 화면 또는 내부 use case에서 그 엔티티를 직접 다룬다.
5. 최소 smoke test 또는 seed 경로가 있다.

즉 테이블만 있거나, 화면 문구에 이름만 붙어 있는 상태는 구현 완료로 보지 않는다.

### 3.3 깊은 구현의 정의

얇은 선구현 이후에 추가할 깊은 구현은 다음을 의미한다.

- 권한 세분화
- 상태 전이 예외 처리
- 자동 분개 정책 정교화
- 업로드 파서 고도화
- 정정/반전/재오픈
- 재무제표 상세화
- UI/UX polish
- 운영 감사/모니터링 강화

### 3.4 라운드마다 같이 움직일 것

각 라운드에서는 아래 네 층을 같이 움직인다.

- 도메인 문서
- Prisma / DB
- API / application service
- 화면 / 테스트

하나만 먼저 깊게 가는 방식은 피한다.

---

## 4. 선구현 범위

이 계획에서 “먼저 얇게 다 덮을 코어 범위”는 아래다.

### 4.1 운영 경계

- `Tenant`
- `TenantMembership`
- `Ledger`

### 4.2 기간 및 기준 데이터

- `AccountingPeriod`
- `PeriodStatusHistory`
- `AccountSubject`
- `TransactionType`
- `FundingAccount`
- `Category`

### 4.3 계획 및 수집

- `RecurringRule`
- `PlanItem`
- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`

### 4.4 확정 및 마감

- `JournalEntry`
- `JournalLine`
- `OpeningBalanceSnapshot`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

### 4.5 보고 및 이월

- `FinancialStatementSnapshot`
- `CarryForwardRecord`

---

## 5. 실행 방식

구현은 “엔티티별 완성”보다 “대표 시나리오를 따라 흐름을 얇게 연결하는 라운드”로 진행한다.

한 라운드의 기본 단위는 아래와 같다.

1. 엔티티 책임 확정
2. 최소 DB 구조 반영
3. 최소 application service 연결
4. 최소 API 계약 연결
5. 최소 화면 또는 내부 실행 경로 연결
6. 최소 테스트/시드 확인

이 방식이면 각 엔티티가 고립되지 않고 실제 흐름 안에서 살아 움직이게 된다.

---

## 6. 권장 실행 순서

## 6.1 Round 0: 기준선 잠금

### 목표

얇은 선구현을 시작하기 전에 더 이상 흔들리면 안 되는 기준선을 고정한다.

### 작업

- 도메인 문서 기준 엔티티/상태/불변조건 재확인
- `schema.prisma`와 문서 간 매핑 표 점검
- 레거시 명칭과 도메인 명칭 매핑 유지
- 데모 데이터와 개발 기동 경로 재확인

### 산출물

- 구현 중 판단 기준이 흔들리지 않는 상태

### 완료 기준

- 팀이 “지금부터는 어떤 엔티티를 어떤 경로로 올릴지”에 대해 더 이상 헷갈리지 않는 상태

---

## 6.2 Round 1: 운영 경계와 현재 장부 문맥

### 목표

모든 이후 로직이 `Tenant / TenantMembership / Ledger` 문맥 안에서 동작하게 만든다.

### 핵심 엔티티

- `Tenant`
- `TenantMembership`
- `Ledger`

### 작업

- 로그인 세션 이후 현재 Tenant / Ledger를 해석하는 루트 정리
- API request context를 `userId` 단독이 아니라 `membership/tenant/ledger` 기준으로 정리
- 기본 Ledger 선택 및 확인 경로 정리
- 설정 화면은 실제 “현재 작업 장부” 확인 화면으로 승격

### 최소 완료 기준

- 모든 코어 write/read가 현재 Ledger 문맥을 알고 있다.
- 최소 1명의 `Owner`가 존재한다.
- 데모 계정이 특정 Tenant / Ledger에 묶여 동작한다.

---

## 6.3 Round 2: 월 운영 시작

### 목표

공식 운영 시작점을 `AccountingPeriod` 기준으로 연다.

### 핵심 엔티티

- `AccountingPeriod`
- `PeriodStatusHistory`
- `OpeningBalanceSnapshot`

### 작업

- “월 운영 시작” use case 추가
- 기간 생성 또는 오픈 API 추가
- 최초 월은 `OpeningBalanceSnapshot` 존재 여부 검증
- 상태 전이 이력 `PeriodStatusHistory` 기록
- 전용 시작 화면 추가

### 최소 완료 기준

- 특정 Ledger에서 특정 연월의 기간을 연다.
- 같은 월을 중복으로 열 수 없다.
- 시작 화면에서 현재 월 상태를 확인할 수 있다.

---

## 6.4 Round 3: 기준 데이터와 참조 입력

### 목표

후속 계획/수집/전표가 의존하는 기준 데이터를 얇게 정리한다.

### 핵심 엔티티

- `AccountSubject`
- `TransactionType`
- `FundingAccount`
- `Category`

### 작업

- 시스템 기본 마스터 seed 안정화
- 자금수단/카테고리 조회 API를 Ledger 기준으로 정리
- 화면의 “계정/카테고리/거래유형” 입력이 실제 기준 데이터에 연결되게 정리
- 사용자 자유 설계는 아직 열지 않고 고정 마스터 또는 최소 CRUD만 유지

### 최소 완료 기준

- `CollectedTransaction`, `PlanItem`, `JournalLine`에 필요한 참조값을 모두 선택할 수 있다.

---

## 6.5 Round 4: 계획 계층 얇게 연결

### 목표

`RecurringRule -> PlanItem` 흐름을 공식 계획 계층으로 만든다.

### 핵심 엔티티

- `RecurringRule`
- `PlanItem`

### 작업

- 기존 반복 규칙 화면을 유지하되 Plan 기준 설명을 실제 구조로 연결
- 월 운영 시작 시점에 최소한의 `PlanItem` 생성 경로 추가
- `PlanItem` 목록 또는 period 내 계획 요약 화면 추가
- `Draft/Matched/Confirmed/Skipped/Expired` 상태를 최소 표시

### 최소 완료 기준

- 규칙 1건으로 해당 월 `PlanItem`이 생성된다.
- period 문맥에서 계획 항목을 볼 수 있다.

---

## 6.6 Round 5: 수집 계층 얇게 연결

### 목표

원천 거래를 공식적으로 `CollectedTransaction`에 모은다.

### 핵심 엔티티

- `ImportBatch`
- `ImportedRow`
- `CollectedTransaction`

### 작업

- 직접 입력 거래는 `CollectedTransaction`로 생성
- 업로드는 최소한 `ImportBatch / ImportedRow / CollectedTransaction` 구조를 통과
- 기존 `transactions` 화면을 `CollectedTransaction` 중심으로 계속 확장
- 상태 `Collected -> Reviewed -> ReadyToPost`까지 최소 지원

### 최소 완료 기준

- period 문맥에서 원천 거래를 생성/조회/검토할 수 있다.
- 직접 입력과 업로드 경로가 같은 원천 엔티티로 모인다.

---

## 6.7 Round 6: 전표 확정 계층 얇게 연결

### 목표

공식 회계 진실 원천을 `JournalEntry / JournalLine`으로 세운다.

### 핵심 엔티티

- `JournalEntry`
- `JournalLine`
- `CollectedTransaction`

### 작업

- `CollectedTransaction -> JournalEntry` 확정 use case 추가
- `postedJournalEntryId` 연결
- `transactions` 화면에서 확정 액션 제공
- `journal-entries` 조회 화면 추가
- 최소 차변/대변 합계 검증 구현

### 최소 완료 기준

- 원천 거래 1건을 전표 1건으로 확정할 수 있다.
- 확정 후 전표 조회 화면에서 결과를 볼 수 있다.
- 전표가 공식 기준이라는 구조가 화면과 API에 드러난다.

---

## 6.8 Round 7: 월 마감 얇게 연결

### 목표

기간 잠금과 마감 스냅샷을 만든다.

### 핵심 엔티티

- `AccountingPeriod`
- `PeriodStatusHistory`
- `ClosingSnapshot`
- `BalanceSnapshotLine`

### 작업

- 월 마감 use case 추가
- 기간 상태를 `Locked`로 전환
- `ClosingSnapshot` 생성
- `BalanceSnapshotLine` 생성
- 전용 마감 화면 추가

### 최소 완료 기준

- 전표가 있는 월을 마감할 수 있다.
- 잠금 이력이 남는다.
- 마감 스냅샷과 잔액 라인이 생성된다.

---

## 6.9 Round 8: 보고 계층 얇게 연결

### 목표

공식 보고 산출물을 `FinancialStatementSnapshot`으로 만든다.

### 핵심 엔티티

- `FinancialStatementSnapshot`
- `ClosingSnapshot`

### 작업

- 마감 후 재무제표 스냅샷 생성 use case 추가
- 최소 조회 화면 추가
- 대시보드/전망과 공식 보고 화면을 분리

### 최소 완료 기준

- 잠금된 기간에 대해 공식 재무제표 스냅샷이 생성된다.
- preview와 official을 구분할 수 있다.

---

## 6.10 Round 9: 차기 이월 얇게 연결

### 목표

현재 월 종료를 다음 월 시작으로 연결한다.

### 핵심 엔티티

- `CarryForwardRecord`
- `ClosingSnapshot`
- `OpeningBalanceSnapshot`

### 작업

- 이월 생성 use case 추가
- `CarryForwardRecord` 생성
- 다음 기간 오프닝 기준 생성
- 차기 이월 화면 추가

### 최소 완료 기준

- 마감된 월에서 다음 월 시작 기준이 생성된다.
- 대표 시나리오가 처음부터 끝까지 연결된다.

---

## 7. 얇게 모두 덮은 뒤 깊게 들어가는 순서

선구현이 끝난 뒤에는 아래 순서로 깊이를 더한다.

### 7.1 1단계: 권한과 감사 강화

- `TenantMembership` 역할별 제약
- `ActorRef` / 감사 로그 강화
- 마감/재오픈/정정 권한 분리

### 7.2 2단계: 불변조건과 트랜잭션 경계 강화

- 전표 확정 트랜잭션 일관성
- 마감 트랜잭션 일관성
- 상태 전이 예외 흐름

### 7.3 3단계: 업로드와 자동화 강화

- 중복 판정
- 업로드 파서 다양화
- 자동 매칭
- 자동 분개 정책 고도화

### 7.4 4단계: 정정/반전/재오픈 강화

- `Reversal`
- `Correction`
- period reopen
- audit trail 확장

### 7.5 5단계: 보고와 운영 분석 강화

- 재무제표 상세 표현
- 비교 분석
- 추이/요약 리포트
- 대시보드 read model 정교화

### 7.6 6단계: 후속 SaaS 확장

- `TenantInvitation`
- `TenantSubscription`
- `SupportAccessGrant`

---

## 8. 라운드별 완료 기준

각 라운드는 아래 다섯 가지를 모두 만족해야 다음으로 넘긴다.

1. DB 구조가 실제 반영돼 있다.
2. 최소 API 호출이 실제로 동작한다.
3. 최소 화면 또는 실행 경로가 있다.
4. 데모 데이터 또는 테스트로 한 번 검증된다.
5. 문서 기준과 실제 구현이 크게 어긋나지 않는다.

즉 “테이블만 생성”, “화면만 생성”, “문서만 작성” 상태로 다음 라운드로 넘어가지 않는다.

---

## 9. 지금 당장 하지 않을 것

얇은 선구현 단계에서는 아래에 깊게 들어가지 않는다.

- 보험/차량 화면 고도화
- 고급 디자인 polish
- 다중 업로드 포맷 확장
- 자유 분개/자유 거래유형 설계
- 복잡한 승인 워크플로
- Support access 운영 화면
- 과금/구독 상세 운영 화면

이 영역들은 코어 회계 흐름이 끝까지 연결된 뒤에 들어간다.

---

## 10. 바로 실행할 우선순위

지금 기준으로 가장 자연스러운 실제 실행 순서는 아래다.

1. Round 1: `Tenant / TenantMembership / Ledger` 런타임 문맥 정리
2. Round 2: `AccountingPeriod / PeriodStatusHistory / OpeningBalanceSnapshot`
3. Round 5 일부 선행: 기존 `transactions` 화면을 `CollectedTransaction` 중심으로 period 문맥 안에 넣기
4. Round 6: `CollectedTransaction -> JournalEntry`
5. Round 7: `ClosingSnapshot / BalanceSnapshotLine`
6. Round 8: `FinancialStatementSnapshot`
7. Round 9: `CarryForwardRecord`
8. Round 4: `RecurringRule / PlanItem`를 코어 흐름에 다시 연결

여기서 `Round 4`를 뒤로 일부 미루는 이유는, 현재 제품 상태상 계획 계층보다 “기간 시작 -> 거래 확정 -> 전표 -> 마감” 코어 회계 흐름이 먼저 살아야 전체 구조가 안정되기 때문이다.

---

## 11. 최종 결론

지금 프로젝트는 특정 화면이나 특정 CRUD를 깊게 파는 것보다, **엔티티 설계 전체를 따라 코어 흐름을 얇게 먼저 전부 연결하는 방식**이 가장 맞다.

핵심 문장은 이것이다.

- `Tenant / Ledger` 문맥을 먼저 잡는다.
- `AccountingPeriod`를 공식 시작점으로 만든다.
- `CollectedTransaction`을 원천으로 받는다.
- `JournalEntry`를 공식 회계 진실 원천으로 세운다.
- `ClosingSnapshot`으로 마감한다.
- `FinancialStatementSnapshot`과 `CarryForwardRecord`로 끝맺는다.

이 순서대로 얇게 한 바퀴를 먼저 완성한 뒤, 권한, 자동화, 예외 처리, 보고 고도화, UX polish를 깊게 쌓는 것이 가장 안전하고 재작업이 적다.
