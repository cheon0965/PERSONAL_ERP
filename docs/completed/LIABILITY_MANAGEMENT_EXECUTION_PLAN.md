# 부채 관리 화면 실행계획

> 구현 상태: 2026-04-23 기준 1차 구현 범위가 코드에 반영되었다. 부채 계약/상환 일정 Prisma 모델과 contracts, `GET/POST/PATCH /liabilities` API, `/liabilities` Web 화면, 계획 항목 생성 연동, 부채 상환 전표 분리 정책, 데모 seed/fallback, 메뉴 진입점을 추가했다. 업로드 배치와의 연결은 상환 일정에서 생성된 계획 항목/수집 거래를 통해 기존 계획 매칭 흐름으로 이어진다.

## 목적

이 문서는 은행 대출, 카드론, 리스성 차입처럼 매월 상환이 발생하는 부채를 `PERSONAL_ERP`의 월 운영 흐름에 자연스럽게 편입하기 위한 실행계획이다.

목표는 단순히 “대출 목록 화면”을 하나 추가하는 것이 아니다. 부채 계약, 상환 예정, 실제 출금, 전표 확정, 기간 전망, 재무제표가 같은 운영 사이클 안에서 이어지도록 기준을 고정한다.

핵심 방향은 아래 세 가지다.

- 부채 계약은 `보험 계약`, `차량 운영`처럼 월 운영 전에 정리하는 기준 데이터 겸 운영 자산으로 둔다.
- 상환 예정은 `반복 규칙 -> 계획 항목 -> 수집 거래 -> 전표` 흐름을 재사용한다.
- 공식 부채 잔액과 손익/현금흐름 판단은 최종적으로 `JournalEntry`, `FinancialStatements`, `Forecast`에서 확인한다.

## 현재 기준선

현재 프로젝트는 이미 아래 흐름을 갖고 있다.

- 보험 계약 화면은 반복되는 보험료 기준을 정리하고, 이후 계획 항목과 수집 거래 흐름으로 이어진다.
- 차량 운영 화면은 차량 기본 정보와 연료/정비 운영 기록을 분리하고, 필요한 경우 수집 거래와 연결한다.
- 반복 규칙은 월별 계획 항목 생성 기준이다.
- 계획 항목은 운영월 기준 예정 거래를 추적한다.
- 업로드 배치는 현재 운영월 범위의 업로드 행만 수집 거래로 등록하도록 정리한다.
- 수집 거래와 전표 조회가 공식 회계 확정 경로다.
- 기간 전망은 확정 전표와 남은 계획 항목을 함께 읽어 운영 판단 값을 만든다.

부채 관리는 이 흐름 중 `보험 계약/차량 운영`과 같은 위치에 들어간다. 즉, 부채 화면은 회계 확정 화면이 아니라 상환 기준과 운영 리스크를 준비하는 화면이다.

## 문제 정의

부채 화면이 없으면 아래 문제가 생긴다.

- 대출 원금, 이자율, 만기, 상환일을 장부 흐름 밖에서 따로 관리하게 된다.
- 매월 상환액이 계획 항목에 자동 반영되지 않아 현금 전망이 약해진다.
- 업로드 배치에서 은행 출금 행을 확인해도 어떤 대출 상환인지 알기 어렵다.
- 상환 거래가 원금 상환과 이자 비용으로 나뉘어야 하는데, 단순 비용 거래처럼 처리될 위험이 있다.
- 재무제표상 부채 잔액과 운영 화면의 남은 상환액이 서로 다른 기준으로 보일 수 있다.

## 목표 범위

1차 구현 범위는 아래로 제한한다.

- 은행 대출/차입 계약 목록과 상세 관리
- 원금, 이자, 수수료로 나뉜 상환 예정 관리
- 현재 운영월 상환 예정의 계획 항목 생성 연동
- 업로드/수집 거래에서 상환 예정과 매칭할 수 있는 기준 제공
- 전표 확정 시 원금 상환과 이자 비용을 분리할 수 있는 회계 정책 준비
- 대시보드/기간 전망에서 남은 상환액과 부채 리스크 요약 노출

