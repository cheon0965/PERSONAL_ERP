# 구형 거래 모델과 신규 회계 흐름 경계 및 제거 로드맵

## 목적

이 문서는 현재 저장소에서 구형 `Transaction` 모델과 신규 회계 흐름의 경계를 짧고 명확하게 고정하기 위한 기준 문서다.

상세 도메인 규칙은 [`docs/domain/business-logic-draft.md`](./domain/business-logic-draft.md), [`docs/domain/core-entity-definition.md`](./domain/core-entity-definition.md)를 따른다. 이 문서는 그 기준을 현재 구현과 연결해, 이후 리팩터링이 의미 보존 리팩터링으로 유지되도록 돕는다.

## 1. 신규 기준 원장

현재 프로젝트에서 공식 회계 진실 원천은 아래처럼 구분한다.

- 운영 입력 원천: `CollectedTransaction`
- 공식 확정 원장: `JournalEntry` / `JournalLine`
- 마감 기준 산출물: `ClosingSnapshot`
- 공식 보고 산출물: `FinancialStatementSnapshot`
- 차기 기간 연결: `CarryForwardRecord`

즉, 신규 회계 흐름에서 공식 회계 숫자와 확정 상태를 판단할 때 `Transaction`을 기준으로 삼지 않는다.

## 2. `Transaction`의 현재 위치

`Transaction`은 아직 [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma)에 남아 있고, `User`, `Tenant`, `Ledger`, `Account`, `Category`와의 레거시 관계도 유지된다.

다만 현재 저장소 기준으로 확인한 결과:

- Web의 `/transactions` 화면은 레거시 `Transaction`이 아니라 `CollectedTransaction` shorthand다.
- 현재 API 모듈은 `collected-transactions`, `journal-entries`, `financial-statements`, `carry-forwards` 중심으로 동작한다.
- `apps/api/src`, `apps/web/src`, `packages/contracts` 안에서는 레거시 `Transaction`을 직접 읽고 쓰는 현재 런타임 경로를 찾지 못했다.

위 마지막 항목은 현재 코드 검색 결과에 근거한 구현 상태 판단이다. 즉, `Transaction`은 현시점 구현에서 “주요 런타임 write/read 모델”이 아니라 “스키마에 남아 있는 레거시 구조”로 보는 것이 타당하다.

## 3. 신규 기능 작성 규칙

앞으로 신규 기능이나 리팩터링은 아래 규칙을 따른다.

- 새 거래 입력/수집 흐름은 `Transaction`이 아니라 `CollectedTransaction`으로 넣는다.
- 회계 확정, 정정, 반전, 잠금, 마감 판단은 `JournalEntry` 계열 기준으로 구현한다.
- 보고/분석의 공식 확정 수치는 `FinancialStatementSnapshot` 또는 그 근거인 `JournalEntry`, `ClosingSnapshot` 기준으로 읽는다.
- 임시 호환이 필요해도 `Transaction` 위에 새 회계 규칙을 더 얹지 않는다.

## 4. `Transaction`의 유지/제거 판단

현재 판단은 다음과 같다.

- `Transaction`은 당장 제거 대상이지만, 즉시 삭제 대상은 아니다.
- 이유: 스키마와 과거 설계 흔적은 남아 있지만, 현재 구현에서 적극 확장 중인 모델은 아니다.
- 따라서 당분간은 “읽기 호환 또는 데이터 이행 브리지 후보”로만 유지한다.
- 남은 참조 경로, 시드/마이그레이션 필요성, 실제 데이터 이관 계획이 정리되면 제거를 진행한다.

즉, 유지 전략은 “계속 사용”이 아니라 “새 기능 확장 금지 + 점진 제거 준비”다.

## 5. 정리 로드맵

현재 정리 계획은 아래 4단계로 고정한다.

| 단계 | 의미 | 현재 상태 |
| --- | --- | --- |
| 1. 의존성 동결 | 신규 기능이 레거시 Prisma `Transaction` 모델 위에 직접 규칙을 추가하지 못하게 막는다 | 완료 |
| 2. 브리지 표면 축소 | shorthand 명칭, 문서, 테스트/호환 레이어에 남은 흔적만 줄이고 공식 원장 판단은 계속 신규 회계 흐름에 고정한다 | 진행 중 |
| 3. 제거 준비 | Prisma migration, seed/test 정리, 데이터 backfill/rollback 기준, 삭제 순서를 명시한다 | 다음 단계 |
| 4. 스키마 제거 | 레거시 `Transaction` 모델과 관련 관계를 제거하고 문서/검증 기준을 같은 변경에서 맞춘다 | 3단계 완료 후 |

이 로드맵의 핵심은 "`Transaction`을 유지할 이유를 길게 설명하는 것"이 아니라 "`Transaction`이 더 커지지 못하도록 먼저 막고, 제거 준비가 끝나는 즉시 치운다"는 점을 명확히 보여주는 데 있다.

## 6. 제거 게이트

아래 조건이 모두 충족될 때 제거 작업을 진행한다.

- `apps/api/src`, `apps/web/src`, `packages/contracts` 기준으로 레거시 Prisma `Transaction` 모델을 직접 read/write하는 현재 런타임 경로가 없어야 한다.
- 공식 회계 숫자, 잠금/마감, 재무제표, 차기 이월이 `CollectedTransaction`, `JournalEntry`, `ClosingSnapshot`, `FinancialStatementSnapshot`, `CarryForwardRecord`만으로 성립해야 한다.
- Prisma migration 순서, 기존 데이터 처리 방식, rollback 기준이 문서와 함께 정리돼 있어야 한다.
- seed, 테스트 fixture, 문서 링크, reviewer 설명이 제거 이후 구조와 같은 기준으로 동시에 갱신돼야 한다.

## 7. 의미 보존 체크리스트

구조 개선 또는 화면 개편 시 아래 질문에 하나라도 `Transaction` 기준 답이 나오면 경계가 흐려진 것이다.

- 이 입력은 `CollectedTransaction`으로 들어가는가?
- 이 확정 회계 결과는 `JournalEntry`로 남는가?
- 이 보고 숫자는 `JournalEntry` 또는 `FinancialStatementSnapshot` 기준인가?
- 이 변경이 레거시 `Transaction` 의존을 새로 늘리지는 않는가?

## 8. 현재 한 줄 결론

현재 저장소에서 `Transaction`은 레거시 잔존 모델이고, 신규 회계 흐름의 공식 원장은 `JournalEntry`다.
