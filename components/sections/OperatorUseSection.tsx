'use client';

import { Fragment, useState } from 'react';
import { Info } from 'lucide-react';
import { OperatorUseSide, OperatorUseStat, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { useUrlSet } from '@/hooks/useUrlSet';
import { TeamChipsPanel } from '../TeamChipsPanel';
import { Tooltip } from '../Tooltip';

interface Props {
  stats: Record<string, Record<string, OperatorUseStat>>;
  players: Record<string, Record<string, Record<string, OperatorUseStat>>>;
  maps: string[];
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
  agentImages?: Record<string, string>;
  hasTour?: boolean;
  defaultHiddenMaps?: string[];
}

type Side = 'all' | 'atk' | 'def';
const SIDES: { key: Side; label: string }[] = [
  { key: 'all', label: 'Both' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
];

type ColKey = 'pick' | 'opWr' | 'noOpWr' | 'kept' | 'save' | 'full' | 'half';
// Each column is a numerator / denominator over one side (or both merged)
const COLS: { key: ColKey; label: string; frac: (s: OperatorUseSide) => [number, number] }[] = [
  { key: 'pick',   label: 'Op pick rate', frac: s => [s.op, s.eligible] },
  { key: 'opWr',   label: 'Op WR',        frac: s => [s.opWins, s.opDecided] },
  { key: 'noOpWr', label: 'No-Op WR',     frac: s => [s.noOpWins, s.noOpDecided] },
  { key: 'kept',   label: 'Kept',         frac: s => [s.kept, s.op] },
  { key: 'save',   label: 'Save Op',      frac: s => [s.saved, s.kept] },
  { key: 'full',   label: 'Full buy',     frac: s => [s.fullOp, s.fullEligible] },
  { key: 'half',   label: 'Half buy',     frac: s => [s.halfOp, s.halfEligible] },
];

// What every column of this table means, same pattern as the Neon + Phoenix legend
const LEGEND = (
  <dl className="w-[360px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
    <div>
      <dt className="font-bold text-gray-100">Rounds counted</dt>
      <dd className="text-gray-400">Every round except 1, 2, 13 and 14 (pistols and the round after).</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Op pick rate</dt>
      <dd className="text-gray-400">
        Rounds where at least one player had an Operator, bought that round or kept from the
        previous one, over rounds counted.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Op WR / No-Op WR</dt>
      <dd className="text-gray-400">Round win rate in the rounds with an Op, and in the rounds without one.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Kept</dt>
      <dd className="text-gray-400">
        Op rounds where nobody bought the Op (spend under 4700): it was kept from the previous
        round or picked up.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Save Op</dt>
      <dd className="text-gray-400">
        Kept rounds where the team lost the previous round: the Op was saved instead of dying with
        it. Over Kept rounds, so the rest of Kept came after a won round.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Full buy / Half buy</dt>
      <dd className="text-gray-400">
        Op pick rate only in the rounds where the team&apos;s loadout was 20000 or more (full) or
        15000 to 19999 (half). Lower buys are left out of both.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Agents</dt>
      <dd className="text-gray-400">Agent of the player holding the Op, with its number of rounds.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Both / ATK / DEF and Detail info</dt>
      <dd className="text-gray-400">
        The side buttons switch every column; Detail info adds the counts under each %. Click a
        team to see the same columns per player, counted over the rounds that player held the Op.
      </dd>
    </div>
  </dl>
);

function emptySide(): OperatorUseSide {
  return { eligible: 0, op: 0, kept: 0, saved: 0, opDecided: 0, opWins: 0, noOpDecided: 0, noOpWins: 0, fullEligible: 0, fullOp: 0, halfEligible: 0, halfOp: 0, agents: {} };
}

function addSide(into: OperatorUseSide, from: OperatorUseSide) {
  into.eligible += from.eligible; into.op += from.op; into.kept += from.kept; into.saved += from.saved;
  into.opDecided += from.opDecided; into.opWins += from.opWins;
  into.noOpDecided += from.noOpDecided; into.noOpWins += from.noOpWins;
  into.fullEligible += from.fullEligible; into.fullOp += from.fullOp;
  into.halfEligible += from.halfEligible; into.halfOp += from.halfOp;
  for (const [a, n] of Object.entries(from.agents)) into.agents[a] = (into.agents[a] ?? 0) + n;
}

// One side, or both merged
function sideStat(s: OperatorUseStat, side: Side): OperatorUseSide {
  if (side === 'atk') return s.atk;
  if (side === 'def') return s.def;
  const both = emptySide();
  addSide(both, s.atk);
  addSide(both, s.def);
  return both;
}

function pct([op, eligible]: [number, number]): number | null {
  return eligible === 0 ? null : Math.round((op / eligible) * 100);
}

// Gradient background by % (same palette as Maps Rank)
function heatmapBg(pct: number | null): string {
  if (pct === null) return 'transparent';
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 220 - t * 80;
  const sat = 55;
  const light = 18 + t * 28;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function OperatorUseSection({ stats, players, maps, teamLogos = {}, teamRegions = {}, mapImages = {}, agentImages = {}, hasTour = false, defaultHiddenMaps = [] }: Props) {
  const { navigate } = useNavigation();
  const [side, setSide] = useState<Side>('all');
  const [showDetail, setShowDetail] = useState(false);
  const [sortCol, setSortCol] = useState<ColKey>('pick');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allTeams = Object.keys(stats).sort();
  const [selectedTeams, setSelectedTeams] = useUrlSet('teams', allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t)));
  const baseTeams = allTeams.filter(t => selectedTeams.has(t));

  // Hidden maps: not columns, they filter which rounds are summed per team
  const [hiddenMaps, setHiddenMaps] = useUrlSet('hideMaps', maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase())));
  const visibleMaps = maps.filter(m => !hiddenMaps.has(m));

  function toggleMap(map: string) {
    setHiddenMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });
  }

  function toggleExpanded(team: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  function resetFilters() {
    setSelectedTeams(new Set(allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setHiddenMaps(new Set(maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase()))));
    setSide('all');
    setSortCol('pick');
    setSortDir('desc');
    navigate('?section=operator-use');
  }

  if (allTeams.length === 0 || maps.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        {hasTour ? 'No Operator data for the selected filters' : 'Select a tournament to see Operator use...'}
      </div>
    );
  }

  // Sum of a team's (or player's) rounds on the visible maps
  function mapsTotal(byMap: Record<string, OperatorUseStat> | undefined): OperatorUseStat {
    const tot: OperatorUseStat = { atk: emptySide(), def: emptySide() };
    for (const m of visibleMaps) {
      const s = byMap?.[m];
      if (!s) continue;
      addSide(tot.atk, s.atk);
      addSide(tot.def, s.def);
    }
    return tot;
  }

  const sortFrac = COLS.find(c => c.key === sortCol)!.frac;
  function byPct(a: OperatorUseStat, b: OperatorUseStat): number {
    const valA = pct(sortFrac(sideStat(a, side)));
    const valB = pct(sortFrac(sideStat(b, side)));
    if (valA === null && valB === null) return 0;
    if (valA === null) return 1;
    if (valB === null) return -1;
    return sortDir === 'asc' ? valA - valB : valB - valA;
  }

  function handleColClick(col: ColKey) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  const totals = Object.fromEntries(baseTeams.map(t => [t, mapsTotal(stats[t])]));
  const teams = [...baseTeams].sort((a, b) => byPct(totals[a], totals[b]));

  // Players of a team who played at least one eligible round on the visible maps, same order as the teams
  function teamPlayers(team: string): [string, OperatorUseStat][] {
    return Object.entries(players[team] ?? {})
      .map(([p, byMap]) => [p, mapsTotal(byMap)] as [string, OperatorUseStat])
      .filter(([, tot]) => tot.atk.eligible + tot.def.eligible > 0)
      .sort((a, b) => byPct(a[1], b[1]));
  }

  function pctCell(key: string, c: [number, number]) {
    const val = pct(c);
    return (
      <td
        key={key}
        className="py-3 px-3 text-center"
        style={{ backgroundColor: val !== null ? heatmapBg(val) : '#1a1d23' }}
      >
        {val !== null ? (
          <>
            <div className="text-sm font-bold text-gray-100">{val}%</div>
            {showDetail && (
              <div className="text-[13px] text-gray-200/80 whitespace-nowrap">{c[0]}/{c[1]}</div>
            )}
          </>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </td>
    );
  }

  // Op holders by agent, most used first
  function agentsCell(agents: Record<string, number>) {
    const list = Object.entries(agents).sort((a, b) => b[1] - a[1]);
    return (
      <td className="py-3 px-3">
        {list.length === 0 ? (
          <span className="block text-center text-gray-700">—</span>
        ) : (
          <div className="flex items-center gap-2 whitespace-nowrap">
            {list.map(([agent, n]) => (
              <span key={agent} className="flex items-center gap-0.5 text-[12px] text-gray-300" title={agent}>
                {agentImages[agent]
                  ? <img src={agentImages[agent]} alt={agent} className="w-5 h-5 rounded-sm object-cover" />
                  : agent}
                {n}
              </span>
            ))}
          </div>
        )}
      </td>
    );
  }

  const headerCls = 'border-b border-gray-800 px-3 align-bottom pb-2 text-[11px] font-bold uppercase tracking-wide';

  return (
    <div className="flex flex-col gap-4">

      {/* Filters: teams on the left + maps on the right */}
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <TeamChipsPanel
          allTeams={allTeams}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          teamLogos={teamLogos}
          teamRegions={teamRegions}
        />

        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Maps</span>
          <div className="flex gap-2 px-1 overflow-x-auto">
            {maps.map(map => {
              const active = !hiddenMaps.has(map);
              const img = mapImages[map];
              return (
                <button
                  key={map}
                  onClick={() => toggleMap(map)}
                  className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                  }`}
                >
                  {img && (
                    <img
                      src={img}
                      alt={map}
                      className={`w-[50px] h-[40px] object-cover rounded shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
                    />
                  )}
                  <span className={active ? '' : 'line-through'}>{map}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-start items-center gap-3 px-1">
        <div className="flex gap-1.5">
          {SIDES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSide(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                side === key
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowDetail(d => !d)}
          className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
            showDetail
              ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
              : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          Detail info
        </button>
        <button
          onClick={resetFilters}
          className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
        >
          Reset filters
        </button>
        <Tooltip content={LEGEND} className="items-center">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-200 hover:text-white transition-colors cursor-help">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Legend
          </span>
        </Tooltip>
      </div>

      {baseTeams.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Select at least one team to see Operator use...
        </div>
      ) : (
      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-auto max-h-[85vh] w-fit max-w-full">
        <table className="border-separate" style={{ borderSpacing: '1px 2px' }}>
          <thead className="bg-[#0f1115] sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0f1115] border-b border-gray-800 w-8 text-center align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500" style={{ minWidth: 32 }}>
                #
              </th>
              <th className="sticky left-8 z-10 bg-[#0f1115] border-b border-r border-gray-800 px-5 text-left align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">
                Team
              </th>
              {COLS.map(({ key, label }) => {
                const isActive = sortCol === key;
                return (
                  <th
                    key={key}
                    onClick={() => handleColClick(key)}
                    className={`${headerCls} cursor-pointer select-none transition-colors hover:bg-[#252a33] whitespace-nowrap ${isActive ? 'bg-[#1e2430]' : ''}`}
                    style={{ minWidth: 88 }}
                  >
                    <div className="flex flex-col items-center justify-end gap-1">
                      <span className={isActive ? 'text-blue-400' : 'text-gray-400'}>{label}</span>
                      <span className={`text-[9px] ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                      </span>
                    </div>
                  </th>
                );
              })}
              <th className={`${headerCls} text-gray-400 text-left`}>Agents</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team, rank) => {
              const isOpen = expanded.has(team);
              const teamSide = sideStat(totals[team], side);
              return (
                <Fragment key={team}>
                  <tr className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
                    <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 text-center py-3 text-[11px] font-bold text-gray-600" style={{ minWidth: 32 }}>
                      {rank + 1}
                    </td>
                    <td
                      onClick={() => toggleExpanded(team)}
                      className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap cursor-pointer select-none hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-500 w-2">{isOpen ? '▼' : '▶'}</span>
                        {teamLogos[team] && (
                          <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />
                        )}
                        {team}
                      </div>
                    </td>
                    {COLS.map(({ key, frac }) => pctCell(key, frac(teamSide)))}
                    {agentsCell(teamSide.agents)}
                  </tr>
                  {isOpen && teamPlayers(team).map(([player, tot]) => {
                    const ps = sideStat(tot, side);
                    return (
                    <tr key={`${team}-${player}`} className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
                      <td className="sticky left-0 z-10 bg-[#15181d]" style={{ minWidth: 32 }} />
                      <td className="sticky left-8 z-10 bg-[#15181d] pl-12 pr-5 py-2 text-[11px] text-gray-400 border-r border-gray-800 whitespace-nowrap">
                        {player}
                      </td>
                      {COLS.map(({ key, frac }) => pctCell(key, frac(ps)))}
                      {agentsCell(ps.agents)}
                    </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