아래는 이번 1차 범위에서 제외한다.

- 실시간 은행 대출 API 연동
- 복잡한 변동금리 자동 재계산 엔진
- 담보 평가, 약정 위반 covenant, 신용등급 관리
- 외화 차입과 환산 손익
- 장기/유동 부채 자동 재분류의 완전 자동화
- IFRS/K-GAAP 수준의 유효이자율 상각표

## 용어와 경계

### 부채 계약

은행이나 금융기관과 맺은 대출/차입 약정이다.

예시:

- 사업자 대출
- 차량 할부 또는 금융리스 성격 차입
- 운전자금 대출
- 카드론

### 상환 예정

특정 부채 계약에서 특정 날짜에 갚아야 하는 예정 금액이다.

상환 예정은 최소 아래 항목으로 쪼개어 읽는다.

- 원금 상환액
- 이자 비용
- 수수료 또는 기타 비용
- 총 출금 예정액

### 공식 회계 진실

부채 계약 화면은 운영 기준선이다. 공식 회계 진실은 전표와 재무제표에 둔다.

따라서 부채 화면의 잔액은 운영 보조 read model이며, 공식 부채 잔액은 `JournalEntry`와 마감 산출물에서 확인하는 원칙을 유지한다.

## 권장 정보 구조

### 메뉴 위치

부채 관리는 기존 흐름상 `보험 계약`, `차량 운영` 근처에 배치한다.

권장 메뉴 순서:

1. 월 운영
2. 보험 계약
3. 차량 운영
4. 부채 관리
5. 반복 규칙
6. 계획 항목
7. 업로드 배치
8. 수집 거래

권장 route:

- `/liabilities`
- 필요 시 후속: `/liabilities/[liabilityId]`

### 화면 구성

첫 화면은 마케팅형 설명 페이지가 아니라 바로 운영 가능한 작업 화면으로 만든다.

- 상단: 부채 요약, 현재 운영월 상환 예정, 다음 상환일
- 중단: 부채 계약 목록
- 하단 또는 우측: 선택 계약의 상환 일정, 연결 계획 항목, 최근 수집 거래/전표
- Drawer: 부채 계약 생성/수정
- Drawer 또는 Dialog: 상환 예정 생성/수정, 계획 항목 연결 상태 확인

## 도메인 모델 초안

### LiabilityAgreement

부채 계약 기준 정보다.

필드 후보:

- `id`
- `tenantId`
- `ledgerId`
- `lenderName`
- `productName`
- `loanNumberLast4`
- `principalAmount`
- `borrowedAt`
- `maturityDate`
- `interestRate`
- `interestRateType`
- `repaymentMethod`
- `paymentDay`
- `defaultFundingAccountId`
- `liabilityAccountSubjectId`
- `interestExpenseCategoryId`
- `feeExpenseCategoryId`
- `status`
- `memo`

원칙:

- 원금, 이자율, 만기, 기본 출금 계좌를 관리한다.
- 공식 잔액을 직접 손으로 입력하는 필드는 1차 구현에서 피한다.
- 외부 대출 잔액 확인이 필요하면 후속 `LiabilityBalanceSnapshot`으로 분리한다.

### LiabilityRepaymentSchedule

상환 예정 1건이다.

필드 후보:

- `id`
- `liabilityAgreementId`
- `dueDate`
- `principalAmount`
- `interestAmount`
- `feeAmount`
- `totalAmount`
- `status`
- `linkedRecurringRuleId`
- `linkedPlanItemId`
- `matchedCollectedTransactionId`
- `postedJournalEntryId`
- `memo`

상태 후보:

- `SCHEDULED`: 예정
- `PLANNED`: 계획 항목 생성됨
- `MATCHED`: 수집 거래와 연결됨
- `POSTED`: 전표 확정됨
- `SKIPPED`: 제외
- `CANCELLED`: 취소

### LiabilityBalanceSnapshot

1차에서는 선택 사항이다.

도입 시 역할:

