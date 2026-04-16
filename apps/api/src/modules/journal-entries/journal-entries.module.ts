import { Module } from '@nestjs/common';
import { AccountingPeriodsModule } from '../accounting-periods/public';
import { JournalEntryAdjustmentStorePort } from './application/ports/journal-entry-adjustment-store.port';
import { CorrectJournalEntryUseCase } from './correct-journal-entry.use-case';
import { PrismaJournalEntryAdjustmentStoreAdapter } from './infrastructure/prisma/prisma-journal-entry-adjustment-store.adapter';
import { JournalEntriesController } from './journal-entries.controller';
import { JournalEntriesService } from './journal-entries.service';
import { ReverseJournalEntryUseCase } from './reverse-journal-entry.use-case';

@Module({
  imports: [AccountingPeriodsModule],
  controllers: [JournalEntriesController],
  providers: [
    JournalEntriesService,
    PrismaJournalEntryAdjustmentStoreAdapter,
    {
      provide: JournalEntryAdjustmentStorePort,
      useExisting: PrismaJournalEntryAdjustmentStoreAdapter
    },
    ReverseJournalEntryUseCase,
    CorrectJournalEntryUseCase
  ],
  exports: [JournalEntriesService]
})
export class JournalEntriesModule {}
