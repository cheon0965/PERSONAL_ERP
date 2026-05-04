'use client';

import * as React from 'react';

const CspNonceContext = React.createContext<string | undefined>(undefined);

export function CspNonceProvider({
  children,
  nonce
}: React.PropsWithChildren<{ nonce?: string }>) {
  return (
    <CspNonceContext.Provider value={nonce}>
      {children}
    </CspNonceContext.Provider>
  );
}

export function useCspNonce() {
  return React.useContext(CspNonceContext);
}
