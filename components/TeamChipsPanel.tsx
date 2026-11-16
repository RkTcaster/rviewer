'use client';

import { Dispatch, ReactNode, SetStateAction, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { teamLabel } from '@/lib/teamKey';
import { subregionFlagFile } from '@/lib/subregionFlags';

// Team selection shared by the Overall table sections (Stats Rank, Maps Rank, Neon + Phoenix,
// Post-Pistol Force, Series Outcomes…): one row of split chips, one per subregion (the region logo
// with the subregion flag as a badge), like the region chips of the tournament filter (menuChip):
// the chip toggles the whole subregion and its ▾ opens a checkbox menu with its teams. Add all /
// Clear, and a collapsible body so the panel doesn't push the table down.

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
  /** Subregion per team (getTeamSubregions); a team without one goes in its region's last row */
  teamSubregions: Record<string, string>;
  /** Extra controls rendered at the end of the header row (Legend, Reset, …). */
  headerExtra?: ReactNode;
}

export function TeamChipsPanel({ allTeams, selectedTeams, setSelectedTeams, teamLogos, teamRegions, teamSubregions, headerExtra }: Props) {
  const open = useSyncExternalStore(subscribe, readOpen, () => false);
  const toggleOpen = () => writeOpen(!open);
  // Subregion chip whose ▾ menu is open, one at a time; closes on click outside or Esc
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Tag search inside the open menu; emptied whenever a menu opens or closes
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenu(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openMenu]);

  const selectedCount = allTeams.filter(t => selectedTeams.has(t)).length;
  const allTeamsSelected = selectedCount === allTeams.length;

  function toggleTeam(team: string) {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  // All / None of the menu: turns on or off just the given teams (the ones the search shows)
  function setTeams(teams: string[], on: boolean) {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      for (const t of teams) { if (on) next.add(t); else next.delete(t); }
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
  // Per region: one chip per subregion (alphabetical), then one for its teams without a subregion
  const rows: { label: string; logo: string | null; flag: string | null; teams: string[] }[] = [];
  for (const r of REGIONS) {
    const regionTeams = allTeams.filter(t => teamRegions[t] === r.id);
    const logo = `/region/${r.label.toLowerCase()}.png`;
    const subs = [...new Set(regionTeams.map(t => teamSubregions[t]).filter((s): s is string => !!s))].sort();
    for (const sub of subs) {
      rows.push({ label: `${r.label} · ${sub}`, logo, flag: subregionFlagFile(sub), teams: regionTeams.filter(t => teamSubregions[t] === sub) });
    }
    rows.push({ label: r.label, logo, flag: null, teams: regionTeams.filter(t => !teamSubregions[t]) });
  }
  const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
  if (otherTeams.length > 0) rows.push({ label: 'Other', logo: null, flag: null, teams: otherTeams });
  // Same tones as the tournament filter chips: all / some / none of the subregion selected
  const TONE = {
    on: 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60',
    partial: 'bg-blue-900/15 border-blue-800 border-dashed text-blue-300/80 hover:bg-blue-900/30',
    off: 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300',
  };

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
            Click a subregion to add / remove all its teams, ▾ to pick teams
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-wrap items-start gap-2 px-1">
          {rows.filter(row => row.teams.length > 0).map(row => {
            const n = row.teams.filter(t => selectedTeams.has(t)).length;
            const tone = n === 0 ? 'off' : n === row.teams.length ? 'on' : 'partial';
            const menuOpen = openMenu === row.label;
            const q = query.trim().toLowerCase();
            const shown = menuOpen && q ? row.teams.filter(t => teamLabel(t).toLowerCase().includes(q)) : row.teams;
            return (
              <div key={row.label} ref={menuOpen ? menuRef : undefined} className="relative">
                <div className={`h-[42px] rounded-xl border transition-colors flex items-stretch overflow-hidden ${TONE[tone]}`}>
                  <button
                    onClick={() => toggleRegionTeams(row.teams)}
                    title={`${row.label} — select / clear all its teams`}
                    className="flex items-center pl-3 pr-2 text-[11px] font-bold uppercase tracking-widest"
                  >
                    {/* The logo replaces the name; 'Other' has no logo and falls back to text */}
                    {row.logo
                      ? (
                        <span className={`relative w-[28px] h-[28px] shrink-0 transition-all ${tone === 'off' ? 'grayscale opacity-60' : ''}`}>
                          <img src={row.logo} alt={row.label} className="w-[28px] h-[28px] object-contain" />
                          {row.flag && (
                            <img src={row.flag} alt="" className="absolute -bottom-0.5 -right-1.5 w-[15px] h-[10px] object-cover rounded-[2px] ring-1 ring-gray-900" />
                          )}
                        </span>
                      )
                      : row.label}
                  </button>
                  <button
                    onClick={() => { setOpenMenu(menuOpen ? null : row.label); setQuery(''); }}
                    title={`Pick ${row.label} teams`}
                    className="flex items-center gap-0.5 pl-2 pr-3 border-l border-gray-600/60 text-[12px] font-bold"
                  >
                    {n}/{row.teams.length}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {menuOpen && (
                  // z-50 like the other dropdowns: the tables' sticky headers are z-20 and come later in the page
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] max-h-[400px] flex flex-col bg-[#252a33] border border-gray-700 rounded-lg shadow-xl">
                    {/* Header (doesn't scroll): tag search on long lists + All / None of what it shows */}
                    <div className="flex flex-col gap-1.5 p-2 border-b border-gray-700">
                      {row.teams.length > 8 && (
                        <input
                          autoFocus
                          value={query}
                          onChange={e => setQuery(e.target.value)}
                          placeholder="Search tag…"
                          className="w-full px-2 py-1 rounded-md bg-[#1e2128] border border-gray-700 text-[12px] text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-700"
                        />
                      )}
                      <div className="flex gap-1.5">
                        {([['All', true], ['None', false]] as const).map(([label, on]) => (
                          <button
                            key={label}
                            onClick={() => setTeams(shown, on)}
                            disabled={shown.length === 0}
                            className="flex-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:opacity-40 transition-colors"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-y-auto py-1">
                      {shown.length === 0 && <div className="px-3 py-1.5 text-[12px] text-gray-500">No teams match</div>}
                      {shown.map(team => {
                        const active = selectedTeams.has(team);
                        const logo = teamLogos[team];
                        return (
                          <button
                            key={team}
                            onClick={() => toggleTeam(team)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] font-semibold text-gray-200 hover:bg-gray-700/50"
                          >
                            <span className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center text-[10px] leading-none ${
                              active ? 'bg-blue-600 border-blue-500 text-white' : 'border-gray-500'
                            }`}>
                              {active ? '✓' : ''}
                            </span>
                            {logo && <img src={logo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                            {teamLabel(team)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
