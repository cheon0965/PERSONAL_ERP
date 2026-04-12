# 동시성/멱등성 실행계획

> 기준 시점: `2026-04-12`
>
> 이 문서는 완료 후 보관된 실행계획이다.
> 현재 운영 기준은 `docs/API.md`, `docs/VALIDATION_NOTES.md`, `docs/ARCHITECTURE.md`, `docs/domain/` 문서를 우선한다.

## 현재 상태

- 상태: 구현 완료
- 구현일: `2026-04-12`
- 검증:
  - `npm run typecheck:api`
  - `npm run lint:api`
  - `npm run test:api`
  - `npm run test:prisma`
- 참고:
  - `test:api`는 통과했다.
  - `test:prisma`는 현재 환경에서 `DATABASE_URL` 원격 MySQL이 reachable하지 않아 안내 문구와 함께 skip되었다.

## 구현 결과 요약

- 전표 확정, 역분개, 정정은 더 이상 `count + 1`로 번호를 만들지 않고, `AccountingPeriod.nextJournalEntrySequence` 기반 period-local allocator를 사용한다.
- 업로드 행의 반복 수집 거래 흡수는 조건부 `updateMany` claim으로 바뀌었고, 기대 상태와 `matchedPlanItemId`, `importBatchId`, `importedRowId`를 함께 검사한다.
- `PlanItem`에는 `@@unique([periodId, recurringRuleId, plannedDate])`가 추가되었고, generate 경로는 DB 중복을 `skip`으로 해석한다.
- 자금수단, 카테고리, 보험, 차량은 normalized key 컬럼과 unique index로 DB 기준 중복 방지를 갖는다.
- Prisma `P2002`는 전역 `PrismaConflictExceptionFilter`에서 도메인 의미가 있는 `409 Conflict`로 정리한다.

## 목적

이 계획의 목표는 `PERSONAL_ERP`의 주요 쓰기 기능이 동시 입력과 중복 요청 앞에서도 예측 가능한 결과를 내도록 만드는 것이다.

특히 이번 계획은 다음 네 가지를 우선 해결한다.

- 전표 확정, 역분개, 정정에서 전표 번호와 원천 문서 연결이 동시에 깨지지 않게 만든다.
- 업로드 행 수집과 반복 생성 경로에서 같은 대상이 중복 생성되거나 덮어써지지 않게 만든다.
- 기간 오픈, 차기 이월, 주요 마스터 생성처럼 “한 번만 있어야 하는 데이터”를 DB 기준으로 고정한다.
- Prisma 고유 제약 충돌이 raw 500으로 보이지 않고, 도메인 의미가 있는 409 충돌로 정리되게 만든다.

## 왜 지금 먼저 해야 하는가

현재 저장소에서 가장 높은 우선순위는 전표 처리다.

- 전표는 마감, 재무제표, 차기 이월의 직접 입력 원장이다.
- 같은 수집 거래를 두 번 확정하는 문제는 비교적 잘 막혀 있지만, 서로 다른 요청이 같은 기간에 동시에 전표를 만들 때는 전표 번호 충돌 여지가 남아 있다.
- 이 영역을 먼저 고치지 않으면 이후 업로드, 계획 항목, 마스터 정합성을 올려도 월 마감 체인의 핵심 리스크는 남는다.

따라서 이번 실행 순서는 “전표 원장 -> 수집/흡수 -> 계획 생성 -> 기간/마스터” 순서로 잡는다.

## 현재 진단 요약

### 1. 전표 번호는 현재 `count + 1` 기반이다

현재 `confirm`, `reverse`, `correct` 경로는 같은 기간의 기존 전표 수를 센 뒤 다음 번호를 만든다.

- `apps/api/src/modules/collected-transactions/confirm-collected-transaction.use-case.ts`
- `apps/api/src/modules/journal-entries/reverse-journal-entry.use-case.ts`
- `apps/api/src/modules/journal-entries/correct-journal-entry.use-case.ts`

DB에는 `@@unique([ledgerId, entryNumber])`가 있어 중복 저장은 막지만, 동시 요청 중 하나가 raw Prisma unique error로 실패할 수 있다.

### 2. 같은 수집 거래의 중복 확정은 비교적 잘 막혀 있다

현재는 상태 claim과 `sourceCollectedTransactionId @unique`가 있어 같은 수집 거래가 두 번 전표로 올라갈 가능성은 낮다.

즉, 가장 큰 문제는 “같은 원천을 두 번 처리”보다 “서로 다른 쓰기 요청이 동시에 번호를 가져가는 상황”이다.

