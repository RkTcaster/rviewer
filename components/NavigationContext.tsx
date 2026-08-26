'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Los cambios de filtros esperan este tiempo antes de navegar, así una tanda de
// clicks (varios torneos, varias regiones) termina en una sola request al server.
const APPLY_DELAY_MS = 1500;

// query: lo que el usuario ya eligió. base: la query de la URL sobre la que lo
// eligió, para distinguir después si la URL cambió por nuestra navegación o por
// afuera (back/forward del browser).
type PendingEdit = { base: string; query: string };

type NavigationContextValue = {
  isPending: boolean;
  hasPendingEdits: boolean;
  pendingEdit: PendingEdit | null;
  navigate: (href: string) => void;
  commitParams: (next: URLSearchParams, opts?: { immediate?: boolean }) => void;
  flush: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [hasPendingEdits, setHasPendingEdits] = useState(false);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const navigate = useCallback((href: string) => {
    startTransition(() => router.push(href));
  }, [router]);

  const push = useCallback((query: string) => {
    clearTimer();
    setHasPendingEdits(false);
    navigate(`?${query}`);
  }, [navigate]);

  const commitParams = useCallback((next: URLSearchParams, { immediate = false } = {}) => {
    const query = next.toString();
    pendingRef.current = query;
    setPendingEdit({ base: window.location.search.replace(/^\?/, ''), query });
    clearTimer();
    if (immediate) {
      push(query);
      return;
    }
    setHasPendingEdits(true);
    timerRef.current = setTimeout(() => push(query), APPLY_DELAY_MS);
  }, [push]);

  // Cerrar un dropdown o cambiar de sección no espera al timer.
  const flush = useCallback(() => {
    if (timerRef.current && pendingRef.current !== null) push(pendingRef.current);
  }, [push]);

  useEffect(() => () => clearTimer(), []);

  const value = useMemo(
    () => ({ isPending, hasPendingEdits, pendingEdit, navigate, commitParams, flush }),
    [isPending, hasPendingEdits, pendingEdit, navigate, commitParams, flush]
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within a NavigationProvider');
  return ctx;
}

// Params efectivos: lo que el usuario ya eligió, aunque todavía no haya navegado.
// La edición pendiente manda mientras siga siendo más nueva que la URL: o porque
// la URL todavía no la alcanzó, o porque quedan cambios en cola (hasPendingEdits)
// y lo que acaba de aterrizar es una navegación anterior. Si la URL cambió por
// afuera y no hay nada en cola, gana la URL.
export function useFilterParams(): URLSearchParams {
  const searchParams = useSearchParams();
  const { pendingEdit, hasPendingEdits } = useNavigation();
  const url = searchParams.toString();
  const query =
    pendingEdit && (hasPendingEdits || url === pendingEdit.base || url === pendingEdit.query)
      ? pendingEdit.query
      : url;
  return useMemo(() => new URLSearchParams(query), [query]);
}
