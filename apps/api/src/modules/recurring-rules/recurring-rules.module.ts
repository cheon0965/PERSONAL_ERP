import { Module } from '@nestjs/common';
import { RecurringRulesController } from './recurring-rules.controller';
import { RecurringRulesRepository } from './recurring-rules.repository';
import { RecurringRulesService } from './recurring-rules.service';

@Module({
  controllers: [RecurringRulesController],
  providers: [RecurringRulesService, RecurringRulesRepository]
})
export class RecurringRulesModule {}
