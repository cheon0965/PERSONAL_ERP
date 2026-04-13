import type { ApiEnv } from '../../../config/api-env';
import type { EmailMessage } from '../../application/ports/email-sender.port';
import { EmailSenderPort } from '../../application/ports/email-sender.port';
import { SecurityEventLogger } from '../operational/security-event.logger';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

type GmailAccessTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

export class GmailApiEmailSenderAdapter extends EmailSenderPort {
  constructor(
    private readonly env: ApiEnv,
    private readonly securityEvents: SecurityEventLogger
  ) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    const accessToken = await this.fetchAccessToken();
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(
        this.requireGmailSenderEmail()
      )}/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodeBase64Url(buildMimeMessage(message, this.env))
        })
      }
    );

    if (!response.ok) {
      this.securityEvents.error('email.gmail_send_failed', {
        provider: this.env.MAIL_PROVIDER,
        status: response.status
      });
      throw new Error(`Gmail API send failed with status ${response.status}.`);
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.requireGmailClientId(),
        client_secret: this.requireGmailClientSecret(),
        refresh_token: this.requireGmailRefreshToken(),
        grant_type: 'refresh_token',
        scope: GMAIL_SEND_SCOPE
      })
    });

    if (!response.ok) {
      this.securityEvents.error('email.gmail_access_token_failed', {
        provider: this.env.MAIL_PROVIDER,
        status: response.status
      });
      throw new Error(
        `Gmail API access token request failed with status ${response.status}.`
      );
    }

    const payload = (await response.json()) as GmailAccessTokenResponse;
    if (!payload.access_token) {
      this.securityEvents.error('email.gmail_access_token_missing', {
        provider: this.env.MAIL_PROVIDER
      });
      throw new Error(
        'Gmail API access token response did not include a token.'
      );
    }

    return payload.access_token;
  }

  private requireGmailClientId(): string {
    return requireConfiguredValue(this.env.GMAIL_CLIENT_ID, 'GMAIL_CLIENT_ID');
  }

  private requireGmailClientSecret(): string {
    return requireConfiguredValue(
      this.env.GMAIL_CLIENT_SECRET,
      'GMAIL_CLIENT_SECRET'
    );
  }

  private requireGmailRefreshToken(): string {
    return requireConfiguredValue(
      this.env.GMAIL_REFRESH_TOKEN,
      'GMAIL_REFRESH_TOKEN'
    );
  }

  private requireGmailSenderEmail(): string {
    return requireConfiguredValue(
      this.env.GMAIL_SENDER_EMAIL,
      'GMAIL_SENDER_EMAIL'
    );
  }
}

function buildMimeMessage(message: EmailMessage, env: ApiEnv): string {
  const from = formatAddressHeader(env.MAIL_FROM_EMAIL, env.MAIL_FROM_NAME);
  const to = sanitizeHeaderValue(message.to);
  const subject = encodeMimeHeader(message.subject);

  if (message.html) {
    const boundary = `personal-erp-${Date.now().toString(36)}`;
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.html,
      `--${boundary}--`
    ].join('\r\n');
  }

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text
  ].join('\r\n');
}

function formatAddressHeader(email: string, name: string): string {
  const sanitizedEmail = sanitizeHeaderValue(email);
  const sanitizedName = sanitizeHeaderValue(name);
  return sanitizedName
    ? `${encodeMimeHeader(sanitizedName)} <${sanitizedEmail}>`
    : sanitizedEmail;
}

function encodeMimeHeader(value: string): string {
  return `=?UTF-8?B?${Buffer.from(sanitizeHeaderValue(value), 'utf8').toString(
    'base64'
  )}?=`;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

function requireConfiguredValue(value: string | null, key: string): string {
  if (!value) {
    throw new Error(`${key} is required for Gmail API email delivery.`);
  }

  return value;
}
