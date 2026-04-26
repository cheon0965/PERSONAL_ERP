# 구형 거래 모델 제거 이후 회계 경계

## 목적

이 문서는 현재 저장소에서 구형 `Transaction` 제거 이후 신규 회계 흐름의 경계를 짧고 명확하게 고정하기 위한 기준 문서다.

상세 도메인 규칙은 [`docs/domain/business-logic-draft.md`](./domain/business-logic-draft.md), [`docs/domain/core-entity-definition.md`](./domain/core-entity-definition.md)를 따른다. 이 문서는 그 기준을 현재 구현과 연결해, 이후 리팩터링이 의미 보존 리팩터링으로 유지되도록 돕는다.

이전 제거 준비 메모와 체크리스트는 이력 보존용으로 `docs/completed/`에 보관한다.

## 1. 신규 기준 원장

현재 프로젝트에서 공식 회계 진실 원천은 아래처럼 구분한다.

- 운영 입력 원천: 수집 거래(`CollectedTransaction`)
- 공식 확정 원장: 전표 / 전표 라인(`JournalEntry` / `JournalLine`)
- 마감 기준 산출물: 마감 스냅샷(`ClosingSnapshot`)
- 공식 보고 산출물: 재무제표 스냅샷(`FinancialStatementSnapshot`)
- 차기 기간 연결: 차기 이월 기록(`CarryForwardRecord`)

즉, 신규 회계 흐름에서 공식 회계 숫자와 확정 상태를 판단할 때 `Transaction`을 기준으로 삼지 않는다.

## 2. `Transaction` 제거 결과

현재 저장소 기준으로 구형 `Transaction` 물리 표면은 활성 Prisma schema와 런타임 경로에서 제거됐다.

핵심 변화는 아래와 같다.

- 웹의 `/transactions` 화면은 계속 수집 거래(`CollectedTransaction`) 축약 이름을 사용한다.
- 현재 API 모듈은 `collected-transactions`, `journal-entries`, `financial-statements`, `carry-forwards` 중심으로 동작한다.
- 차량 연료/정비 이력은 회계 연동을 켠 경우 표준 수집 거래(`CollectedTransaction`)를 생성하는 운영 원천이며, 차량 전용 전표 경로나 별도 회계 원장을 만들지 않는다.
- `apps/api/src`, `apps/web/src`, `packages/contracts` 안에서는 구형 `Transaction`을 직접 읽고 쓰는 현재 런타임 경로를 두지 않는다.
- `apps/api/prisma/phase1-backbone.ts`는 여전히 사업장/계정/카테고리/차량 기반 구조 정리를 담당하지만, 더 이상 구형 거래 델리게이트를 사용하지 않는다.
- 데모 시드와 요청 모의 데이터도 신규 회계 흐름만을 기본값으로 유지한다.

즉, 현재 남아 있는 것은 "구형 모델과 섞인 과도기"가 아니라 "신규 회계 흐름이 기본값인 상태"다.

## 3. 신규 기능 작성 규칙

앞으로 신규 기능이나 리팩터링은 아래 규칙을 따른다.

- 새 거래 입력/수집 흐름은 `Transaction`이 아니라 수집 거래(`CollectedTransaction`)로 넣는다.
- 차량 연료/정비 같은 운영 자산 기반 비용도 회계 숫자에 반영하려면 수집 거래(`CollectedTransaction`)로 연결한 뒤 기존 전표 확정 흐름을 사용한다.
- 수집 거래와 조정 전표 입력은 최신 진행월 범위 안에서만 허용하고, 다음 월은 최근 월 마감 이후 여는 월별 운영 모델을 따른다.
- 회계 확정, 정정, 반전, 잠금, 마감 판단은 `JournalEntry` 계열 기준으로 구현한다.
- 보고/분석의 공식 확정 수치는 재무제표 스냅샷(`FinancialStatementSnapshot`) 또는 그 근거인 `JournalEntry`, `ClosingSnapshot` 기준으로 읽는다.
- 임시 호환이 필요해도 `Transaction` 위에 새 회계 규칙을 더 얹지 않는다.