### 3. 업로드 행 흡수 경로는 덮어쓰기 위험이 있다

반복 생성된 수집 거래를 업로드 행이 흡수하는 경로는 기존 수집 거래를 `id` 기준으로 바로 `update`한다.

- `apps/api/src/modules/import-batches/imported-row-collection.service.ts`

이 구조에서는 서로 다른 업로드 행이 같은 반복 수집 거래에 동시에 붙으려 할 때 마지막 요청이 `importedRowId`를 덮어쓸 수 있다.

### 4. 계획 항목 생성은 메모리 기준 중복 방지이고 DB 기준이 아니다

현재는 같은 기간의 기존 `PlanItem`을 읽어 `recurringRuleId + plannedDate` 조합을 Set으로 들고 건너뛰지만, DB unique가 없다.

- `apps/api/src/modules/plan-items/generate-plan-items.use-case.ts`
- `apps/api/prisma/schema.prisma`

같은 기간에 생성 요청이 동시에 들어오면 같은 반복 규칙/예정일 조합이 중복 생성될 수 있다.

### 5. 기간 오픈, 차기 이월, 마스터 생성은 경로별 편차가 있다

- 기간 오픈, 차기 이월은 일부 DB unique가 있어 최종 중복 저장은 막히지만 충돌 메시지 정리가 약하다.
- 카테고리, 자금수단, 차량, 보험은 대부분 애플리케이션 조회 기반 중복 검사라서 동시 생성 시 중복 row가 생길 수 있다.

### 6. Prisma 고유 제약 충돌을 공통 409로 정리하는 계층이 없다

현재 `PrismaService`에는 공통 예외 변환 계층이 없다.

- `apps/api/src/common/prisma/prisma.service.ts`

그래서 동시성 충돌이 생기면 도메인 충돌이 아니라 내부 오류처럼 보일 수 있다.

## 상위 기준

- 비즈니스 흐름과 상태 전이는 `docs/domain/business-logic-draft.md`를 우선한다.
- 회계 엔티티 경계와 공식 원장은 `docs/ACCOUNTING_MODEL_BOUNDARY.md`를 우선한다.
- 현재 API surface와 응답 계약은 `docs/API.md`와 `packages/contracts`를 우선한다.
- 이 문서는 정책을 새로 정의하는 문서가 아니라, 현재 코드베이스를 어떤 순서로 고칠지 정리하는 실행 문서다.

## 이번 계획의 기본 결정

### 1. DB 기준 보호를 먼저 세우고, 애플리케이션 메시지는 그 위에 올린다

읽고 판단한 뒤 생성하는 방식만으로는 동시 요청을 완전히 막을 수 없다.

이번 계획에서는 다음 우선순위를 유지한다.

1. DB unique 또는 원자적 claim
2. 트랜잭션 내부 재검증
3. 사용자 친화적 409 메시지

### 2. 전표 번호 문제는 공통 helper로 모은다

`confirm`, `reverse`, `correct`가 각자 번호를 만들지 않고, 하나의 전표 번호 할당 helper를 사용하도록 정리한다.

### 3. 중복 방지와 멱등성은 구분해서 본다

- 멱등성: 같은 요청이 다시 들어와도 이미 처리된 결과를 깨지 않는가
- 중복 방지: 같은 비즈니스 키를 가진 서로 다른 요청이 동시에 들어와도 한 번만 반영되는가

이번 계획은 두 문제를 따로 테스트하고 문서화한다.

### 4. 검증은 실제 MySQL 경계를 포함해야 한다

동시성 문제는 mock repository 테스트만으로 충분하지 않다.

핵심 검증은 `test:prisma` 또는 실제 DB 기반 request/integration 경로로 확인한다.

## 권장 진행 순서

| 순서 | 단계                                      | 우선순위 | 이유                                                                      |
| ---- | ----------------------------------------- | -------- | ------------------------------------------------------------------------- |
| 0    | 기준선 고정과 충돌 표면 정리              | 최고     | 이후 단계에서 “무엇이 나아졌는지”를 측정할 기준이 먼저 필요하다.          |
| 1    | 전표 처리 공통 보호 계층                  | 최고     | 마감/재무제표/이월의 입력 원장이라서 가장 먼저 막아야 한다.               |
| 2    | 업로드 행 수집과 반복 수집 거래 흡수 보호 | 높음     | 전표 직전 입력 경로라서 실제 운영 충돌 가능성이 높다.                     |
| 3    | 계획 항목 생성 DB 멱등화                  | 높음     | 반복 생성의 중복은 이후 수집/확정까지 연쇄 중복을 만든다.                 |
| 4    | 기간 오픈/차기 이월/마스터 데이터 정규화  | 중간     | 중요하지만 전표와 직접 연결된 즉시 리스크보다 뒤에 둔다.                  |
| 5    | 문서, 운영 체크, 회귀 검증 마감           | 최고     | 구현만 끝내면 다시 같은 패턴이 퍼질 수 있으므로 마지막에 기준을 고정한다. |

