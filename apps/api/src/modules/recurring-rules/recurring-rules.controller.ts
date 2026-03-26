import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { CreateRecurringRuleDto } from './dto/create-recurring-rule.dto';
import { RecurringRulesService } from './recurring-rules.service';

@ApiTags('recurring-rules')
@ApiBearerAuth()
@Controller('recurring-rules')
export class RecurringRulesController {
  constructor(private readonly recurringRulesService: RecurringRulesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.recurringRulesService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateRecurringRuleDto) {
    return this.recurringRulesService.create(user.id, dto);
  }
}
