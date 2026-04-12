# LegacyTransaction 제거 준비 고정 메모

## 목적

이 문서는 `LegacyTransaction` 물리 제거 전까지 저장소 안에서 유지해야 하는 준비 정보를 짧고 명확하게 고정한다.

현재 목표는 레거시 브리지를 더 쓰는 것이 아니라, 삭제 직전까지 필요한 잔존 이유와 삭제 순서를 기계적으로 설명 가능하게 만드는 것이다.

실제 제거 PR에서 손대야 할 schema/code touchpoint 체크리스트는 [`docs/LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md`](./LEGACY_TRANSACTION_SCHEMA_REMOVAL_CHECKLIST.md)에 따로 고정한다.

## 현재 인벤토리

`LegacyTransaction` 잔존 지점은 아래로 제한한다.

| 위치                                                              | 현재 역할                                                             | 제거 전까지 남는 이유                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/api/prisma/schema.prisma`                                   | 물리 `Transaction` 테이블을 `LegacyTransaction`으로 명시              | 신규 모델과 이름 충돌을 막고 제거 대상을 분명히 유지                       |
| `apps/api/prisma/phase1-backbone.ts`                              | 레거시 rows에 `tenantId`/`ledgerId`를 backfill하는 유일한 직접 브리지 | pre-phase1 데이터를 신규 워크스페이스/장부 경계로 정리하는 마지막 안전장치 |
| `apps/api/prisma/backfill-phase1-backbone.ts`                     | 수동 backfill 실행 진입점                                             | 제거 전에 대상 DB를 정리할 CLI 통로 유지                                   |
| `apps/api/prisma/seed.ts`                                         | `ensurePhase1BackboneForUser` 호출만 수행                             | demo seed가 직접 레거시 rows를 만들지 않도록 bridge helper만 재사용        |
| `apps/api/test/legacy-transaction-boundary.test.ts`               | direct delegate/bridge import/doc 상태를 고정하는 경계 테스트         | 새 레거시 의존이 다시 늘어나지 못하게 막음                                 |
| `apps/api/test/collected-transactions.prisma.integration.test.ts` | 실DB 통합 테스트에서 backbone bootstrap 재사용                        | 신규 수집 거래 흐름 검증 전에 workspace/ledger 기반선을 일관되게 맞춤      |
| `apps/api/test/prisma-integration.test-support.ts`                | 실DB request/API 테스트 bootstrap 재사용                              | 테스트 컨텍스트를 현재 workspace/ledger 구조 기준으로 맞춤                 |
| `docs/ACCOUNTING_MODEL_BOUNDARY.md`                               | 레거시 경계와 제거 로드맵 설명                                        | reviewer가 현재 경계 판단을 한 문서에서 이해 가능하게 유지                 |
| `docs/completed/IN_REPO_EXECUTION_PLAN.md`                        | 저장소 내부 다음 단계 추적                                            | 제거 준비 작업의 완료 기준과 검증 범위를 유지                              |

현재 기준으로 `apps/api/src`, `apps/web/src`, `packages/contracts`에는 `LegacyTransaction` direct runtime dependency를 허용하지 않는다.

## 삭제 전 선행 조건

레거시 물리 제거 PR 전에는 아래 조건을 먼저 만족시킨다.

1. 대상 DB에 대해 `npm run db:backfill:phase1`로 phase1 backbone backfill을 실행한다.
2. backfill 후에도 신규 공식 회계 흐름이 `CollectedTransaction`, `JournalEntry`, `ClosingSnapshot`, `FinancialStatementSnapshot`, `CarryForwardRecord`만으로 성립하는지 확인한다.
3. `apps/api/src`, `apps/web/src`, `packages/contracts` 기준 direct dependency가 계속 0인지 경계 테스트와 코드 검색으로 확인한다.
4. demo seed가 새 레거시 rows를 만들지 않고 backbone helper만 거치는지 유지한다.
5. 제거 직전 스키마 변경 전에는 대상 DB 백업 또는 snapshot을 확보한다.

## 삭제 순서

실제 제거 PR은 아래 순서를 따른다.

1. 대상 환경에 `npm run db:backfill:phase1`를 실행해 레거시 rows의 workspace/ledger 정합성을 먼저 맞춘다.
2. 제거 대상 환경에서 현재 검증 기준(`check:quick`, `test:api`, 필요 시 `test:prisma`)을 다시 통과시킨다.
3. `apps/api/prisma/schema.prisma`에서 `LegacyTransaction` 모델과 관련 relation을 제거하는 migration을 별도 PR로 만든다.
4. migration과 같은 변경에서 boundary test, seed bootstrap, 문서 링크를 새 기준으로 같이 정리한다.
5. Prisma client regenerate 후 애플리케이션 검증을 다시 수행한다.

핵심은 `LegacyTransaction` 제거를 신규 기능 변경과 섞지 않고, "schema 제거 + 문서/테스트 동기화" PR로 따로 다루는 것이다.

## Rollback 기준

제거 migration 적용 전:

- 현재 브리지 경계를 유지한 채 backfill 상태만 다시 검증한다.
- 레거시 rows를 수동으로 다시 쓰지 말고 `phase1-backbone` 기준으로만 재정렬한다.

제거 migration 적용 후:

- 사전 확보한 DB backup/snapshot으로 복구하는 것을 기본 rollback으로 본다.
- 애플리케이션 코드만 되돌리고 삭제된 물리 테이블을 수동 재구성하는 방식은 기본 전략으로 쓰지 않는다.

## 준비 완료 조건

아래가 모두 맞으면 저장소 내부 준비는 끝난 것으로 본다.

- direct delegate 사용은 `apps/api/prisma/phase1-backbone.ts` 하나로 고정돼 있다.
- `phase1-backbone` import surface가 seed/backfill/test bootstrap 허용 지점으로만 제한돼 있다.
- schema 제거 PR에서 지워야 할 relation/model/code touchpoint가 별도 체크리스트 문서로 정리돼 있다.
- 삭제 순서와 rollback 기준이 문서로 설명 가능하다.
- 제거 PR이 들어오면 schema migration과 boundary 문서/테스트 정리만 집중해서 진행할 수 있다.
