'use client';

import * as React from 'react';

export type DomainHelpContextType = {
  title?: string;
  description: string;
  primaryEntity: string;
  relatedEntities: string[];
  truthSource: string;
  readModelNote?: string;
  supplementarySections?: ReadonlyArray<{
    title: string;
    description?: string;
    facts?: ReadonlyArray<{
      label: string;
      value: string;
    }>;
    items?: readonly string[];
    links?: ReadonlyArray<{
      title: string;
      href: string;
      description?: string;
      actionLabel?: string;
    }>;
  }>;
};

type DomainHelpStore = {
  activeContext: DomainHelpContextType | null;
  setContext: (context: DomainHelpContextType | null) => void;
  clearContext: (context: DomainHelpContextType) => void;
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

  const clearContext = React.useCallback((context: DomainHelpContextType) => {
    const serializedContext = JSON.stringify(context);
    setActiveContext((current) => {
      if (!current) {
        return null;
      }

      return JSON.stringify(current) === serializedContext ? null : current;
    });
  }, []);

  const setDrawerOpen = React.useCallback((open: boolean) => {
    setIsDrawerOpen(open);
  }, []);

  const value = React.useMemo(
    () => ({
      activeContext,
      setContext,
      clearContext,
      isDrawerOpen,
      setDrawerOpen
    }),
    [activeContext, setContext, clearContext, isDrawerOpen, setDrawerOpen]
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
