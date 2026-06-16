import { Module } from '@nestjs/common';
import { OperationsConsoleController } from './operations-console.controller';
import { OperationsConsoleReadRepository } from './repositories/operations-console-read.repository';
import { OperationsConsoleCommandService } from './services/operations-console-command.service';
import { OperationsConsoleService } from './services/operations-console.service';

@Module({
  controllers: [OperationsConsoleController],
  providers: [
    OperationsConsoleReadRepository,
    OperationsConsoleService,
    OperationsConsoleCommandService
  ]
})
export class OperationsConsoleModule {}
