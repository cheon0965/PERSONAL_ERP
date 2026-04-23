import {
  BadRequestException,
  ConflictException,
  Injectable
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CreateFundingAccountRequest,
  FundingAccountItem,
  UpdateFundingAccountRequest
} from '@personal-erp/contracts';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import { mapFundingAccountRecordToItem } from './funding-account.mapper';
import { readWorkspaceFundingAccountLiveBalances } from './funding-account-live-balance.reader';
import { FundingAccountsRepository } from './funding-accounts.repository';

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
