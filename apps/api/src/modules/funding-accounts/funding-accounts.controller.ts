import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { FundingAccountsService } from './funding-accounts.service';

@ApiTags('funding-accounts')
@ApiBearerAuth()
@Controller('funding-accounts')
export class FundingAccountsController {
  constructor(
    private readonly fundingAccountsService: FundingAccountsService
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.fundingAccountsService.findAll(user.id);
  }
}