## 4. 현재 유지 판단

현재 판단은 다음과 같다.

- 구형 `Transaction`은 더 이상 활성 모델이 아니며, 신규 기능 확장 대상도 아니다.
- 현재 저장소 기준으로는 Prisma 스키마, 시드, 테스트, 문서의 활성 표면에서 물리 제거까지 반영됐다.
- 제거 준비 메모와 체크리스트는 완료 이력으로만 `docs/completed/`에 남긴다.

즉, 현재 전략은 "구형 모델 재도입 금지 + 신규 회계 경계 유지"다.

## 5. 정리 상태

이 정리 작업은 아래 4단계를 모두 완료한 상태로 본다.

| 단계                | 의미                                                                                       | 현재 상태 |
| ------------------- | ------------------------------------------------------------------------------------------ | --------- |
| 1. 의존성 동결      | 신규 기능이 레거시 Prisma `Transaction` 모델 위에 직접 규칙을 추가하지 못하게 막는다       | 완료      |
| 2. 브리지 표면 축소 | 활성 런타임/문서/테스트 표면을 허용 목록과 경계 테스트로 고정한다                          | 완료      |
| 3. 제거 준비        | Prisma 마이그레이션, 시드/테스트 정리, 데이터 backfill/rollback 기준, 삭제 순서를 명시한다 | 완료      |
| 4. 스키마 제거      | 구형 `Transaction` 모델과 관련 관계를 제거하고 문서/검증 기준을 같은 변경에서 맞춘다       | 완료      |

핵심은 "`Transaction`을 더 이상 설명 가능한 활성 경계로 남겨두지 않는다"는 점이다.
즉, 현재 회계 경계는 제거 준비가 아니라 제거 완료 상태를 기준으로 읽어야 한다.

## 6. 유지 게이트

아래 조건이 계속 유지돼야 현재 경계가 보존된다.

- `apps/api/src`, `apps/web/src`, `packages/contracts` 기준으로 레거시 Prisma `Transaction` 모델을 직접 읽고 쓰는 현재 런타임 경로가 없어야 한다.
- 공식 회계 숫자, 잠금/마감, 재무제표, 차기 이월이 수집 거래(`CollectedTransaction`), `JournalEntry`, `ClosingSnapshot`, `FinancialStatementSnapshot`, `CarryForwardRecord`만으로 성립해야 한다.
- 차량 연료/정비 이력처럼 운영 화면에서 시작한 비용도 확정 전에는 연결 수집거래만 수정/해제할 수 있고, 전표 확정 후에는 원본 overwrite가 아니라 `JournalEntry` 반전/정정 흐름으로 처리해야 한다.
- 시드, 테스트 fixture, 문서 링크, 리뷰어 설명이 제거 이후 구조와 같은 기준으로 유지돼야 한다.
- 이후 새 기능이나 리팩터링이 다시 구형 거래 델리게이트를 도입하지 않아야 한다.

## 7. 의미 보존 체크리스트

구조 개선 또는 화면 개편 시 아래 질문에 하나라도 `Transaction` 기준 답이 나오면 경계가 흐려진 것이다.

- 이 입력은 수집 거래(`CollectedTransaction`)로 들어가는가?
- 운영 자산 화면에서 시작한 비용이라면 표준 수집 거래(`CollectedTransaction`)로 연결되는가?
- 이 확정 회계 결과는 `JournalEntry`로 남는가?
- 이 보고 숫자는 `JournalEntry` 또는 `FinancialStatementSnapshot` 기준인가?
- 이 변경이 레거시 `Transaction` 의존을 새로 늘리지는 않는가?

## 8. 현재 한 줄 결론

현재 저장소에서 구형 `Transaction`은 활성 회계 모델이 아니며, 신규 회계 흐름의 공식 원장은 `JournalEntry`다.
