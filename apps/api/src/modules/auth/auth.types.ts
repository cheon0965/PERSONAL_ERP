import type { LoginResponse } from '@personal-erp/contracts';

export type AuthenticatedIdentity = {
  id: string;
  email: string;
  name: string;
};

export type AuthSessionResult = LoginResponse & {
  sessionId: string;
  refreshToken: string;
};

export type AuthRequestContext = {
  clientIp: string;
  requestId?: string;
};
