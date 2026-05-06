import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminInvitationUrl } from '../src/modules/admin/admin-member-command.support';
import { buildPasswordResetUrl } from '../src/modules/auth/application/use-cases/forgot-password.use-case';
import { buildVerificationUrl } from '../src/modules/auth/application/use-cases/register.use-case';

const injectedAppOrigin = 'https://personalerp.theworkpc.com';

test('mail verification link uses the injected app origin', () => {
  assert.equal(
    buildVerificationUrl({
      appOrigin: injectedAppOrigin,
      token: 'verify-token'
    }),
    'https://personalerp.theworkpc.com/verify-email?token=verify-token'
  );
});

test('password reset link uses the injected app origin', () => {
  assert.equal(
    buildPasswordResetUrl({
      appOrigin: injectedAppOrigin,
      token: 'reset-token'
    }),
    'https://personalerp.theworkpc.com/reset-password?token=reset-token'
  );
});

test('admin invitation link uses the injected app origin', () => {
  assert.equal(
    buildAdminInvitationUrl({
      appOrigin: injectedAppOrigin,
      token: 'invite-token'
    }),
    'https://personalerp.theworkpc.com/accept-invitation?token=invite-token'
  );
});
