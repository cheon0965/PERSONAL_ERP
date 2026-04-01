'use client';

import * as React from 'react';
import type { AuthenticatedUser, LoginRequest } from '@personal-erp/contracts';
import {
  loginWithPassword,
  logoutSession,
  refreshSession
} from '@/features/auth/auth.api';
import {
  clearStoredAccessToken,
  setRefreshSessionHandler,
  setStoredAccessToken,
  setUnauthorizedSessionHandler,
  type UnauthorizedSessionReason
} from './auth-session-store';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthSessionContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (input: LoginRequest) => Promise<AuthenticatedUser>;
  logout: () => Promise<void>;
};

const AuthSessionContext = React.createContext<AuthSessionContextValue | null>(
  null
);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const didBootstrapRef = React.useRef(false);

  const applyUnauthenticatedState = React.useCallback(() => {
    clearStoredAccessToken();
    React.startTransition(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  React.useEffect(() => {
    setUnauthorizedSessionHandler((_reason: UnauthorizedSessionReason) => {
      applyUnauthenticatedState();
    });

    return () => {
      setUnauthorizedSessionHandler(null);
    };
  }, [applyUnauthenticatedState]);

  const restoreSession = React.useCallback(async () => {
    try {
      const result = await refreshSession();
      setStoredAccessToken(result.accessToken);
      React.startTransition(() => {
        setUser(result.user);
        setStatus('authenticated');
      });
      return result.accessToken;
    } catch {
      applyUnauthenticatedState();
      return null;
    }
  }, [applyUnauthenticatedState]);

  React.useEffect(() => {
    setRefreshSessionHandler(() => restoreSession());

    return () => {
      setRefreshSessionHandler(null);
    };
  }, [restoreSession]);

  React.useEffect(() => {
    if (didBootstrapRef.current) {
      return;
    }

    didBootstrapRef.current = true;

    let isCancelled = false;
    React.startTransition(() => {
      setStatus('loading');
    });

    void restoreSession().then((nextToken) => {
      if (isCancelled || nextToken) {
        return;
      }

      applyUnauthenticatedState();
    });

    return () => {
      isCancelled = true;
    };
  }, [applyUnauthenticatedState, restoreSession]);

  const login = React.useCallback(
    async (input: LoginRequest) => {
      React.startTransition(() => {
        setStatus('loading');
      });

      try {
        const result = await loginWithPassword(input);
        setStoredAccessToken(result.accessToken);

        React.startTransition(() => {
          setUser(result.user);
          setStatus('authenticated');
        });

        return result.user;
      } catch (error) {
        applyUnauthenticatedState();
        throw error;
      }
    },
    [applyUnauthenticatedState]
  );

  const logout = React.useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      applyUnauthenticatedState();
    }
  }, [applyUnauthenticatedState]);

  const value = React.useMemo<AuthSessionContextValue>(
    () => ({
      status,
      user,
      login,
      logout
    }),
    [login, logout, status, user]
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionContextValue {
  const context = React.useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within an AuthProvider.');
  }

  return context;
}
