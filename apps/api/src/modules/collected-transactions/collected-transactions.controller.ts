import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  CollectedTransactionDetailItem,
  CollectedTransactionItem,
  JournalEntryItem
} from '@personal-erp/contracts';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import {
  assertWorkspaceActionAllowed,
  readAllowedWorkspaceRoles
} from '../../common/auth/workspace-action.policy';
import { requirePositiveMoneyWon } from '../../common/money/money-won';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import {
  logWorkspaceActionDenied,
  logWorkspaceActionSucceeded
} from '../../common/infrastructure/operational/workspace-action.audit';
import { AccountingPeriodWriteGuardPort } from '../accounting-periods/public';
import { DeleteCollectedTransactionUseCase } from './application/use-cases/delete-collected-transaction.use-case';
import { GetCollectedTransactionDetailUseCase } from './application/use-cases/get-collected-transaction-detail.use-case';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { UpdateCollectedTransactionUseCase } from './application/use-cases/update-collected-transaction.use-case';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';
import { CreateCollectedTransactionRequestDto } from './dto/create-collected-transaction.dto';
import { UpdateCollectedTransactionRequestDto } from './dto/update-collected-transaction.dto';
import { MissingOwnedCollectedTransactionReferenceError } from './domain/collected-transaction-policy';

@ApiTags('collected-transactions')
@ApiBearerAuth()
@Controller('collected-transactions')
export class CollectedTransactionsController {
  constructor(
    private readonly listCollectedTransactionsUseCase: ListCollectedTransactionsUseCase,
    private readonly getCollectedTransactionDetailUseCase: GetCollectedTransactionDetailUseCase,
    private readonly createCollectedTransactionUseCase: CreateCollectedTransactionUseCase,
    private readonly updateCollectedTransactionUseCase: UpdateCollectedTransactionUseCase,
    private readonly deleteCollectedTransactionUseCase: DeleteCollectedTransactionUseCase,
    private readonly confirmCollectedTransactionUseCase: ConfirmCollectedTransactionUseCase,
    private readonly accountingPeriodWriteGuard: AccountingPeriodWriteGuardPort,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<CollectedTransactionItem[]> {
    const workspace = requireCurrentWorkspace(user);

    return this.listCollectedTransactionsUseCase.execute({
      tenantId: workspace.tenantId,
      ledgerId: workspace.ledgerId
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') collectedTransactionId: string
  ): Promise<CollectedTransactionDetailItem> {
    const workspace = requireCurrentWorkspace(user);
    const transaction = await this.getCollectedTransactionDetailUseCase.execute(
      {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId
      },
      collectedTransactionId
    );

    if (!transaction) {
      throw new NotFoundException('Collected transaction not found');
    }

    return transaction;
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectedTransactionRequestDto
  ) {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'collected_transaction.create'
      );

      const currentPeriod =
        await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          dto.businessDate
        );

      const created = await this.createCollectedTransactionUseCase.execute({
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: currentPeriod.id,
        title: dto.title,
        type: dto.type,
        amountWon: requirePositiveMoneyWon(
          dto.amountWon,
          '거래 금액은 0보다 큰 안전한 정수여야 합니다.'
        ),
        businessDate: dto.businessDate,
        fundingAccountId: dto.fundingAccountId,
        categoryId: dto.categoryId,
        memo: dto.memo
      });

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.create',
        request,
        workspace,
        details: {
          collectedTransactionId: created.id,
          periodId: currentPeriod.id
        }
      });

      return created;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.create',
          request,
          workspace,
          details: {
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.create'
            ).join(',')
          }
        });
      }

      if (error instanceof MissingOwnedCollectedTransactionReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `collected_transaction_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Patch(':id')
  async update(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') collectedTransactionId: string,
    @Body() dto: UpdateCollectedTransactionRequestDto
  ): Promise<CollectedTransactionItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'collected_transaction.update'
      );

      const currentPeriod =
        await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          dto.businessDate
        );

      const updated = await this.updateCollectedTransactionUseCase.execute({
        collectedTransactionId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: currentPeriod.id,
        title: dto.title,
        type: dto.type,
        amountWon: requirePositiveMoneyWon(
          dto.amountWon,
          '거래 금액은 0보다 큰 안전한 정수여야 합니다.'
        ),
        businessDate: dto.businessDate,
        fundingAccountId: dto.fundingAccountId,
        categoryId: dto.categoryId,
        memo: dto.memo
      });

      if (!updated) {
        throw new NotFoundException('Collected transaction not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.update',
        request,
        workspace,
        details: {
          collectedTransactionId: updated.id,
          periodId: currentPeriod.id
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.update',
          request,
          workspace,
          details: {
            collectedTransactionId,
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.update'
            ).join(',')
          }
        });
      }

      if (error instanceof MissingOwnedCollectedTransactionReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `collected_transaction_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') collectedTransactionId: string
  ): Promise<void> {
    const workspace = requireCurrentWorkspace(user);

    try {
      assertWorkspaceActionAllowed(
        workspace.membershipRole,
        'collected_transaction.delete'
      );

      const existing = await this.getCollectedTransactionDetailUseCase.execute(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        collectedTransactionId
      );

      if (!existing) {
        throw new NotFoundException('Collected transaction not found');
      }

      const currentPeriod =
        await this.accountingPeriodWriteGuard.assertCollectingDateAllowed(
          {
            tenantId: workspace.tenantId,
            ledgerId: workspace.ledgerId
          },
          existing.businessDate
        );

      const deleted = await this.deleteCollectedTransactionUseCase.execute(
        {
          tenantId: workspace.tenantId,
          ledgerId: workspace.ledgerId
        },
        collectedTransactionId
      );

      if (!deleted) {
        throw new NotFoundException('Collected transaction not found');
      }

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.delete',
        request,
        workspace,
        details: {
          collectedTransactionId,
          periodId: currentPeriod.id
        }
      });
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.delete',
          request,
          workspace,
          details: {
            collectedTransactionId,
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.delete'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }

  @Post(':id/confirm')
  async confirm(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') collectedTransactionId: string
  ): Promise<JournalEntryItem> {
    const workspace = requireCurrentWorkspace(user);

    try {
      const journalEntry =
        await this.confirmCollectedTransactionUseCase.execute(
          user,
          collectedTransactionId
        );

      logWorkspaceActionSucceeded(this.securityEvents, {
        action: 'collected_transaction.confirm',
        request,
        workspace,
        details: {
          collectedTransactionId,
          journalEntryId: journalEntry.id
        }
      });

      return journalEntry;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        logWorkspaceActionDenied(this.securityEvents, {
          action: 'collected_transaction.confirm',
          request,
          workspace,
          details: {
            collectedTransactionId,
            requiredRoles: readAllowedWorkspaceRoles(
              'collected_transaction.confirm'
            ).join(',')
          }
        });
      }

      throw error;
    }
  }
}
