'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function sameSet(a: Set<string>, b: readonly string[]): boolean {
  if (a.size !== b.length) return false;
  for (const v of b) if (!a.has(v)) return false;
  return true;
}

/**
 * A `Set<string>` mirrored into a URL query param, kept off the Next router.
 *
 * The team/map selection in the Overall table sections is pure client-side filtering over data
 * that was already fetched for the chosen tournament, so it must not travel through `router.push`
 * (that re-renders the server component and shows the loading overlay for a selection that changed
 * nothing on the server). Instead the value is seeded from the param on mount and pushed back with
 * `history.replaceState` on every change, so a view stays shareable by link and survives reload.
 *
 * Canonical shape: the param is written only when the set differs from `defaults`; at the default it
 * is omitted, so an absent param means "defaults" and the URL stays clean. The effect also re-runs
 * after any router navigation (via the `searchParams` dependency), which re-asserts the param when a
 * server-side filter change (tour, region, …) rebuilds the query string without it.
 *
 * Returns the plain React setter, so call sites keep using functional updates unchanged.
 */
export function useUrlSet(
  key: string,
  defaults: string[],
): [Set<string>, React.Dispatch<React.SetStateAction<Set<string>>>] {
  const searchParams = useSearchParams();
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  const [set, setSet] = useState<Set<string>>(() => {
    const raw = searchParams.get(key);
    return raw === null ? new Set(defaults) : new Set(raw.split(',').filter(Boolean));
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sameSet(set, defaultsRef.current)) {
      if (!params.has(key)) return;
      params.delete(key);
    } else {
      const val = [...set].sort().join(',');
      if (params.get(key) === val) return;
      params.set(key, val);
    }
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [set, key, searchParams]);

  return [set, setSet];
}
