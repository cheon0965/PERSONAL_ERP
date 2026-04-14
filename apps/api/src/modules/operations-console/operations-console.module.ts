import { Module } from '@nestjs/common';
import { OperationsConsoleController } from './operations-console.controller';
import { OperationsConsoleService } from './operations-console.service';

@Module({
  controllers: [OperationsConsoleController],
  providers: [OperationsConsoleService]
})
export class OperationsConsoleModule {}
