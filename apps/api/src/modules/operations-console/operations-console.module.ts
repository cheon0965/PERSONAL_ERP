import { Module } from '@nestjs/common';
import { OperationsConsoleCommandService } from './operations-console-command.service';
import { OperationsConsoleController } from './operations-console.controller';
import { OperationsConsoleReadRepository } from './operations-console-read.repository';
import { OperationsConsoleService } from './operations-console.service';

@Module({
  controllers: [OperationsConsoleController],
  providers: [
    OperationsConsoleReadRepository,
    OperationsConsoleService,
    OperationsConsoleCommandService
  ]
})
export class OperationsConsoleModule {}
