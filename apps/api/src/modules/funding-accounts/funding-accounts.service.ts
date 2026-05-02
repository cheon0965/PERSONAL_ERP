import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CompleteFundingAccountBootstrapRequest,
  CreateFundingAccountRequest,
  FundingAccountItem,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import {
  AccountingPeriodStatus,
  AuditActorType,
  JournalEntrySourceKind,
  JournalEntryStatus,
  Prisma
} from '@prisma/client';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import { buildJournalEntryEntryNumber } from '../journal-entries/journal-entry-adjustment.policy';
import { mapFundingAccountRecordToItem } from './funding-account.mapper';
import { readWorkspaceFundingAccountLiveBalances } from './funding-account-live-balance.reader';
import { FundingAccountsRepository } from './funding-accounts.repository';

const ASSET_SUBJECT_CODE = '1010';
const LIABILITY_SUBJECT_CODE = '2100';
const EQUITY_SUBJECT_CODE = '3100';

@Injectable()
export class FundingAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fundingAccountsRepository: FundingAccountsRepository
  ) {}

  async findAll(user: AuthenticatedUser): Promise<FundingAccountItem[]> {
    return this.findAllWithOptions(user);
  }

  async findAllWithOptions(
    user: AuthenticatedUser,
    input?: {
      includeInactive?: boolean;
    }
  ): Promise<FundingAccountItem[]> {
    const workspace = requireCurrentWorkspace(user);

    const accounts = await readWorkspaceFundingAccountLiveBalances(
      this.prisma,
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      input
    );

    return accounts.map(mapFundingAccountRecordToItem);
  }

  async create(
    user: AuthenticatedUser,
    input: CreateFundingAccountRequest
  ): Promise<FundingAccountItem> {
    const workspace = requireCurrentWorkspace(user);
    const normalizedName = normalizeFundingAccountName(input.name);

    await this.assertNoDuplicateFundingAccount({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      normalizedName
    });

    const initialBalanceWon = input.initialBalanceWon ?? 0;

    if (initialBalanceWon <= 0) {
      const created = await this.fundingAccountsRepository.createInWorkspace(
        workspace.userId,
        workspace.tenantId,
        workspace.ledgerId,
        {
          name: normalizedName,
          type: input.type
        }
      );

      return mapFundingAccountRecordToItem(created);
    }

    // 초기 잔액이 있으면 자금수단 생성 + 기초전표 생성을 하나의 트랜잭션으로 묶는다.
    const created = await this.prisma.$transaction(async (tx) => {
      const sortOrder = await readNextFundingAccountSortOrder(
        tx,
        workspace.tenantId,
        workspace.ledgerId
      );
      const account = await tx.account.create({
        data: {
          userId: workspace.userId,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          name: normalizedName,
          normalizedName: normalizeCaseInsensitiveText(normalizedName),
          type: input.type,
          balanceWon: initialBalanceWon,
          bootstrapStatus: resolveBootstrapStatusAfterOpeningBalance(
            input.type
          ),
          sortOrder
        }
      });

      await this.createOpeningBalanceJournalEntry({
        tx,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        membershipId: workspace.membershipId,
        fundingAccountId: account.id,
        fundingAccountType: input.type,
        initialBalanceWon
      });

      return account;
    });

    return mapFundingAccountRecordToItem(created);
  }

  async completeBootstrap(
    user: AuthenticatedUser,
    fundingAccountId: string,
    input: CompleteFundingAccountBootstrapRequest
  ): Promise<FundingAccountItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const initialBalanceWon = input.initialBalanceWon ?? 0;

    if (initialBalanceWon < 0) {
      throw new BadRequestException('기초금액은 0원 이상으로 입력해 주세요.');
    }

    const existing = await this.fundingAccountsRepository.findByIdInWorkspace(
      fundingAccountId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    if (existing.bootstrapStatus !== 'PENDING') {
      throw new ConflictException(
        '기초금액 입력은 기초 업로드 대기 상태의 자금수단에서만 진행할 수 있습니다.'
      );
    }

    if (existing.status !== 'ACTIVE') {
      throw new ConflictException(
        '기초금액 입력은 활성 상태의 자금수단에서만 진행할 수 있습니다.'
      );
    }

    if (existing.type !== 'BANK' && existing.type !== 'CARD') {
      throw new BadRequestException(
        '기초 업로드 대기 처리는 통장 또는 카드 자금수단만 대상입니다.'
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (initialBalanceWon > 0) {
        await this.assertNoFundingAccountAccountingHistory({
          tx,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          fundingAccountId: existing.id
        });

        await this.createOpeningBalanceJournalEntry({
          tx,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          membershipId: workspace.membershipId,
          fundingAccountId: existing.id,
          fundingAccountType: existing.type,
          initialBalanceWon
        });
      }

      const updatedCount = await tx.account.updateMany({
        where: {
          id: existing.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId,
          bootstrapStatus: 'PENDING'
        },
        data: {
          bootstrapStatus: 'COMPLETED',
          ...(initialBalanceWon > 0 ? { balanceWon: initialBalanceWon } : {})
        }
      });

      if (updatedCount.count !== 1) {
        throw new ConflictException(
          '자금수단 기초 업로드 상태가 변경되어 완료 처리하지 못했습니다. 다시 시도해 주세요.'
        );
      }

      return tx.account.findFirst({
        where: {
          id: existing.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      });
    });

    return updated ? mapFundingAccountRecordToItem(updated) : null;
  }

  /**
   * 자금수단에 대한 기초전표(OPENING_BALANCE)를 생성합니다.
   *
   * 회계 분개:
   * - BANK/CASH: 차변 현금및예금(1010) / 대변 순자산(3100)
   * - CARD: 차변 순자산(3100) / 대변 카드미지급금(2100)
   */
  private async createOpeningBalanceJournalEntry(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    ledgerId: string;
    membershipId: string;
    fundingAccountId: string;
    fundingAccountType: 'BANK' | 'CASH' | 'CARD';
    initialBalanceWon: number;
  }): Promise<void> {
    // 현재 최신 진행월이 OPEN 또는 IN_REVIEW인지 확인한다.
    const latestPeriod = await input.tx.accountingPeriod.findFirst({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.IN_REVIEW]
        }
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
    });

    if (!latestPeriod) {
      throw new BadRequestException(
        '기초금액을 등록하려면 운영월이 열려 있어야 합니다. 월 운영을 먼저 시작한 뒤 다시 등록해 주세요.'
      );
    }

    // 계정과목 조회
    const accountSubjects = await input.tx.accountSubject.findMany({
      where: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        code: {
          in: [ASSET_SUBJECT_CODE, LIABILITY_SUBJECT_CODE, EQUITY_SUBJECT_CODE]
        },
        isActive: true
      },
      select: {
        id: true,
        code: true
      }
    });

    const subjectIdByCode = new Map(
      accountSubjects.map((subject) => [subject.code, subject.id])
    );

    const assetSubjectId = subjectIdByCode.get(ASSET_SUBJECT_CODE);
    const liabilitySubjectId = subjectIdByCode.get(LIABILITY_SUBJECT_CODE);
    const equitySubjectId = subjectIdByCode.get(EQUITY_SUBJECT_CODE);

    if (!assetSubjectId || !liabilitySubjectId || !equitySubjectId) {
      throw new InternalServerErrorException(
        '기초전표 생성에 필요한 계정과목(현금및예금, 카드미지급금, 순자산)이 준비되어 있지 않습니다.'
      );
    }

    // 전표번호 할당
    const allocatedPeriod = await input.tx.accountingPeriod.updateMany({
      where: {
        id: latestPeriod.id,
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        status: {
          in: [AccountingPeriodStatus.OPEN, AccountingPeriodStatus.IN_REVIEW]
        }
      },
      data: {
        nextJournalEntrySequence: {
          increment: 1
        }
      }
    });

    if (allocatedPeriod.count !== 1) {
      throw new ConflictException(
        '운영 기간 상태가 변경되어 전표 번호를 할당하지 못했습니다. 다시 시도해 주세요.'
      );
    }

    const entryNumber = buildJournalEntryEntryNumber(
      latestPeriod.year,
      latestPeriod.month,
      latestPeriod.nextJournalEntrySequence
    );

    // 회계 분개 결정
    const journalLines = resolveOpeningBalanceJournalLines({
      fundingAccountType: input.fundingAccountType,
      fundingAccountId: input.fundingAccountId,
      amount: input.initialBalanceWon,
      assetSubjectId,
      liabilitySubjectId,
      equitySubjectId
    });

    await input.tx.journalEntry.create({
      data: {
        tenantId: input.tenantId,
        ledgerId: input.ledgerId,
        periodId: latestPeriod.id,
        entryNumber,
        entryDate: latestPeriod.startDate,
        sourceKind: JournalEntrySourceKind.OPENING_BALANCE,
        status: JournalEntryStatus.POSTED,
        memo: `기초금액 등록`,
        createdByActorType: AuditActorType.TENANT_MEMBERSHIP,
        createdByMembershipId: input.membershipId,
        lines: {
          createMany: {
            data: journalLines
          }
        }
      }
    });
  }

  async update(
    user: AuthenticatedUser,
    fundingAccountId: string,
    input: UpdateFundingAccountRequest
  ): Promise<FundingAccountItem | null> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.fundingAccountsRepository.findByIdInWorkspace(
      fundingAccountId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return null;
    }

    if (existing.status === 'CLOSED') {
      throw new ConflictException(
        '종료된 자금수단은 현재 범위에서 수정할 수 없습니다.'
      );
    }

    assertFundingAccountStatusTransition(existing.status, input.status);
    assertFundingAccountBootstrapTransition(
      existing.bootstrapStatus ?? 'NOT_REQUIRED',
      input.bootstrapStatus
    );

    const normalizedName = normalizeFundingAccountName(input.name);

    await this.assertNoDuplicateFundingAccount({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId,
      normalizedName,
      excludeFundingAccountId: existing.id
    });

    const updated = await this.fundingAccountsRepository.updateInWorkspace(
      fundingAccountId,
      {
        name: normalizedName,
        status: input.status,
        bootstrapStatus: input.bootstrapStatus
      }
    );

    return mapFundingAccountRecordToItem(updated);
  }

  async delete(
    user: AuthenticatedUser,
    fundingAccountId: string
  ): Promise<boolean> {
    const workspace = requireCurrentWorkspace(user);
    const existing = await this.fundingAccountsRepository.findByIdInWorkspace(
      fundingAccountId,
      workspace.tenantId,
      workspace.ledgerId
    );

    if (!existing) {
      return false;
    }

    return this.prisma.$transaction(async (tx) => {
      const [
        recurringRuleCount,
        insurancePolicyCount,
        planItemCount,
        importBatchCount,
        collectedTransactionCount,
        journalLineCount,
        balanceSnapshotLineCount,
        vehicleDefaultProfileCount
      ] = await Promise.all([
        tx.recurringRule.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            accountId: existing.id
          }
        }),
        tx.insurancePolicy.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            accountId: existing.id
          }
        }),
        tx.planItem.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            fundingAccountId: existing.id
          }
        }),
        tx.importBatch.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            fundingAccountId: existing.id
          }
        }),
        tx.collectedTransaction.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            fundingAccountId: existing.id
          }
        }),
        tx.journalLine.count({
          where: {
            fundingAccountId: existing.id,
            journalEntry: {
              tenantId: workspace.tenantId,
              ledgerId: workspace.ledgerId
            }
          }
        }),
        tx.balanceSnapshotLine.count({
          where: {
            fundingAccountId: existing.id,
            OR: [
              {
                openingSnapshot: {
                  is: {
                    tenantId: workspace.tenantId,
                    ledgerId: workspace.ledgerId
                  }
                }
              },
              {
                closingSnapshot: {
                  is: {
                    tenantId: workspace.tenantId,
                    ledgerId: workspace.ledgerId
                  }
                }
              }
            ]
          }
        }),
        tx.vehicle.count({
          where: {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId,
            defaultFundingAccountId: existing.id
          }
        })
      ]);

      const blockers = buildFundingAccountDeletionBlockers([
        ['반복 규칙', recurringRuleCount],
        ['보험 계약', insurancePolicyCount],
        ['계획 항목', planItemCount],
        ['업로드 배치', importBatchCount],
        ['수집 거래', collectedTransactionCount],
        ['전표 라인', journalLineCount],
        ['잔액 스냅샷', balanceSnapshotLineCount],
        ['차량 기본값', vehicleDefaultProfileCount]
      ]);

      if (blockers.length > 0) {
        throw new ConflictException(
          [
            '이 자금수단은 아직 삭제할 수 없습니다.',
            `연결된 항목: ${blockers.join(', ')}.`,
            '거래내역과 관련 설정을 먼저 삭제하거나 다른 자금수단으로 옮긴 뒤 다시 시도해 주세요.'
          ].join(' ')
        );
      }

      const deleted = await tx.account.deleteMany({
        where: {
          id: existing.id,
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        }
      });

      return deleted.count > 0;
    });
  }

  private async assertNoDuplicateFundingAccount(input: {
    tenantId: string;
    ledgerId: string;
    normalizedName: string;
    excludeFundingAccountId?: string;
  }) {
    const accounts = await this.fundingAccountsRepository.findAllInWorkspace(
      input.tenantId,
      input.ledgerId,
      {
        includeInactive: true
      }
    );
    const duplicate = accounts.find(
      (candidate) =>
        candidate.id !== input.excludeFundingAccountId &&
        normalizeCaseInsensitiveText(candidate.name) ===
          normalizeCaseInsensitiveText(input.normalizedName)
    );

    if (!duplicate) {
      return;
    }

    switch (duplicate.status) {
      case 'ACTIVE':
        throw new ConflictException('같은 이름의 자금수단이 이미 있습니다.');
      case 'INACTIVE':
        throw new ConflictException(
          '같은 이름의 비활성 자금수단이 있습니다. 기존 자금수단을 다시 활성화하거나 다른 이름을 사용해 주세요.'
        );
      case 'CLOSED':
        throw new ConflictException(
          '같은 이름의 종료 자금수단이 있습니다. 다른 이름을 사용해 주세요.'
        );
      default:
        throw new ConflictException('같은 이름의 자금수단이 이미 있습니다.');
    }
  }

  private async assertNoFundingAccountAccountingHistory(input: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    ledgerId: string;
    fundingAccountId: string;
  }) {
    const [
      importBatchCount,
      collectedTransactionCount,
      journalLineCount,
      balanceSnapshotLineCount
    ] = await Promise.all([
      input.tx.importBatch.count({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          fundingAccountId: input.fundingAccountId
        }
      }),
      input.tx.collectedTransaction.count({
        where: {
          tenantId: input.tenantId,
          ledgerId: input.ledgerId,
          fundingAccountId: input.fundingAccountId
        }
      }),
      input.tx.journalLine.count({
        where: {
          fundingAccountId: input.fundingAccountId,
          journalEntry: {
            tenantId: input.tenantId,
            ledgerId: input.ledgerId
          }
        }
      }),
      input.tx.balanceSnapshotLine.count({
        where: {
          fundingAccountId: input.fundingAccountId,
          OR: [
            {
              openingSnapshot: {
                is: {
                  tenantId: input.tenantId,
                  ledgerId: input.ledgerId
                }
              }
            },
            {
              closingSnapshot: {
                is: {
                  tenantId: input.tenantId,
                  ledgerId: input.ledgerId
                }
              }
            }
          ]
        }
      })
    ]);

    const blockers = buildFundingAccountDeletionBlockers([
      ['업로드 배치', importBatchCount],
      ['수집 거래', collectedTransactionCount],
      ['전표 라인', journalLineCount],
      ['잔액 스냅샷', balanceSnapshotLineCount]
    ]);

    if (blockers.length > 0) {
      throw new ConflictException(
        [
          '기초금액은 아직 거래·전표·스냅샷 이력이 없는 자금수단에만 등록할 수 있습니다.',
          `연결된 항목: ${blockers.join(', ')}.`
        ].join(' ')
      );
    }
  }
}

