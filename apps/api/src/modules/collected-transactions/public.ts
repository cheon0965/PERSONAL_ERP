// Cross-module imports should use this entrypoint instead of deep internal files.
export { CollectedTransactionsModule } from './collected-transactions.module';
export {
  assertCollectedTransactionCanBeConfirmed,
  assertCollectedTransactionCanBeCorrected
} from './collected-transaction-transition.policy';