- 은행 대출 명세서 기준 특정일 잔액
- 운영 화면의 추정 잔액과 외부 확인 잔액의 차이 표시
- 감사용 보조 근거

이 모델은 공식 회계 잔액을 대체하지 않는다.

## 회계 흐름 설계

### 대출 실행

대출을 받은 순간은 현금 증가와 부채 증가가 동시에 발생한다.

권장 처리:

- 은행 입금 행을 업로드 배치 또는 수집 거래에서 등록한다.
- 거래 유형은 일반 수입이 아니라 `차입 실행` 성격으로 분리한다.
- 전표는 대략 `현금/예금 차변`, `차입금 대변` 흐름이 된다.

1차 구현에서는 대출 실행 전표 자동화까지 바로 넣지 않아도 된다. 다만 스키마와 정책은 상환과 충돌하지 않게 설계한다.

### 상환

상환은 총 출금액 하나가 아니라 원금 상환과 이자 비용으로 나뉜다.

예시:

- 총 출금액: 1,050,000원
- 원금: 1,000,000원
- 이자: 50,000원

전표 방향:

- 차입금 차변 1,000,000
- 이자비용 차변 50,000
- 보통예금 대변 1,050,000

따라서 기존 수집 거래 확정 정책이 단일 카테고리 비용만 처리한다면, 부채 상환용 posting policy를 별도로 추가해야 한다.

## 기존 흐름 편입 방식

### 반복 규칙

부채 계약에서 매월 같은 상환일이 있는 경우 반복 규칙을 생성하거나 연결한다.

단, 부채 상환은 단순 비용이 아니므로 반복 규칙에는 총 출금액과 상환 타입 힌트를 싣고, 실제 원금/이자 분리는 `LiabilityRepaymentSchedule`이 책임지는 편이 안전하다.

### 계획 항목

운영월 계획 항목 생성 시 해당 월의 상환 예정도 함께 반영한다.

목표:

- 계획 항목 목록에서 부채 상환 예정이 보인다.
- 기간 전망에서 남은 상환 총액이 현금 지출로 반영된다.
- 계획 항목에서 부채 계약 상세로 이동할 수 있다.

주의:

- 계획 항목 금액은 현금 기준 총 출금액을 사용한다.
- 손익 비용은 이자/수수료만 반영되므로 재무제표 판단은 전표 확정 이후로 둔다.

### 업로드 배치

현재 업로드 배치는 운영월 행만 수집 거래로 등록하도록 정리되어 있다.

부채 관리 도입 후에는 아래 자동 판정이 추가된다.

- 거래일이 상환 예정일 근처인지 확인
- 출금액이 상환 예정 총액과 일치하거나 허용 오차 안인지 확인
- 연결 계좌가 부채 계약의 기본 출금 계좌와 맞는지 확인
- 후보가 하나면 상환 예정과 자동 연결
- 후보가 여러 개면 수동 선택

### 수집 거래

부채 상환 수집 거래는 일반 지출과 다르게 `sourceKind` 또는 posting policy hint를 가진다.

권장:

- 수집 거래에 `matchedLiabilityRepaymentScheduleId` 또는 별도 연결 테이블을 둔다.
- 확정 버튼은 “전표 확정” 하나로 보이되 내부 정책은 부채 상환 전표를 생성한다.

### 전표

부채 상환 확정은 별도 정책으로 분리한다.

정책 이름 후보:

- `confirm-liability-repayment.policy`
- `liability-repayment-posting.policy`

검증 기준:

- 원금 상환액은 비용이 아니라 부채 감소로 처리한다.
- 이자/수수료만 비용 계정으로 처리한다.
- 총 대변 금액은 실제 출금액과 일치해야 한다.
- 이미 확정된 상환 예정은 중복 확정할 수 없다.

### 기간 전망

기간 전망에는 두 층의 숫자를 보여준다.

- 현금 전망: 남은 상환 총액 전체를 차감
- 손익 관점: 이자/수수료 예정액만 비용성 부담으로 표시

