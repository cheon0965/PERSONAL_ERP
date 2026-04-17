// Cross-module imports should use this entrypoint instead of deep internal files.
export { JournalEntriesModule } from './journal-entries.module';
export { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
export type { JournalEntryRecord } from './journal-entry-item.mapper';
export { buildJournalEntryEntryNumber } from './journal-entry-adjustment.policy';
