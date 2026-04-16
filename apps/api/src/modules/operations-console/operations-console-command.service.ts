import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateOperationsExportRequest,
  CreateOperationsNoteRequest,
  OperationsExportResult,
  OperationsExportScopeItem,
  OperationsExportsResponse,
  OperationsNoteItem,
  OperationsNotesResponse
} from '@personal-erp/contracts';
import { OperationalNoteKind } from '@prisma/client';
import { fromPrismaMoneyWon } from '../../common/money/prisma-money';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  exportScopes,
  isExportScope,
  mapOperationalNote,
  normalizeOptionalText,
  readDateValue,
  readExportRowCount,
  readExportScopeCadence,
  readExportScopeDescription,
  readExportScopeLabel,
  readExportSourceDates,
  readLatestDateValue,
  readLatestIso,
  readPeriodLabel,
  readPeriodRecordLabel,
  readScopeRangeLabel,
  toCsv,
  type BuildExportPayloadInput,
  type BuildExportPayloadResult,
  type CsvRow,
  type ExportPeriodRecord
} from './operations-console-command.support';

@Injectable()
export class OperationsConsoleCommandService {
  constructor(private readonly prisma: PrismaService) {}

  async getExports(
    user: AuthenticatedUser
  ): Promise<OperationsExportsResponse> {
    const workspace = requireCurrentWorkspace(user);
    const generatedAt = new Date().toISOString();
    const items = await this.buildExportScopeItems(
      workspace.tenantId,
      workspace.ledgerId
    );

    return {
      generatedAt,
      lastExportedAt: readLatestIso(items.map((item) => item.latestExportedAt)),
      items
    };
  }

  async runExport(
    user: AuthenticatedUser,
    input: CreateOperationsExportRequest
  ): Promise<OperationsExportResult> {
    const workspace = requireCurrentWorkspace(user);
    const period = await this.findExportPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      input.periodId
    );
    const generatedAt = new Date().toISOString();
    const exportPayload = await this.buildExportPayload({
      scope: input.scope,
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      periodId: period?.id ?? null,
      rangeLabel: period
        ? readPeriodRecordLabel(period)
        : readScopeRangeLabel(input.scope)
    });

