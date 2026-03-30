import {
  Body,
  Controller,
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
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { AccountingPeriodsService } from '../accounting-periods/accounting-periods.service';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { ConfirmCollectedTransactionUseCase } from './confirm-collected-transaction.use-case';
import { requireCurrentWorkspace } from '../../common/auth/required-workspace.util';
import { MissingOwnedCollectedTransactionReferenceError } from './domain/collected-transaction-policy';
import { CreateCollectedTransactionRequestDto } from './dto/create-collected-transaction.dto';

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
    try {
      const workspace = requireCurrentWorkspace(user);
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

      return created;
    } catch (error) {
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
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') collectedTransactionId: string
  ): Promise<JournalEntryItem> {
    return this.confirmCollectedTransactionUseCase.execute(
      user,
      collectedTransactionId
    );
  }
}
