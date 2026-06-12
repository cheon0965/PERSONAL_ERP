// 모듈 간 import는 깊은 내부 파일 대신 이 진입점을 사용해야 한다.
export { CollectedTransactionsModule } from './collected-transactions.module';
export {
  assertCollectedTransactionCanBeConfirmed,
  assertCollectedTransactionCanBeCorrected,
  assertCollectedTransactionCanBeDeleted,
  assertCollectedTransactionCanBeUpdated
} from './domain/collected-transaction-transition.policy';
export { mapCollectedTransactionTypeToLedgerTransactionCode } from './application/mappers/collected-transaction-type.mapper';
export { resolveManualCollectedTransactionStatus } from './domain/manual-collected-transaction-status.policy';
export { MissingOwnedCollectedTransactionReferenceError } from './domain/collected-transaction-policy';
export type {
  ConfirmationCollectedTransaction,
  CreateConfirmationJournalEntryInput
} from './application/ports/confirm-collected-transaction-store.port';
export {
  assertConfirmJournalAccountSubjectIdsResolved,
  assertConfirmJournalLinesSupported,
  resolveConfirmCollectedTransactionJournalLines
} from './application/policies/confirm-collected-transaction.policy';
export { BulkConfirmCollectedTransactionsUseCase } from './application/use-cases/bulk-confirm-collected-transactions.use-case';
export { ConfirmCollectedTransactionUseCase } from './application/use-cases/confirm-collected-transaction.use-case';
export { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
export { DeleteCollectedTransactionUseCase } from './application/use-cases/delete-collected-transaction.use-case';
export { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
export { UpdateCollectedTransactionUseCase } from './application/use-cases/update-collected-transaction.use-case';
export { PrismaCollectedTransactionStoreAdapter } from './infrastructure/prisma/prisma-collected-transaction-store.adapter';
export { PrismaReferenceOwnershipAdapter } from './infrastructure/prisma/prisma-reference-ownership.adapter';
