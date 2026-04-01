import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AccountSubjectItem,
  AuthenticatedUser
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AccountSubjectsService } from './account-subjects.service';

@ApiTags('account-subjects')
@ApiBearerAuth()
@Controller('account-subjects')
export class AccountSubjectsController {
  constructor(
    private readonly accountSubjectsService: AccountSubjectsService
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountSubjectItem[]> {
    return this.accountSubjectsService.findAll(user);
  }
}
