'use client';

import { Dispatch, ReactNode, SetStateAction, useSyncExternalStore } from 'react';
import { ChevronDown, Users } from 'lucide-react';

// Team selection shared by the Overall table sections (Stats Rank, Maps Rank, Neon + Phoenix,
// Post-Pistol Force, Series Outcomes): one row of team chips per region, the region logo as a
// bulk toggle, Add all / Clear, and a collapsible body so the panel doesn't push the table down.

const REGIONS: { id: string; label: string }[] = [
  { id: 'reg_0', label: 'Americas' },
  { id: 'reg_1', label: 'EMEA' },
  { id: 'reg_2', label: 'China' },
  { id: 'reg_3', label: 'Pacific' },
];

// Open/closed is a per-viewer convenience shared by every section. Kept in localStorage behind a
// tiny external store: the server snapshot is "collapsed", so hydration matches, and the stored
// value is picked up right after. `memOpen` keeps the toggle working when storage throws.
const OPEN_KEY = 'team-chips-open';
let memOpen = false;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const readOpen = () => {
  try { const v = localStorage.getItem(OPEN_KEY); return v === null ? memOpen : v === '1'; } catch { return memOpen; }
};
const writeOpen = (open: boolean) => {
  memOpen = open;
  try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
  listeners.forEach(l => l());
};

interface Props {
  allTeams: string[];
  selectedTeams: Set<string>;
  setSelectedTeams: Dispatch<SetStateAction<Set<string>>>;
  teamLogos: Record<string, string>;
  teamRegions: Record<string, string>;
  /** Extra controls rendered at the end of the header row (Legend, Reset, …). */
  headerExtra?: ReactNode;
}

export function TeamChipsPanel({ allTeams, selectedTeams, setSelectedTeams, teamLogos, teamRegions, headerExtra }: Props) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const toggleOpen = () => writeOpen(!open);

  const selectedCount = allTeams.filter(t => selectedTeams.has(t)).length;
  const allTeamsSelected = selectedCount === allTeams.length;

  function toggleTeam(team: string) {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  // Clears the whole region when every team in it is already selected, otherwise adds them all.
  function toggleRegionTeams(rowTeams: string[]) {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      const allSelected = rowTeams.every(t => next.has(t));
      for (const t of rowTeams) {
        if (allSelected) next.delete(t); else next.add(t);
      }
      return next;
    });
  }

  const knownRegions = new Set(REGIONS.map(r => r.id));
  const rows: { label: string; logo: string | null; teams: string[] }[] = REGIONS.map(r => ({
    label: r.label,
    logo: `/region/${r.label.toLowerCase()}.png`,
    teams: allTeams.filter(t => teamRegions[t] === r.id),
  }));
  const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
  if (otherTeams.length > 0) rows.push({ label: 'Other', logo: null, teams: otherTeams });

  return (
    <div className="flex flex-col gap-2">
      {/* Same title style as the Maps column in Maps Rank, so both line up */}
      <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>
      <div className="flex flex-wrap items-center gap-3 px-1">
        {open ? (
          <button
            onClick={toggleOpen}
            title="Hide the team chips"
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-gray-300 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            <span className="normal-case tracking-normal font-semibold text-gray-400">{selectedCount} / {allTeams.length} selected</span>
          </button>
        ) : (
          // Collapsed: the whole block is one chip, sized like the Maps Rank map chips
          // (p-1.5, 50x40 media, 11px label), styled active while any team is selected
          <button
            onClick={toggleOpen}
            title="Show the team chips"
            className={`flex items-center gap-3 p-1.5 pr-4 rounded-lg border transition-colors ${
              selectedCount > 0
                ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
            }`}
          >
            <span className="flex flex-col items-center gap-1 text-[11px] font-bold uppercase tracking-wide">
              <span className="w-[50px] h-[40px] flex items-center justify-center shrink-0">
                <Users className="w-7 h-7" />
              </span>
              Teams
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[11px] font-semibold text-gray-400">{selectedCount} / {allTeams.length} selected</span>
              <span className="text-[10px] text-gray-600">Click to expand</span>
            </span>
          </button>
        )}
        <button
          onClick={() => setSelectedTeams(allTeamsSelected ? new Set() : new Set(allTeams))}
          // Collapsed: as tall as the Teams chip (self-stretch on the header row); open: the usual pill
          className={`${open ? 'px-3 py-1 rounded-full' : 'self-stretch flex items-center px-5 rounded-lg'} text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200`}
        >
          {allTeamsSelected ? 'Clear' : 'Add all teams'}
        </button>
        {headerExtra}
        {open && (
          <span className="text-[10px] text-gray-600">
            Click a region logo to add / remove all teams from that region
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2 px-1">
          {rows.filter(row => row.teams.length > 0).map(row => {
            // Dimmed like an inactive chip when no team of the row is selected
            const anySelected = row.teams.some(t => selectedTeams.has(t));
            return (
              <div key={row.label} className="flex items-center gap-3">
                <button
                  onClick={() => toggleRegionTeams(row.teams)}
                  title={`${row.label} — select / clear the whole region`}
                  className={`w-12 shrink-0 flex items-center justify-start text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-100 ${
                    anySelected ? 'text-gray-400' : 'text-gray-600 opacity-50'
                  }`}
                >
                  {/* The logo replaces the name; 'Other' has no logo and falls back to text */}
                  {row.logo
                    ? <img src={row.logo} alt={row.label} className={`w-[30px] h-[30px] object-contain shrink-0 transition-all ${anySelected ? '' : 'grayscale'}`} />
                    : row.label}
                </button>
                <div className="flex flex-wrap gap-2">
                  {row.teams.map(team => {
                    const active = selectedTeams.has(team);
                    const logo = teamLogos[team];
                    return (
                      <button
                        key={team}
                        onClick={() => toggleTeam(team)}
                        className={`w-[58px] flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg text-[12.8px] font-bold uppercase tracking-wide transition-colors border ${
                          active
                            ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                            : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                        }`}
                      >
                        {logo && (
                          <img src={logo} alt={team} className={`w-5 h-5 object-contain shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`} />
                        )}
                        <span className={active ? '' : 'line-through'}>{team}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
