'use client';

import * as React from 'react';

export type DomainHelpContextType = {
  title?: string;
  description: string;
  primaryEntity: string;
  relatedEntities: string[];
  truthSource: string;
  readModelNote?: string;
  supplementarySections?: {
    title: string;
    description?: string;
    facts?: Array<{
      label: string;
      value: string;
    }>;
    items?: string[];
  }[];
};

type DomainHelpStore = {
  activeContext: DomainHelpContextType | null;
  setContext: (context: DomainHelpContextType | null) => void;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const DomainHelpContext = React.createContext<DomainHelpStore | undefined>(
  undefined
);

export function DomainHelpProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [activeContext, setActiveContext] =
    React.useState<DomainHelpContextType | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const setContext = React.useCallback(
    (context: DomainHelpContextType | null) => {
      setActiveContext(context);
    },
    []
  );

  const setDrawerOpen = React.useCallback((open: boolean) => {
    setIsDrawerOpen(open);
  }, []);

  const value = React.useMemo(
    () => ({ activeContext, setContext, isDrawerOpen, setDrawerOpen }),
    [activeContext, setContext, isDrawerOpen, setDrawerOpen]
  );

  return (
    <DomainHelpContext.Provider value={value}>
      {children}
    </DomainHelpContext.Provider>
  );
}

export function useDomainHelpStore() {
  const context = React.useContext(DomainHelpContext);
  if (context === undefined) {
    throw new Error(
      'useDomainHelpStore must be used within a DomainHelpProvider'
    );
  }
  return context;
}
