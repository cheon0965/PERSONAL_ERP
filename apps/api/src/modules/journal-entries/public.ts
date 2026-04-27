// 모듈 간 import는 깊은 내부 파일 대신 이 진입점을 사용해야 한다.
export { JournalEntriesModule } from './journal-entries.module';
export { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';
export type { JournalEntryRecord } from './journal-entry-item.mapper';
export { buildJournalEntryEntryNumber } from './journal-entry-adjustment.policy';
