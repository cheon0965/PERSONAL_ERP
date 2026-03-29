import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  LedgerTransactionTypeItem
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { LedgerTransactionTypesService } from './ledger-transaction-types.service';

@ApiTags('ledger-transaction-types')
@ApiBearerAuth()
@Controller('ledger-transaction-types')
export class LedgerTransactionTypesController {
  constructor(
    private readonly ledgerTransactionTypesService: LedgerTransactionTypesService
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<LedgerTransactionTypeItem[]> {
    return this.ledgerTransactionTypesService.findAll(user);
  }
}
