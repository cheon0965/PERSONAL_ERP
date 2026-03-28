import { Body, Controller, Get, NotFoundException, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CollectedTransactionItem } from '@personal-erp/contracts';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { CreateCollectedTransactionUseCase } from './application/use-cases/create-collected-transaction.use-case';
import { ListCollectedTransactionsUseCase } from './application/use-cases/list-collected-transactions.use-case';
import { MissingOwnedCollectedTransactionReferenceError } from './domain/collected-transaction-policy';
import { CreateCollectedTransactionRequestDto } from './dto/create-collected-transaction.dto';

@ApiTags('collected-transactions')
@ApiBearerAuth()
@Controller('collected-transactions')
export class CollectedTransactionsController {
  constructor(
    private readonly listCollectedTransactionsUseCase: ListCollectedTransactionsUseCase,
    private readonly createCollectedTransactionUseCase: CreateCollectedTransactionUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<CollectedTransactionItem[]> {
    return this.listCollectedTransactionsUseCase.execute(user.id);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectedTransactionRequestDto
  ) {
    try {
      const created = await this.createCollectedTransactionUseCase.execute({
        userId: user.id,
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
}
