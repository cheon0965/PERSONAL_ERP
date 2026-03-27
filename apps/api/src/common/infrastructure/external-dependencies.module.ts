import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClockPort } from '../application/ports/clock.port';
import { PrismaModule } from '../prisma/prisma.module';
import { RequestContextInterceptor } from './operational/request-context.interceptor';
import { SecurityEventLogger } from './operational/security-event.logger';
import { SystemClockAdapter } from './time/system-clock.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    RequestContextInterceptor,
    SecurityEventLogger,
    SystemClockAdapter,
    {
      provide: ClockPort,
      useExisting: SystemClockAdapter
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestContextInterceptor
    }
  ],
  exports: [PrismaModule, ClockPort, SecurityEventLogger]
})
export class ExternalDependenciesModule {}