처음에는 현금 전망 반영을 우선하고, 손익 예정 분리는 별도 카드나 보조 요약으로 추가한다.

### 재무제표

공식 부채 잔액은 전표 기준으로 산출한다.

부채 화면의 추정 잔액과 재무제표 부채 잔액이 다르면 운영 경고로 보여줄 수 있다.

## 계약과 API 계획

### contracts

추가 후보:

- `packages/contracts/src/liabilities.ts`
- `LiabilityAgreementItem`
- `CreateLiabilityAgreementRequest`
- `UpdateLiabilityAgreementRequest`
- `LiabilityRepaymentScheduleItem`
- `CreateLiabilityRepaymentScheduleRequest`
- `UpdateLiabilityRepaymentScheduleRequest`
- `LiabilityOverviewResponse`
- `LiabilityRepaymentProjectionItem`

`packages/contracts/src/index.ts`에 export를 추가한다.

### API

추가 후보 endpoint:

- `GET /liabilities`
- `POST /liabilities`
- `GET /liabilities/:id`
- `PATCH /liabilities/:id`
- `POST /liabilities/:id/archive`
- `GET /liabilities/:id/repayments`
- `POST /liabilities/:id/repayments`
- `PATCH /liabilities/:id/repayments/:repaymentId`
- `POST /liabilities/:id/repayments/:repaymentId/generate-plan-item`
- `GET /liabilities/overview`

후속 후보:

- `POST /liabilities/:id/recalculate-schedule`
- `POST /liabilities/:id/balance-snapshots`
- `POST /collected-transactions/:id/confirm-liability-repayment`

## 권한 정책

초기 권장:

- 조회: `OWNER`, `MANAGER`, `EDITOR`, `VIEWER`
- 생성/수정/보관: `OWNER`, `MANAGER`, `EDITOR`
- 전표 확정: 기존 수집 거래 확정 권한과 동일하게 `OWNER`, `MANAGER`, `EDITOR`

부채 계약에는 민감한 금융 정보가 들어가므로 아래 원칙을 둔다.

- 대출번호는 전체 저장/노출 대신 마지막 4자리 중심으로 시작한다.
- 계약 메모에 주민번호, 계좌 비밀번호, 인증 정보 같은 민감정보를 넣지 않도록 UI 문구를 둔다.
- 감사 로그에는 부채 계약명과 작업 종류만 남기고 민감 원문은 남기지 않는다.

## 단계별 실행계획

### Phase 0. 문서와 범위 고정

목표:

- 이 문서를 기준으로 용어, route, 흐름을 합의한다.
- 부채 관리가 공식 회계 진실을 대체하지 않는다는 경계를 고정한다.

작업:

- `docs/README.md` 인덱스에 이 문서를 추가한다.
- `PROJECT_PLAN.md`에는 구현 착수 시점에 로드맵 항목으로 연결한다.
- 도메인 문서 반영은 스키마 초안 확정 후 진행한다.

완료 기준:

- 구현 전에 부채 계약, 상환 예정, 전표 확정 경계가 문서로 설명된다.

### Phase 1. 계약과 스키마 초안

목표:

- Web/API가 공유할 타입과 DB 모델 경계를 먼저 고정한다.

작업:

- `packages/contracts/src/liabilities.ts` 추가
- Prisma 모델 추가 초안 작성
- enum 후보 정의
- 마이그레이션 작성
- seed/fallback 데이터 최소 2건 추가

검증:

- contracts typecheck
- Prisma generate
- 스키마 drift 없는지 확인

완료 기준:

- 부채 계약과 상환 예정이 기존 보험/차량 모델과 충돌 없이 독립 모델로 존재한다.

### Phase 2. API 1차

목표:

- 부채 계약 CRUD와 상환 예정 CRUD를 만든다.

작업:

- `apps/api/src/modules/liabilities` 모듈 추가
- controller/service/repository 분리
- workspace scope 적용
- role policy 추가
- 운영 감사 로그 이벤트 추가

검증:

- 요청 단위 API 테스트
- 권한 테스트
- tenant/ledger scope 누수 테스트

