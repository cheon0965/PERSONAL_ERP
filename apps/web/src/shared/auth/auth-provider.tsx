'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AuthenticatedUser,
  CreateWorkspaceRequest,
  LoginRequest
} from '@personal-erp/contracts';
import {
  deleteWorkspace as deleteWorkspaceRequest,
  createWorkspace as createWorkspaceRequest,
  getCurrentUser,
  loginWithPassword,
  logoutSession,
  refreshSession,
  switchCurrentWorkspace
} from '@/features/auth/auth.api';
import {
  getStoredAccessToken,
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
  refreshUser: () => Promise<AuthenticatedUser | null>;
  createWorkspace: (
    input: CreateWorkspaceRequest
  ) => Promise<AuthenticatedUser>;
  deleteWorkspace: (tenantId: string) => Promise<AuthenticatedUser>;
  switchWorkspace: (
    tenantId: string,
    ledgerId?: string
  ) => Promise<AuthenticatedUser>;
};

const AuthSessionContext = React.createContext<AuthSessionContextValue | null>(
  null
);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<AuthStatus>('loading');
  const [user, setUser] = React.useState<AuthenticatedUser | null>(null);
  const didBootstrapRef = React.useRef(false);
  const sessionCacheScopeRef = React.useRef<string | null>(null);

  const applyUnauthenticatedState = React.useCallback(() => {
    clearStoredAccessToken();
    queryClient.clear();
    sessionCacheScopeRef.current = null;
    React.startTransition(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, [queryClient]);

  const applyAuthenticatedState = React.useCallback(
    (nextUser: AuthenticatedUser) => {
      const nextSessionCacheScope = readSessionCacheScope(nextUser);
      if (sessionCacheScopeRef.current !== nextSessionCacheScope) {
        queryClient.clear();
        sessionCacheScopeRef.current = nextSessionCacheScope;
      }

      React.startTransition(() => {
        setUser(nextUser);
        setStatus('authenticated');
      });
    },
    [queryClient]
  );

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
      applyAuthenticatedState(result.user);
      return result.accessToken;
    } catch {
      applyUnauthenticatedState();
      return null;
    }
  }, [applyAuthenticatedState, applyUnauthenticatedState]);

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
        applyAuthenticatedState(result.user);

        return result.user;
      } catch (error) {
        applyUnauthenticatedState();
        throw error;
      }
    },
    [applyAuthenticatedState, applyUnauthenticatedState]
  );

  const logout = React.useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      applyUnauthenticatedState();
    }
  }, [applyUnauthenticatedState]);

  const refreshUser = React.useCallback(async () => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      applyUnauthenticatedState();
      return null;
    }

    try {
      const nextUser = await getCurrentUser(accessToken);
      applyAuthenticatedState(nextUser);
      return nextUser;
    } catch {
      applyUnauthenticatedState();
      return null;
    }
  }, [applyAuthenticatedState, applyUnauthenticatedState]);

  const switchWorkspace = React.useCallback(
    async (tenantId: string, ledgerId?: string) => {
      const result = await switchCurrentWorkspace({
        tenantId,
        ...(ledgerId ? { ledgerId } : {})
      });

      applyAuthenticatedState(result.user);

      return result.user;
    },
    [applyAuthenticatedState]
  );

  const createWorkspace = React.useCallback(
    async (input: CreateWorkspaceRequest) => {
      const result = await createWorkspaceRequest(input);

      applyAuthenticatedState(result.user);

      return result.user;
    },
    [applyAuthenticatedState]
  );

  const deleteWorkspace = React.useCallback(
    async (tenantId: string) => {
      const result = await deleteWorkspaceRequest(tenantId);

      applyAuthenticatedState(result.user);

      return result.user;
    },
    [applyAuthenticatedState]
  );

  const value = React.useMemo<AuthSessionContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      refreshUser,
      createWorkspace,
      deleteWorkspace,
      switchWorkspace
    }),
    [
      createWorkspace,
      deleteWorkspace,
      login,
      logout,
      refreshUser,
      status,
      switchWorkspace,
      user
    ]
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

function readSessionCacheScope(user: AuthenticatedUser): string {
  const currentWorkspace = user.currentWorkspace;

  return [
    user.id,
    currentWorkspace?.tenant.id ?? 'no-tenant',
    currentWorkspace?.ledger?.id ?? 'no-ledger',
    currentWorkspace?.supportContext?.enabled === true ? 'support' : 'normal'
  ].join(':');
}
