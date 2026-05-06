'use client';

import * as React from 'react';

const CspNonceContext = React.createContext<string | undefined>(undefined);

export function CspNonceProvider({
  children,
  nonce
}: React.PropsWithChildren<{ nonce?: string }>) {
  // The document CSP is fixed until the next full page load. Keep the matching
  // nonce stable across client-side refreshes and route transitions.
  const stableNonceRef = React.useRef(nonce);

  return (
    <CspNonceContext.Provider value={stableNonceRef.current}>
      {children}
    </CspNonceContext.Provider>
  );
}

export function useCspNonce() {
  return React.useContext(CspNonceContext);
}