## 단계별 실행계획

### Phase 0. 기준선 고정과 충돌 표면 정리

목적은 현재 충돌이 어디서, 어떤 형태로 보이는지 먼저 고정하는 것이다.

해야 할 일:

- 전표 확정, 역분개, 정정에 대해 “같은 원천 동시 요청”, “다른 원천 동시 요청” 케이스를 각각 테스트로 추가한다.
- 업로드 행 수집에서 “같은 행 동시 수집”, “서로 다른 행이 같은 반복 수집 거래에 동시 흡수” 케이스를 추가한다.
- 계획 항목 생성에서 “같은 기간 generate 동시 호출” 케이스를 추가한다.
- Prisma `P2002` 등 고유 제약 충돌을 409로 정리하는 공통 변환 위치를 결정한다.

완료 기준:

- 현재 리스크가 테스트 이름과 실패 형태로 보인다.
- raw 500이 나오는 경로와 409로 정리되는 경로가 구분된다.

### Phase 1. 전표 처리 공통 보호 계층

이 단계가 이번 계획의 핵심이다.

권장 구현 방향:

- `AccountingPeriod`에 전표 번호용 sequence 필드를 추가하거나, 같은 의미의 period-local allocator를 도입한다.
- 트랜잭션 안에서 “현재 sequence 읽기 -> 기대값 기준 compare-and-set -> 성공 시 번호 확정” 방식으로 바꾼다.
- `confirm`, `reverse`, `correct`는 더 이상 `journalEntry.count()`로 번호를 만들지 않는다.
- 번호 할당과 원천 문서 claim을 공통 helper 조합으로 정리한다.

같이 정리할 항목:

- `sourceCollectedTransactionId`, `reversesJournalEntryId`처럼 이미 unique인 관계와 같은 수준으로 correction 경로도 다시 검토한다.
- 현재 도메인이 “원본 전표 하나당 correction 하나”를 유지한다면 `correctsJournalEntryId`도 DB 제약으로 강화한다.

완료 기준:

- 같은 기간에 서로 다른 수집 거래를 동시에 확정해도 전표 번호가 충돌하지 않는다.
- 같은 전표를 동시에 역분개/정정하려 하면 한 요청만 성공하고 나머지는 409로 정리된다.
- 전표 관련 write path에서 raw unique error가 외부로 새지 않는다.

### Phase 2. 업로드 행 수집과 반복 수집 거래 흡수 보호

목표는 “이미 존재하는 반복 수집 거래에 업로드 행을 붙이는 경로”를 원자적으로 만드는 것이다.

해야 할 일:

- `absorbImportedRowIntoCollectedTransactionRecord`를 `update` 단건 호출에서 조건부 `updateMany` 기반 claim으로 바꾼다.
- claim 조건에 최소 `importedRowId: null`, `importBatchId: null`, 기대 status, 기대 `matchedPlanItemId`를 포함한다.
- claim 실패 시 최신 row를 다시 읽고 409 충돌 메시지로 정리한다.
- 같은 업로드 행의 재수집은 계속 `importedRowId @unique`와 도메인 메시지로 막되, 다른 업로드 행이 같은 반복 수집 거래를 덮어쓰지 못하게 한다.

완료 기준:

- 같은 업로드 행 동시 수집은 한 번만 성공한다.
- 서로 다른 업로드 행이 같은 반복 수집 거래에 동시에 붙으려 하면 한 요청만 성공한다.
- 중복 fingerprint는 “자동 준비 상태를 낮추는 힌트”로만 유지되고, 덮어쓰기 방지의 유일한 보호 장치가 되지 않는다.

### Phase 3. 계획 항목 생성 DB 멱등화

목표는 계획 항목 생성이 “조회 후 생성”이 아니라 “DB가 보장하는 중복 방지”가 되게 만드는 것이다.

해야 할 일:

