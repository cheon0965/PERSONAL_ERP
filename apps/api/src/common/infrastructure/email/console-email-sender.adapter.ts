import type { ApiEnv } from '../../../config/api-env';
import type { EmailMessage } from '../../application/ports/email-sender.port';
import { EmailSenderPort } from '../../application/ports/email-sender.port';
import { SecurityEventLogger } from '../operational/security-event.logger';

export class ConsoleEmailSenderAdapter extends EmailSenderPort {
  constructor(
    private readonly env: ApiEnv,
    private readonly securityEvents: SecurityEventLogger
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    this.securityEvents.log('email.console_send', {
      provider: this.env.MAIL_PROVIDER,
      subject: normalizeLogValue(message.subject)
    });
  }
}

function normalizeLogValue(value: string): string {
  return value.trim().replace(/\s+/g, '_').slice(0, 80);
}