function buildFundingAccountDeletionBlockers(
  entries: Array<[label: string, count: number]>
) {
  return entries
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}건`);
}

function normalizeFundingAccountName(name: string) {
  const normalized = name.trim();

  if (normalized.length === 0) {
    throw new BadRequestException('자금수단 이름을 입력해 주세요.');
  }

  return normalized;
}

async function readNextFundingAccountSortOrder(
  client: Prisma.TransactionClient,
  tenantId: string,
  ledgerId: string
) {
  const lastAccount = await client.account.findFirst({
    where: {
      tenantId,
      ledgerId
    },
    orderBy: {
      sortOrder: 'desc'
    },
    select: {
      sortOrder: true
    }
  });

  return (lastAccount?.sortOrder ?? -1) + 1;
}

function resolveBootstrapStatusAfterOpeningBalance(
  type: CreateFundingAccountRequest['type']
) {
  return type === 'BANK' || type === 'CARD' ? 'COMPLETED' : 'NOT_REQUIRED';
}

function assertFundingAccountStatusTransition(
  currentStatus: FundingAccountItem['status'],
  nextStatus?: UpdateFundingAccountRequest['status']
) {
  if (!nextStatus || nextStatus === currentStatus) {
    return;
  }

  if (nextStatus === 'CLOSED' && currentStatus !== 'INACTIVE') {
    throw new ConflictException(
      '자금수단을 종료하려면 먼저 비활성 상태로 전환해 주세요.'
    );
  }
}

function assertFundingAccountBootstrapTransition(
  currentStatus: FundingAccountItem['bootstrapStatus'],
  nextStatus?: UpdateFundingAccountRequest['bootstrapStatus']
) {
  if (!nextStatus || nextStatus === currentStatus) {
    return;
  }

  if (currentStatus === 'PENDING' && nextStatus === 'COMPLETED') {
    return;
  }

  throw new BadRequestException(
    '기초 업로드 상태는 대기 상태에서 완료 상태로만 직접 전환할 수 있습니다.'
  );
}

/**
 * 기초전표의 회계 분개를 결정합니다.
 *
 * 계좌 유형 `BANK`/`CASH`: 차변 현금및예금(1010) / 대변 순자산(3100)
 * 계좌 유형 `CARD`: 차변 순자산(3100) / 대변 카드미지급금(2100)
 */
function resolveOpeningBalanceJournalLines(input: {
  fundingAccountType: 'BANK' | 'CASH' | 'CARD';
  fundingAccountId: string;
  amount: number;
  assetSubjectId: string;
  liabilitySubjectId: string;
  equitySubjectId: string;
}) {
  if (input.fundingAccountType === 'CARD') {
    return [
      {
        lineNumber: 1,
        accountSubjectId: input.equitySubjectId,
        debitAmount: input.amount,
        creditAmount: 0,
        description: '기초금액 등록'
      },
      {
        lineNumber: 2,
        accountSubjectId: input.liabilitySubjectId,
        fundingAccountId: input.fundingAccountId,
        debitAmount: 0,
        creditAmount: input.amount,
        description: '기초금액 등록'
      }
    ];
  }

  return [
    {
      lineNumber: 1,
      accountSubjectId: input.assetSubjectId,
      fundingAccountId: input.fundingAccountId,
      debitAmount: input.amount,
      creditAmount: 0,
      description: '기초금액 등록'
    },
    {
      lineNumber: 2,
      accountSubjectId: input.equitySubjectId,
      debitAmount: 0,
      creditAmount: input.amount,
      description: '기초금액 등록'
    }
  ];
}
