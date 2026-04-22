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
