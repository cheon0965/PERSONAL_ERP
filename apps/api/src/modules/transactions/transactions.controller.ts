import { Body, Controller, Get, NotFoundException, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import {
  readRequestId,
  readRequestPath,
  RequestWithContext
} from '../../common/infrastructure/operational/request-context';
import { SecurityEventLogger } from '../../common/infrastructure/operational/security-event.logger';
import { CreateTransactionUseCase } from './application/use-cases/create-transaction.use-case';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case';
import { MissingOwnedTransactionReferenceError } from './domain/transaction-policy';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly listTransactionsUseCase: ListTransactionsUseCase,
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly securityEvents: SecurityEventLogger
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.listTransactionsUseCase.execute(user.id);
  }

  @Post()
  async create(
    @Req() request: RequestWithContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto
  ) {
    try {
      return await this.createTransactionUseCase.execute({
        userId: user.id,
        ...dto
      });
    } catch (error) {
      if (error instanceof MissingOwnedTransactionReferenceError) {
        this.securityEvents.warn('authorization.scope_denied', {
          requestId: readRequestId(request),
          path: readRequestPath(request),
          userId: user.id,
          resource: `transaction_${error.reference}`
        });
        throw new NotFoundException(error.message);
      }

      throw error;
    }
  }
}
