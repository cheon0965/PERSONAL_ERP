import { Prisma } from '@prisma/client';

export const journalEntryItemInclude =
  Prisma.validator<Prisma.JournalEntryInclude>()({
    sourceCollectedTransaction: {
      select: {
        id: true,
        title: true,
        status: true
      }
    },
    reversesJournalEntry: {
      select: {
        id: true,
        entryNumber: true
      }
    },
    reversedByJournalEntry: {
      select: {
        id: true,
        entryNumber: true
      }
    },
    correctsJournalEntry: {
      select: {
        id: true,
        entryNumber: true
      }
    },
    correctionEntries: {
      select: {
        id: true,
        entryNumber: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    },
    lines: {
      include: {
        accountSubject: {
          select: {
            code: true,
            name: true
          }
        },
        fundingAccount: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        lineNumber: 'asc'
      }
    }
  });

export type JournalEntryItemRecord = Prisma.JournalEntryGetPayload<{
  include: typeof journalEntryItemInclude;
}>;
