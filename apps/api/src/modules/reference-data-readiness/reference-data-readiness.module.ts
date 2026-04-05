import { Module } from '@nestjs/common';
import { ReferenceDataReadinessController } from './reference-data-readiness.controller';
import { ReferenceDataReadinessService } from './reference-data-readiness.service';

@Module({
  controllers: [ReferenceDataReadinessController],
  providers: [ReferenceDataReadinessService]
})
export class ReferenceDataReadinessModule {}