    return {
      exportId: `operations-export-${Date.now()}`,
      scope: input.scope,
      fileName: `personal-erp-${input.scope.toLowerCase().replaceAll('_', '-')}-${generatedAt.slice(0, 10)}.csv`,
      contentType: 'text/csv; charset=utf-8',
      encoding: 'utf-8',
      rowCount: exportPayload.rowCount,
      rangeLabel: exportPayload.rangeLabel,
      generatedAt,
      payload: exportPayload.payload
    };
  }

  async getNotes(user: AuthenticatedUser): Promise<OperationsNotesResponse> {
    const workspace = requireCurrentWorkspace(user);
    const notes = await this.prisma.workspaceOperationalNote.findMany({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      include: {
        period: {
          select: {
            year: true,
            month: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return {
      generatedAt: new Date().toISOString(),
      totalCount: notes.length,
      items: notes.map(mapOperationalNote)
    };
  }

  async createNote(
    user: AuthenticatedUser,
    input: CreateOperationsNoteRequest
  ): Promise<OperationsNoteItem> {
    const workspace = requireCurrentWorkspace(user);
    const period = await this.findExportPeriod(
      workspace.tenantId,
      workspace.ledgerId,
      input.periodId
    );
    const note = await this.prisma.workspaceOperationalNote.create({
      data: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: period?.id ?? null,
        authorMembershipId: workspace.membershipId,
        kind: input.kind as OperationalNoteKind,
        title: input.title.trim(),
        body: input.body.trim(),
        relatedHref: normalizeOptionalText(input.relatedHref)
      },
      include: {
        period: {
          select: {
            year: true,
            month: true
          }
        }
      }
    });

    return mapOperationalNote(note);
  }

  private async buildExportScopeItems(
    tenantId: string,
    ledgerId: string
  ): Promise<OperationsExportScopeItem[]> {
    const [
      accounts,
      categories,
      accountSubjects,
      ledgerTransactionTypes,
      collectedTransactions,
      journalEntries,
      financialStatementSnapshots,
      exportAuditEvents
    ] = await Promise.all([
      this.prisma.account.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
      }),
      this.prisma.category.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ kind: 'asc' }, { name: 'asc' }]
      }),
      this.prisma.accountSubject.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ statementType: 'asc' }, { sortOrder: 'asc' }]
      }),
      this.prisma.ledgerTransactionType.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ flowKind: 'asc' }, { sortOrder: 'asc' }]
      }),
      this.prisma.collectedTransaction.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ occurredOn: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.journalEntry.findMany({
        where: { tenantId, ledgerId },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }]
      }),
      this.prisma.financialStatementSnapshot.findMany({
        where: { tenantId, ledgerId },
        include: {
          period: {
            select: {
              year: true,
              month: true
            }
          }
        }
      }),
      this.prisma.workspaceAuditEvent.findMany({
        where: {
          tenantId,
          action: 'operations_export.run',
          result: 'SUCCESS',
          resourceType: 'operations_export'
        },
        take: 50
      })
    ]);
    const latestExportedAtByScope = new Map<string, string>();

    for (const event of exportAuditEvents) {
      if (!isExportScope(event.resourceId)) {
        continue;
      }

      if (!latestExportedAtByScope.has(event.resourceId)) {
        latestExportedAtByScope.set(
          event.resourceId,
          event.occurredAt.toISOString()
        );
      }
    }

    return exportScopes.map((scope) => {
      const sourceDates = readExportSourceDates(scope, {
        accounts,
        categories,
        accountSubjects,
        ledgerTransactionTypes,
        collectedTransactions,
        journalEntries,
        financialStatementSnapshots
      });
      const rowCount = readExportRowCount(scope, {
        accounts,
        categories,
        accountSubjects,
        ledgerTransactionTypes,
        collectedTransactions,
        journalEntries,
        financialStatementSnapshots
      });

      return {
        scope,
        label: readExportScopeLabel(scope),
        description: readExportScopeDescription(scope),
        rowCount,
        rangeLabel: readScopeRangeLabel(scope),
        latestSourceAt: readLatestDateValue(sourceDates),
        latestExportedAt: latestExportedAtByScope.get(scope) ?? null,
        recommendedCadence: readExportScopeCadence(scope),
        enabled: rowCount > 0
      };
    });
  }

  private async findExportPeriod(
    tenantId: string,
    ledgerId: string,
    rawPeriodId: string | null | undefined
  ): Promise<ExportPeriodRecord | null> {
    const periodId = normalizeOptionalText(rawPeriodId);
    if (!periodId) {
      return null;
    }

    const period = await this.prisma.accountingPeriod.findFirst({
      where: {
        id: periodId,
        tenantId,
        ledgerId
      }
    });

    if (!period) {
      throw new NotFoundException(
        '내보내기 대상 운영 기간을 찾을 수 없습니다.'
      );
    }

    return {
      id: period.id,
      year: period.year,
      month: period.month
    };
  }

  private async buildExportPayload(
    input: BuildExportPayloadInput
  ): Promise<BuildExportPayloadResult> {
    switch (input.scope) {
      case 'REFERENCE_DATA':
        return this.buildReferenceDataExport(input);
      case 'COLLECTED_TRANSACTIONS':
        return this.buildCollectedTransactionsExport(input);
      case 'JOURNAL_ENTRIES':
        return this.buildJournalEntriesExport(input);
      case 'FINANCIAL_STATEMENTS':
        return this.buildFinancialStatementsExport(input);
      default:
        return {
          rowCount: 0,
          rangeLabel: input.rangeLabel,
          payload: toCsv([['message'], ['Unsupported export scope']])
        };
    }
  }

  private async buildReferenceDataExport(
    input: BuildExportPayloadInput
  ): Promise<BuildExportPayloadResult> {
    const [accounts, categories, accountSubjects, ledgerTransactionTypes] =
      await Promise.all([
        this.prisma.account.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          orderBy: [{ status: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }]
        }),
        this.prisma.category.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          orderBy: [{ kind: 'asc' }, { name: 'asc' }]
        }),
        this.prisma.accountSubject.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          orderBy: [{ statementType: 'asc' }, { sortOrder: 'asc' }]
        }),
        this.prisma.ledgerTransactionType.findMany({
          where: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          },
          orderBy: [{ flowKind: 'asc' }, { sortOrder: 'asc' }]
        })
      ]);
    const rows: CsvRow[] = [
      [
        'recordType',
        'id',
        'code',
        'name',
        'kind',
        'status',
        'flowKind',
        'postingPolicyKey',
        'sortOrder',
        'balanceWon',
        'updatedAt'
      ],
      ...accounts.map((account) => [
        'funding_account',
        account.id,
        '',
        account.name,
        account.type,
        account.status,
        '',
        '',
        account.sortOrder,
        fromPrismaMoneyWon(account.balanceWon),
        readDateValue(account.updatedAt)
      ]),
      ...categories.map((category) => [
        'category',
        category.id,
        '',
        category.name,
        category.kind,
        category.isActive ? 'ACTIVE' : 'INACTIVE',
        '',
        '',
        category.sortOrder,
        '',
        readDateValue(category.updatedAt)
      ]),
      ...accountSubjects.map((subject) => [
        'account_subject',
        subject.id,
        subject.code,
        subject.name,
        subject.subjectKind,
        subject.isActive ? 'ACTIVE' : 'INACTIVE',
        '',
        '',
        subject.sortOrder,
        '',
        readDateValue(subject.updatedAt)
      ]),
      ...ledgerTransactionTypes.map((transactionType) => [
        'ledger_transaction_type',
        transactionType.id,
        transactionType.code,
        transactionType.name,
        '',
        transactionType.isActive ? 'ACTIVE' : 'INACTIVE',
        transactionType.flowKind,
        transactionType.postingPolicyKey,
        transactionType.sortOrder,
        '',
        readDateValue(transactionType.updatedAt)
      ])
    ];

    return {
      rowCount: rows.length - 1,
      rangeLabel: input.rangeLabel,
      payload: toCsv(rows)
    };
  }

  private async buildCollectedTransactionsExport(
    input: BuildExportPayloadInput
  ): Promise<BuildExportPayloadResult> {
    const transactions = await this.prisma.collectedTransaction.findMany({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        ...(input.periodId ? { periodId: input.periodId } : {})
      },
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }]
    });
    const rows: CsvRow[] = [
      [
        'id',
        'periodId',
        'occurredOn',
        'title',
        'amountWon',
        'status',
        'ledgerTransactionTypeId',
        'fundingAccountId',
        'categoryId',
        'importBatchId',
        'importedRowId',
        'memo',
        'createdAt',
        'updatedAt'
      ],
      ...transactions.map((transaction) => [
        transaction.id,
        transaction.periodId,
        readDateValue(transaction.occurredOn),
        transaction.title,
        fromPrismaMoneyWon(transaction.amount),
        transaction.status,
        transaction.ledgerTransactionTypeId,
        transaction.fundingAccountId,
        transaction.categoryId,
        transaction.importBatchId,
        transaction.importedRowId,
        transaction.memo,
        readDateValue(transaction.createdAt),
        readDateValue(transaction.updatedAt)
      ])
    ];

    return {
      rowCount: rows.length - 1,
      rangeLabel: input.rangeLabel,
      payload: toCsv(rows)
    };
  }

  private async buildJournalEntriesExport(
    input: BuildExportPayloadInput
  ): Promise<BuildExportPayloadResult> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        ...(input.periodId ? { periodId: input.periodId } : {})
      },
      include: {
        lines: {
          orderBy: {
            lineNumber: 'asc'
          }
        }
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }]
    });
    const rows: CsvRow[] = [
      [
        'entryId',
        'periodId',
        'entryNumber',
        'entryDate',
        'sourceKind',
        'status',
        'memo',
        'lineNumber',
        'accountSubjectId',
        'fundingAccountId',
        'debitAmountWon',
        'creditAmountWon',
        'lineDescription',
        'createdAt'
      ],
      ...entries.flatMap((entry) =>
        entry.lines.length === 0
          ? [
              [
                entry.id,
                entry.periodId,
                entry.entryNumber,
                readDateValue(entry.entryDate),
                entry.sourceKind,
                entry.status,
                entry.memo,
                '',
                '',
                '',
                '',
                '',
                '',
                readDateValue(entry.createdAt)
              ] satisfies CsvRow
            ]
          : entry.lines.map((line) => [
              entry.id,
              entry.periodId,
              entry.entryNumber,
              readDateValue(entry.entryDate),
              entry.sourceKind,
              entry.status,
              entry.memo,
              line.lineNumber,
              line.accountSubjectId,
              line.fundingAccountId,
              fromPrismaMoneyWon(line.debitAmount),
              fromPrismaMoneyWon(line.creditAmount),
              line.description,
              readDateValue(entry.createdAt)
            ])
      )
    ];

    return {
      rowCount: rows.length - 1,
      rangeLabel: input.rangeLabel,
      payload: toCsv(rows)
    };
  }

  private async buildFinancialStatementsExport(
    input: BuildExportPayloadInput
  ): Promise<BuildExportPayloadResult> {
    const snapshots = await this.prisma.financialStatementSnapshot.findMany({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        ...(input.periodId ? { periodId: input.periodId } : {})
      },
      include: {
        period: {
          select: {
            year: true,
            month: true
          }
        }
      }
    });
    const rows: CsvRow[] = [
      [
        'id',
        'periodId',
        'periodLabel',
        'statementKind',
        'currency',
        'payloadJson',
        'createdAt',
        'updatedAt'
      ],
      ...snapshots.map((snapshot) => [
        snapshot.id,
        snapshot.periodId,
        snapshot.period
          ? readPeriodLabel(snapshot.period.year, snapshot.period.month)
          : '',
        snapshot.statementKind,
        snapshot.currency,
        JSON.stringify(snapshot.payload),
        readDateValue(snapshot.createdAt),
        readDateValue(snapshot.updatedAt)
      ])
    ];

    return {
      rowCount: rows.length - 1,
      rangeLabel: input.rangeLabel,
      payload: toCsv(rows)
    };
  }
}
