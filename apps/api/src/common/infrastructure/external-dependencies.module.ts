import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ClockPort } from '../application/ports/clock.port';
import { EmailSenderPort } from '../application/ports/email-sender.port';
import { PrismaModule } from '../prisma/prisma.module';
import { getApiEnv } from '../../config/api-env';
import { ConsoleEmailSenderAdapter } from './email/console-email-sender.adapter';
import { GmailApiEmailSenderAdapter } from './email/gmail-api-email-sender.adapter';
import { RequestContextInterceptor } from './operational/request-context.interceptor';
import { SecurityEventLogger } from './operational/security-event.logger';
import { WorkspaceAuditEventsService } from './operational/workspace-audit-events.service';
import { SystemClockAdapter } from './time/system-clock.adapter';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    RequestContextInterceptor,
    SecurityEventLogger,
    WorkspaceAuditEventsService,
    SystemClockAdapter,
    {
      provide: ClockPort,
      useExisting: SystemClockAdapter
    },
    {
      provide: EmailSenderPort,
      useFactory: (securityEvents: SecurityEventLogger) => {
        const env = getApiEnv();
        return env.MAIL_PROVIDER === 'gmail-api'
          ? new GmailApiEmailSenderAdapter(env, securityEvents)
          : new ConsoleEmailSenderAdapter(env, securityEvents);
      },
      inject: [SecurityEventLogger]
    },
    {
      provide: APP_INTERCEPTOR,
      useExisting: RequestContextInterceptor
    }
  ],
  exports: [
    PrismaModule,
    ClockPort,
    EmailSenderPort,
    SecurityEventLogger,
    WorkspaceAuditEventsService
  ]
})
export class ExternalDependenciesModule {}
