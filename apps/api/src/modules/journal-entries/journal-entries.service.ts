import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser, JournalEntryItem } from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { mapJournalEntryRecordToItem } from './journal-entry-item.mapper';

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findRecent(user: AuthenticatedUser): Promise<JournalEntryItem[]> {
    const workspace = requireCurrentWorkspace(user);
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
        sourceCollectedTransaction: {
          select: {
            id: true,
            title: true
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
      },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
      take: 100
    });

    return entries.map(mapJournalEntryRecordToItem);
  }
}