- `PlanItem`에 `periodId + recurringRuleId + plannedDate` 기준 unique 제약을 추가한다.
- generate use case는 메모리 Set을 보조 수단으로만 쓰고, 최종 판단은 DB 제약에 맡긴다.
- 생성 결과 집계는 `createData.length`가 아니라 실제 commit된 row 수 기준으로 다시 계산한다.
- 자동 생성되는 `matchedCollectedTransaction`까지 한 트랜잭션 안에서 묶되, 중복 발생 시 “skip”과 “conflict”를 명확히 구분한다.

완료 기준:

- 같은 기간 generate를 동시에 호출해도 recurring 기반 계획 항목이 중복 생성되지 않는다.
- 응답의 `createdCount`, `skippedExistingCount`가 실제 commit 결과와 맞는다.

### Phase 4. 기간 오픈, 차기 이월, 마스터 데이터 중복 기준 정리

이 단계는 저장소 전반의 “이름 기반 중복 방지”와 “한 번만 있어야 하는 레코드”를 정리하는 단계다.

우선순위:

1. 기간 오픈
2. 차기 이월
3. 보험
4. 자금수단
5. 카테고리
6. 차량

해야 할 일:

- 기간 오픈과 차기 이월은 기존 unique 충돌을 도메인 409 메시지로 정리하고, 사전 조회와 실제 insert 사이의 경합을 표준화한다.
- 이름 기반 중복 검사는 조회 기반 비교만 유지하지 않고, trim/lower 규칙을 반영한 normalized key 컬럼과 unique index 도입 여부를 결정한다.
- 보험은 `provider + productName`, 차량/자금수단/카테고리는 화면에서 실제 사용하는 중복 기준을 먼저 명시한 뒤 스키마로 내린다.

완료 기준:

- 주요 마스터 생성에서 동시 요청이 들어와도 중복 row가 쌓이지 않는다.
- 중복 기준이 문서와 스키마, 서비스 로직에서 서로 다르게 해석되지 않는다.

### Phase 5. 문서, 운영 체크, 회귀 검증 마감

해야 할 일:

- `docs/API.md`에 충돌 응답 의미를 반영한다.
- `docs/VALIDATION_NOTES.md`에 실제 동시성 검증 범위와 남은 공백을 기록한다.
- 필요하면 `docs/ERROR_HANDLING_AND_LOGGING.md`에 Prisma 충돌 변환 원칙을 추가한다.
- request/integration test 명령을 CI 또는 로컬 검증 루프에 연결한다.

완료 기준:

- 다음 기능이 같은 패턴의 `사전 조회 -> create`를 추가하려 할 때 문서와 테스트가 경고 역할을 한다.
- 완료 후 이 문서를 `docs/completed/`로 옮길 수 있는 체크리스트가 생긴다.

## 스키마/배포 순서

동시성 보강은 구현 순서뿐 아니라 배포 순서도 중요하다.

권장 순서는 아래와 같다.

1. additive schema 변경을 먼저 넣는다.
   - 전표 sequence 필드 또는 allocator 구조
   - normalized key 컬럼
   - 나중에 붙일 unique index의 준비 컬럼
2. 기존 데이터 backfill을 수행한다.
   - 기간별 최대 전표 번호를 읽어 다음 sequence를 계산
   - normalized key 채우기
3. 애플리케이션 write path를 새 보호 계층으로 전환한다.
4. 중복 데이터가 남아 있다면 정리한다.
5. 마지막에 strict unique index를 적용한다.

이 순서를 지키면 운영 중간 단계에서 코드와 스키마가 서로 어긋날 위험을 줄일 수 있다.

## 검증 기준

최소 검증 기준은 아래를 권장한다.

- `npm run check:quick`
- `npm run test:api`
- `npm run test:prisma`
- `npm run build`

추가로 이번 계획에서는 아래 테스트를 새로 확보해야 한다.

- 병렬 confirm으로 같은 기간 다른 수집 거래 2건 확정
- 병렬 reverse/correct
- 병렬 collect로 같은 반복 수집 거래 흡수
- 병렬 generate로 같은 기간 plan item 생성
- 병렬 create로 주요 마스터 중복 생성

## 이번 계획의 완료 정의

이번 실행계획은 아래가 모두 만족될 때 완료로 본다.

- 전표 번호가 `count + 1`에서 벗어나 period-local 원자적 할당으로 바뀐다.
- 업로드 행 흡수 경로에서 덮어쓰기 경쟁이 제거된다.
- recurring 기반 계획 항목 생성이 DB 기준 멱등 경로가 된다.
- 주요 중복 충돌이 500이 아니라 409로 정리된다.
- 문서와 테스트가 새 기준을 저장소에 남긴다.
