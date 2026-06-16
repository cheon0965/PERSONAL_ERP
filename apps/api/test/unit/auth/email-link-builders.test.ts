import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAdminInvitationUrl } from '../../../src/modules/admin/public';
import { buildPasswordResetUrl } from '../../../src/modules/auth/public';
import { buildVerificationUrl } from '../../../src/modules/auth/public';

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
