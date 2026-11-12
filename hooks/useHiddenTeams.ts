'use client';

import { SetStateAction } from 'react';
import { useUrlSet } from './useUrlSet';

/**
 * Team chips on the new main filter (Stats Rank, Neon + Phoenix): every team of `teams` starts
 * selected, and what is stored (URL param `hideTeams`) is the teams turned off. Storing the
 * selection instead would leave the teams of a newly activated region unselected.
 *
 * Returns the selected set and a setter shaped like a Set state setter, so it plugs into
 * TeamChipsPanel; a change only touches the hidden state of the teams in `teams`.
 */
export function useHiddenTeams(teams: string[]) {
  const [hidden, setHidden] = useUrlSet('hideTeams', []);
  const selected = new Set(teams.filter(t => !hidden.has(t)));
  const setSelected = (action: SetStateAction<Set<string>>) => {
    setHidden(prev => {
      const current = new Set(teams.filter(t => !prev.has(t)));
      const next = typeof action === 'function' ? action(current) : action;
      const out = new Set(prev);
      for (const t of teams) { if (next.has(t)) out.delete(t); else out.add(t); }
      return out;
    });
  };
  const reset = () => setHidden(new Set());
  return { selected, setSelected, reset };
}
