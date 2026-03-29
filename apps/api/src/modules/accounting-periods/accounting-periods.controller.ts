import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  AccountingPeriodItem,
  AuthenticatedUser,
  CloseAccountingPeriodResponse
} from '@personal-erp/contracts';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CloseAccountingPeriodRequestDto } from './dto/close-accounting-period.dto';
import { OpenAccountingPeriodRequestDto } from './dto/open-accounting-period.dto';
import { AccountingPeriodsService } from './accounting-periods.service';

@ApiTags('accounting-periods')
@ApiBearerAuth()
@Controller('accounting-periods')
export class AccountingPeriodsController {
  constructor(
    private readonly accountingPeriodsService: AccountingPeriodsService
  ) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountingPeriodItem[]> {
    return this.accountingPeriodsService.findAll(user);
  }

  @Get('current')
  findCurrent(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AccountingPeriodItem | null> {
    return this.accountingPeriodsService.findCurrent(user);
  }

  @Post()
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OpenAccountingPeriodRequestDto
  ): Promise<AccountingPeriodItem> {
    return this.accountingPeriodsService.open(user, dto);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') periodId: string,
    @Body() dto: CloseAccountingPeriodRequestDto
  ): Promise<CloseAccountingPeriodResponse> {
    return this.accountingPeriodsService.close(user, periodId, dto);
  }
}