완료 기준:

- 같은 워크스페이스의 부채만 조회/수정된다.
- viewer는 조회만 가능하다.
- 삭제는 물리 삭제보다 보관/비활성 상태 전환을 우선한다.

### Phase 3. Web 화면 1차

목표:

- `/liabilities`에서 부채 계약과 상환 일정을 실제로 관리할 수 있게 한다.

작업:

- route 추가
- sidebar/navigation 추가
- 부채 요약 카드
- 부채 계약 DataGrid
- 계약 생성/수정 Drawer
- 선택 계약 상환 일정 영역
- 상환 예정 생성/수정 Drawer

UI 원칙:

- 보험/차량 운영 화면과 같은 운영형 밀도를 유지한다.
- 대출 상품 설명용 랜딩 페이지를 만들지 않는다.
- 잔액, 다음 상환일, 이번 운영월 상환액을 먼저 볼 수 있게 한다.
- 카드 안에 카드를 중첩하지 않는다.

검증:

- Web typecheck
- Web lint
- 대표 브라우저 흐름 E2E 또는 smoke

완료 기준:

- 사용자가 부채 계약을 만들고 현재 운영월 상환 예정까지 확인할 수 있다.

### Phase 4. 계획 항목 연동

목표:

- 월 운영을 열고 계획 항목을 생성할 때 부채 상환 예정이 빠지지 않게 한다.

작업:

- 부채 상환 예정에서 현재 운영월 대상 읽기
- 계획 항목 생성 use case에 liability source 추가
- 계획 항목 row에 source kind 또는 관련 부채 링크 추가
- `/plan-items` 실행 연결 셀에서 부채 상환 연결 정보 표시

검증:

- 계획 항목 생성 API 테스트
- 기존 반복 규칙 생성과 중복 생성 방지 테스트
- Web 계획 항목 표시 테스트

완료 기준:

- 현재 운영월 상환 예정이 계획 항목에 반영되고, 중복 생성되지 않는다.

### Phase 5. 업로드/수집 거래 매칭

목표:

- 은행 출금 업로드 행이 부채 상환 예정과 자연스럽게 연결되도록 한다.

작업:

- 업로드 자동 판정 후보에 부채 상환 예정 추가
- 금액/날짜/계좌 기준 매칭 정책 작성
- 수집 거래 생성 시 상환 예정 연결 저장
- 연결된 상환 예정 상태 전환
- 취소/삭제 시 상태 복구

검증:

- 업로드 preview 테스트
- 수집 거래 등록 테스트
- 중복 후보/모호 후보 테스트
- 운영월 밖 행 미처리 정책 유지 테스트

완료 기준:

- 현재 운영월 업로드 행만 부채 상환 예정과 매칭된다.
- 모호한 후보는 자동 연결하지 않는다.

### Phase 6. 부채 상환 전표 정책

목표:

- 부채 상환을 단순 비용이 아니라 원금 상환 + 이자 비용으로 확정한다.

작업:

- 부채 상환 posting policy 추가
- 원금/이자/수수료 라인 생성
- 수집 거래 confirm use case에서 부채 상환 연결을 감지
- 전표 생성 후 상환 예정 상태를 `POSTED`로 전환
- 반전/정정 시 상태 복구 또는 교체 정책 정의

검증:

- 원금만 상환
- 원금 + 이자 상환
- 이자만 납부
- 수수료 포함
- 이미 확정된 상환 중복 방지
- locked period 차단

완료 기준:

- 부채 상환 전표가 대차 일치하며, 원금이 비용으로 잡히지 않는다.

### Phase 7. 전망/대시보드/재무제표 보조 요약

목표:

- 남은 상환액과 부채 잔액 리스크를 운영자가 한눈에 볼 수 있게 한다.

작업:

- `GET /liabilities/overview` read model 추가
- 대시보드 경고/하이라이트에 다음 상환액 추가
- 기간 전망에 남은 상환 총액과 이자성 부담 표시
- 재무제표 부채 잔액과 운영 추정 잔액의 차이 경고 후보 검토

