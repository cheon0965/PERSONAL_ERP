import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
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
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';
import { CreateCollectedTransactionRequestDto } from './dto/create-collected-transaction.dto';
import { MissingOwnedCollectedTransactionReferenceError } from './domain/collected-transaction-policy';

@ApiTags('collected-transactions')
@ApiBearerAuth()
@Controller('collected-transactions')
export class CollectedTransactionsController {
  constructor(
    private readonly listCollectedTransactionsUseCase: ListCollectedTransactionsUseCase,
    private readonly createCollectedTransactionUseCase: CreateCollectedTransactionUseCase,
    private readonly confirmCollectedTransactionUseCase: ConfirmCollectedTransactionUseCase,
    private readonly accountingPeriodsService: AccountingPeriodsService,
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
        await this.accountingPeriodsService.assertCollectingDateAllowed(
          user,
          dto.businessDate
        );

      const created = await this.createCollectedTransactionUseCase.execute({
        userId: workspace.userId,
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        periodId: currentPeriod.id,
        title: dto.title,
        type: dto.type,
        amountWon: dto.amountWon,
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
