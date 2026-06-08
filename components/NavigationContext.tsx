'use client';

import { createContext, useContext, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type NavigationContextValue = {
  isPending: boolean;
  navigate: (href: string) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = (href: string) => {
    startTransition(() => router.push(href));
  };

  return (
    <NavigationContext.Provider value={{ isPending, navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}