검증:

- forecast read model 테스트
- dashboard read model 테스트
- 숫자 중복 계산 방지 테스트

완료 기준:

- 부채 상환 예정이 현금 전망에서 빠지지 않는다.
- 공식 재무제표와 운영 보조 잔액의 경계가 UI에서 혼동되지 않는다.

### Phase 8. 문서 동기화와 운영 체크

목표:

- 구현 결과를 현재 기준 문서에 반영한다.

작업:

- `docs/API.md` 업데이트
- `docs/CURRENT_CAPABILITIES.md` 업데이트
- `docs/SCREEN_FLOW_GUIDE.md` 업데이트
- `docs/VALIDATION_NOTES.md` 업데이트
- `docs/domain/core-entity-definition.md` 업데이트
- `docs/domain/business-logic-draft.md` 업데이트

검증:

- `npm run docs:check`
- `npm run check:quick`
- 필요한 경우 E2E smoke 추가

완료 기준:

- 문서상 월 운영 흐름에 `부채 관리`가 자연스럽게 포함된다.

## 우선 구현 순서

1. `LiabilityAgreement`, `LiabilityRepaymentSchedule` 계약과 스키마
2. 부채 계약/상환 예정 API
3. `/liabilities` 화면
4. 계획 항목 생성 연동
5. 업로드 배치 매칭
6. 부채 상환 전표 정책
7. 전망/대시보드 요약
8. 문서 동기화

이 순서가 중요한 이유는 부채 화면을 먼저 만들더라도, 전표 정책을 너무 빨리 얹으면 기존 단일 거래 확정 정책과 충돌할 수 있기 때문이다. 먼저 운영 기준 데이터를 안정적으로 만들고, 그 다음 회계 확정 정책을 분리하는 편이 안전하다.

## 주요 리스크와 대응

### 원금 상환을 비용으로 처리하는 오류

대응:

- 부채 상환 전표 정책을 일반 지출 정책과 분리한다.
- 테스트에서 원금 라인이 비용 계정으로 들어가지 않는지 고정한다.

### 계획 금액과 실제 출금액 차이

대응:

- 허용 오차 또는 수동 조정 정책을 둔다.
- 자동 매칭은 후보가 하나이고 금액 기준이 명확할 때만 수행한다.

### 공식 잔액과 운영 추정 잔액 혼동

대응:

- UI에서 “운영 추정”과 “전표 기준” 라벨을 분리한다.
- 재무제표 숫자를 부채 화면에서 임의로 덮어쓰지 않는다.

### 변동금리와 중도상환

대응:

- 1차는 일정 수동 수정과 재계산 후보만 제공한다.
- 자동 상각표 계산은 후속 단계로 둔다.

### 메뉴 증가로 인한 흐름 복잡도

대응:

- 부채 관리는 보험/차량과 같은 준비 화면으로 묶는다.
- 계획 항목 이후 화면 흐름은 기존 사이클을 그대로 유지한다.

## 검증 체크리스트

최소 검증:

- contracts typecheck
- API request tests
- Web typecheck/lint
- 부채 계약 생성/수정/보관
- 상환 예정 생성/수정
- 현재 운영월 계획 항목 생성
- 업로드 행 매칭
- 부채 상환 전표 확정
- 기간 전망 반영

권장 전체 검증:

- `npm run check:quick`
- `npm run build`
- `npm run test`
- `/liabilities -> /plan-items -> /imports -> /transactions -> /journal-entries -> /forecast` 대표 브라우저 흐름

## 문서 반영 기준

구현이 완료되면 이 문서는 `docs/completed/`로 이동하고, 현재 기준은 아래 문서에 반영한다.

- `docs/CURRENT_CAPABILITIES.md`
- `docs/SCREEN_FLOW_GUIDE.md`
- `docs/API.md`
- `docs/VALIDATION_NOTES.md`
- `docs/domain/core-entity-definition.md`
- `docs/domain/business-logic-draft.md`

완료 전까지는 이 문서를 부채 관리 구현의 기준 실행계획으로 사용한다.
