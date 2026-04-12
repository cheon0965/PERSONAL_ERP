# LegacyTransaction 스키마 제거 체크리스트

## 목적

이 문서는 `LegacyTransaction` 물리 제거를 실제로 수행하는 전용 PR에서 어떤 스키마와 코드 지점을 같은 변경으로 정리해야 하는지 고정한다.

삭제 순서와 rollback 기준의 운영 메모는 [`docs/LEGACY_TRANSACTION_REMOVAL_PREP.md`](./LEGACY_TRANSACTION_REMOVAL_PREP.md)를 따르고, 이 문서는 그중에서도 "정확히 어디를 지울지"를 reviewer 기준으로 짧고 기계적으로 확인할 수 있게 만드는 용도다.

핵심 원칙은 아래 두 가지다.

- `LegacyTransaction` 제거는 신규 기능 변경과 섞지 않는다.
- 제거 PR은 "스키마 삭제 + 브리지 코드 축소 + 문서/테스트 동기화"만 책임진다.

## 스키마 삭제 대상

`apps/api/prisma/schema.prisma`에서 아래 항목을 같은 migration에서 정리한다.

- `User.legacyTransactions`
- `Tenant.legacyTransactions @relation("TenantLegacyTransactions")`
- `Ledger.legacyTransactions @relation("LedgerLegacyTransactions")`
- `Account.legacyTransactions`
- `Category.legacyTransactions`
- `model LegacyTransaction`
- `LegacyTransaction` 안의 `@@map("Transaction")`

migration 결과에서는 아래가 함께 반영돼야 한다.

- 물리 테이블 `Transaction` 삭제
- 관련 foreign key 삭제
- 관련 index 삭제

핵심은 relation 필드 하나만 지우는 것이 아니라, Prisma schema와 실제 DB 테이블 삭제가 한 PR 안에서 같이 닫혀야 한다는 점이다.

## 같은 PR에서 같이 정리할 코드

### 1. `apps/api/prisma/phase1-backbone.ts`

이 파일은 현재 레거시 rows에 직접 닿는 유일한 브리지다.
제거 PR에서는 아래 항목을 같이 정리한다.

- `firstLegacyTransaction` 후보 계산
- `prisma.legacyTransaction.findFirst(...)`
- `prisma.legacyTransaction.updateMany(...)`
- `summary.legacyRowsBackfilled.legacyTransactions`
- summary 출력의 `legacy transactions backfilled` 줄

즉, 제거 후 `phase1-backbone.ts`가 계속 남더라도 더 이상 `legacyTransaction` delegate를 직접 사용하지 않아야 한다.

### 2. `apps/api/prisma/backfill-phase1-backbone.ts`

이 진입점은 현재 제거 준비용 수동 runner다.
제거 PR에서는 아래 둘 중 하나로 정리한다.

- `phase1-backbone`이 여전히 account/category/recurring-rule/vehicle backbone 정리에 필요하면, 설명 문구에서 `LegacyTransaction` 제거 준비 wording을 걷어낸다.
- 더 이상 필요 없으면 runner 자체를 제거한다.

### 3. `apps/api/test/legacy-transaction-boundary.test.ts`

이 테스트는 현재 "레거시 노출이 아직 존재한다"는 상태를 잠그고 있다.
제거 PR에서는 아래 방향으로 같이 바꾼다.

- `schema exposes the legacy table explicitly as LegacyTransaction` 기대값 제거
- active allowlist에서 `LegacyTransaction` 관련 파일 제거
- direct delegate 사용이 더 이상 0개가 됐는지 확인하는 방향으로 전환

### 4. 활성 문서

아래 문서는 제거 PR에서 새 상태에 맞게 같이 정리한다.

- `docs/ACCOUNTING_MODEL_BOUNDARY.md`
- `docs/LEGACY_TRANSACTION_REMOVAL_PREP.md`
- `docs/completed/IN_REPO_EXECUTION_PLAN.md`
- `docs/VALIDATION_NOTES.md`
- `docs/README.md`

## PR 실행 순서

1. 대상 DB에 `npm run db:backfill:phase1`를 실행한다.
2. 제거 대상 환경의 DB backup 또는 snapshot을 확보한다.
3. `apps/api/prisma/schema.prisma` 기준 제거 migration을 만든다.
4. 같은 PR에서 bridge 코드, boundary test, 활성 문서를 새 기준으로 맞춘다.
5. Prisma client regenerate 후 애플리케이션 검증을 다시 수행한다.

## 검증

제거 PR에서는 최소 아래를 다시 확인한다.

- `npm run db:generate`
- `npm run check:quick`
- `npm run test:api`
- `npm run test:prisma`

필요하면 `npm run build`와 `npm run test:e2e`도 follow-up으로 다시 확인하되, 제거 PR의 기본 gate는 schema와 API 경계가 깨지지 않는지 먼저 보는 데 둔다.
