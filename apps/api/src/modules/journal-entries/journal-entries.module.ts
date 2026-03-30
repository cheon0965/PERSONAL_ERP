import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/accounting-periods.module';
import { CorrectJournalEntryUseCase } from './correct-journal-entry.use-case';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { ReverseJournalEntryUseCase } from './reverse-journal-entry.use-case';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [JournalEntriesController],
  providers: [
    JournalEntriesService,
    ReverseJournalEntryUseCase,
    CorrectJournalEntryUseCase
  ],
  exports: [JournalEntriesService]
})
export class JournalEntriesModule {}
