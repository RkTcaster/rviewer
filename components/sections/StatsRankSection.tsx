'use client';

import { useState } from 'react';
import { TeamRankStats, TeamEconomyCompare, EconomyCategoryStats, EconomyMatchup, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';

interface Props {
  rankings: Record<string, TeamRankStats>;
  economy?: Record<string, TeamEconomyCompare>;
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
}

const ECO_CATEGORIES: { key: keyof TeamEconomyCompare; label: string; range: string }[] = [
  { key: 'eco',     label: 'Eco',      range: '0-5k'   },
  { key: 'semiEco', label: 'Semi-Eco', range: '5-15k'  },
  { key: 'semiBuy', label: 'Semi-Buy', range: '15-20k' },
  { key: 'fullBuy', label: 'Full Buy', range: '20k+'   },
];
const ECO_VS: { key: keyof EconomyCategoryStats; label: string }[] = [
  { key: 'total',     label: 'Overall'     },
  { key: 'vsEco',     label: 'vs Eco'      },
  { key: 'vsSemiEco', label: 'vs Semi-Eco' },
  { key: 'vsSemiBuy', label: 'vs Semi-Buy' },
  { key: 'vsFullBuy', label: 'vs Full-Buy' },
];
// Toggleable column groups (chips). 'overall' + 'first3' come from METRICS; the rest are economy categories.
const COLUMN_GROUPS: { id: string; label: string }[] = [
  { id: 'overall', label: 'Overall' },
  { id: 'first3',  label: 'First 3 rounds performance' },
  ...ECO_CATEGORIES.map(c => ({ id: c.key as string, label: c.label })),
];
const ecoColKey = (cat: keyof TeamEconomyCompare, vs: keyof EconomyCategoryStats) => `${cat}:${vs}`;
function ecoMatchup(economy: Record<string, TeamEconomyCompare>, team: string, cat: keyof TeamEconomyCompare, vs: keyof EconomyCategoryStats): EconomyMatchup | undefined {
  return economy[team]?.[cat]?.[vs];
}
function ecoValue(m: EconomyMatchup | undefined): number | null {
  return m && m.played > 0 ? Math.round((m.wins / m.played) * 100) : null;
}

const REGION_ROWS: { id: string; label: string }[] = [
  { id: 'reg_0', label: 'Americas' },
  { id: 'reg_1', label: 'EMEA' },
  { id: 'reg_2', label: 'China' },
  { id: 'reg_3', label: 'Pacific' },
];

function pct(wins: number, total: number): number | null {
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

type MetricDef = {
  label: string;
  getValue: (s: TeamRankStats) => number | null;
  /** wins/total for the W-L line under the %. Omit for count-only metrics. */
  getWL?: (s: TeamRankStats) => { wins: number; total: number };
  lowerIsBetter?: boolean;
  countOnly?: boolean;
};
type SeparatorDef = { separator: true; label: string };
type RowDef = MetricDef | SeparatorDef;

const METRICS: RowDef[] = [
  { label: 'Map Winrate',            getValue: s => pct(s.mapWins, s.mapPlayed),                  getWL: s => ({ wins: s.mapWins, total: s.mapPlayed }) },
  { label: 'Round Winrate',          getValue: s => pct(s.attWins + s.defWins, s.attTotal + s.defTotal), getWL: s => ({ wins: s.attWins + s.defWins, total: s.attTotal + s.defTotal }) },
  { label: 'Atk Side Winrate',       getValue: s => pct(s.attWins, s.attTotal),                  getWL: s => ({ wins: s.attWins, total: s.attTotal }) },
  { label: 'Plant Rate ATK',         getValue: s => pct(s.postPlantPl, s.attTotal),              getWL: s => ({ wins: s.postPlantPl, total: s.attTotal }) },
  { label: 'Post Plant WR',          getValue: s => s.postPlantPl > 0 ? pct(s.postPlantPl - s.postPlantDe, s.postPlantPl) : null, getWL: s => ({ wins: s.postPlantPl - s.postPlantDe, total: s.postPlantPl }) },
  { label: 'Def Side Winrate',       getValue: s => pct(s.defWins, s.defTotal),                  getWL: s => ({ wins: s.defWins, total: s.defTotal }) },
  { label: 'Plant Rate DEF',         getValue: s => pct(s.retakePl, s.defTotal), lowerIsBetter: true, getWL: s => ({ wins: s.retakePl, total: s.defTotal }) },
  { label: 'Retake Eff',             getValue: s => pct(s.retakeDe, s.retakePl),                 getWL: s => ({ wins: s.retakeDe, total: s.retakePl }) },
  { label: 'Timeout Losses',         getValue: s => s.timeoutLosses, lowerIsBetter: true, countOnly: true },
  { separator: true, label: 'First 3 rounds performance' },
  { label: 'Pistol Winrate',         getValue: s => pct(s.pistolWins, s.pistolTotal),            getWL: s => ({ wins: s.pistolWins, total: s.pistolTotal }) },
  { label: 'Post Pistol Into Win',   getValue: s => pct(s.antiEcoWins, s.antiEcoTotal),          getWL: s => ({ wins: s.antiEcoWins, total: s.antiEcoTotal }) },
  { label: 'Bonus Conversion (W-W-W)', getValue: s => pct(s.pabWins, s.pabTotal),                  getWL: s => ({ wins: s.pabWins, total: s.pabTotal }) },
  { label: 'Bonus Conversion Atk',               getValue: s => pct(s.pabAtkWins, s.pabAtkTotal),            getWL: s => ({ wins: s.pabAtkWins, total: s.pabAtkTotal }) },
  { label: 'Bonus Conversion Def',               getValue: s => pct(s.pabDefWins, s.pabDefTotal),            getWL: s => ({ wins: s.pabDefWins, total: s.pabDefTotal }) },
  { label: 'Post Pistol Loss Into Win (L-W)', getValue: s => pct(s.recoveryWins, s.recoveryTotal), getWL: s => ({ wins: s.recoveryWins, total: s.recoveryTotal }) },
  { label: 'Losing to enemy bonus (L-L-L)',  getValue: s => pct(s.first3Lost, s.first3Total), lowerIsBetter: true, getWL: s => ({ wins: s.first3Lost, total: s.first3Total }) },
];

function getCellColor(value: number | null, allValues: (number | null)[], lowerIsBetter: boolean): string {
  if (value === null) return 'text-gray-600';
  const defined = allValues.filter((v): v is number => v !== null);
  if (defined.length === 0) return 'text-gray-300';
  const best = lowerIsBetter ? Math.min(...defined) : Math.max(...defined);
  const worst = lowerIsBetter ? Math.max(...defined) : Math.min(...defined);
  if (value === best) return 'text-green-400 font-black';
  if (value === worst && defined.length > 1) return 'text-red-400';
  return 'text-gray-300';
}

export function StatsRankSection({ rankings, economy = {}, teamLogos = {}, teamRegions = {} }: Props) {
  const { navigate } = useNavigation();
  const [sortCol, setSortCol] = useState<number | string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [showDetail, setShowDetail] = useState(false);

  const allTeams = Object.keys(rankings).sort();
  // Por defecto se muestran solo los equipos de STATS_RANK_DEFAULT_TEAMS (el resto ocultos)
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(
    () => new Set(allTeams.filter(t => !STATS_RANK_DEFAULT_TEAMS.includes(t)))
  );

  const baseTeams = allTeams.filter(t => !hiddenTeams.has(t));

  // Column-group visibility (chips). Default: Overall + First 3 visible, economy groups hidden.
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(
    () => new Set(ECO_CATEGORIES.map(c => c.key))
  );

  function toggleTeam(team: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  function toggleGroup(id: string) {
    setHiddenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetFilters() {
    // Vuelve al estado inicial: 4 torneos por defecto (sin params) y equipos filtrados
    setHiddenTeams(new Set(allTeams.filter(t => !STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setHiddenGroups(new Set(ECO_CATEGORIES.map(c => c.key)));
    setSortCol(null);
    setSortDir('desc');
    navigate('?section=stats-rank');
  }

  // Sin datos de torneos no hay chips que mostrar: placeholder completo.
  if (allTeams.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region and tournament to see the ranking...
      </div>
    );
  }

  const separatorIdx = METRICS.findIndex(r => 'separator' in r);
  const metricDefs = METRICS.filter((r): r is MetricDef => !('separator' in r));
  const afterSeparatorLabels = new Set(
    METRICS.slice(separatorIdx + 1)
      .filter((r): r is MetricDef => !('separator' in r))
      .map(r => r.label)
  );
  const separatorLabel = (METRICS[separatorIdx] as SeparatorDef).label;
  const firstGroupCount = separatorIdx;
  const secondGroupCount = metricDefs.length - firstGroupCount;

  // Group visibility helpers (chips). Metric group is 'overall' before the separator, 'first3' after.
  const metricGroupId = (mi: number) => (mi < firstGroupCount ? 'overall' : 'first3');
  const showOverall = !hiddenGroups.has('overall');
  const showFirst3 = !hiddenGroups.has('first3');
  const visibleEcoCats = ECO_CATEGORIES.filter(c => !hiddenGroups.has(c.key));

  // Pre-compute per-metric values for all teams (for coloring, always uses base alphabetical order)
  const metricAllValues = metricDefs.map(m => baseTeams.map(t => m.getValue(rankings[t])));

  // Pre-compute per-economy-column values for all teams (keyed by "cat:vs")
  const ecoAllValues: Record<string, (number | null)[]> = {};
  for (const c of ECO_CATEGORIES) for (const v of ECO_VS) {
    ecoAllValues[ecoColKey(c.key, v.key)] = baseTeams.map(t => ecoValue(ecoMatchup(economy, t, c.key, v.key)));
  }

  // Resolve the sortable value for a team given the current sort column (metric index or eco "cat:vs" key)
  const sortValue = (t: string): number | null => {
    if (typeof sortCol === 'number') return metricDefs[sortCol].getValue(rankings[t]);
    const [cat, vs] = (sortCol as string).split(':') as [keyof TeamEconomyCompare, keyof EconomyCategoryStats];
    return ecoValue(ecoMatchup(economy, t, cat, vs));
  };

  // Sort teams by selected column
  const teams = sortCol === null
    ? baseTeams
    : [...baseTeams].sort((a, b) => {
        const valA = sortValue(a);
        const valB = sortValue(b);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      });

  function handleColClick(col: number | string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  return (
    <div className="flex flex-col gap-4">

    {/* Teams subtitle */}
    <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>

    {/* Team filter chips — one row per region */}
    {(() => {
      const renderChip = (team: string) => {
        const active = !hiddenTeams.has(team);
        const logo = teamLogos[team];
        return (
          <button
            key={team}
            onClick={() => toggleTeam(team)}
            className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-[16px] font-bold uppercase tracking-wide transition-colors border ${
              active
                ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
            }`}
          >
            {logo && (
              <img
                src={logo}
                alt={team}
                className={`w-6 h-6 object-contain shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
              />
            )}
            <span className={active ? '' : 'line-through'}>{team}</span>
          </button>
        );
      };

      const knownRegions = new Set(REGION_ROWS.map(r => r.id));
      const rows = REGION_ROWS.map(r => ({
        label: r.label,
        teams: allTeams.filter(t => teamRegions[t] === r.id),
      }));
      const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
      if (otherTeams.length > 0) rows.push({ label: 'Other', teams: otherTeams });

      return (
        <div className="flex flex-col gap-2 px-1">
          {rows.filter(row => row.teams.length > 0).map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">
                {row.label}
              </span>
              <div className="flex flex-wrap gap-2">
                {row.teams.map(renderChip)}
              </div>
            </div>
          ))}
        </div>
      );
    })()}

    {/* Table info subtitle + group filter chips */}
    <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Table info</span>
    <div className="flex flex-wrap gap-2 px-1">
      {COLUMN_GROUPS.map(g => {
        const active = !hiddenGroups.has(g.id);
        return (
          <button
            key={g.id}
            onClick={() => toggleGroup(g.id)}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-wide transition-colors border ${
              active
                ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
            }`}
          >
            <span className={active ? '' : 'line-through'}>{g.label}</span>
          </button>
        );
      })}
    </div>

    {/* Controls */}
    <div className="flex justify-start gap-2 px-1">
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
    </div>

    {baseTeams.length === 0 ? (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select at least one team to see the ranking...
      </div>
    ) : (
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-x-auto">
      <table className="border-separate w-full" style={{ borderSpacing: '1px 2px' }}>
        <thead className="bg-[#0f1115]">
          {/* Group header row */}
          <tr>
            <th
              className="sticky left-0 z-10 bg-[#0f1115] border-b border-gray-800 w-8 text-center align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500"
              rowSpan={2}
            >
              #
            </th>
            <th
              className="sticky left-8 z-10 bg-[#0f1115] border-b border-r border-gray-800 px-5 text-left align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap"
              style={{ width: '1%' }}
              rowSpan={2}
            >
              Team
            </th>
            {showOverall && (
              <th
                colSpan={firstGroupCount}
                className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-gray-700"
              >
                Overall
              </th>
            )}
            {showFirst3 && (
              <th
                colSpan={secondGroupCount}
                className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-l-2 border-gray-700"
              >
                {separatorLabel}
              </th>
            )}
            {visibleEcoCats.map(c => (
              <th
                key={c.key}
                colSpan={ECO_VS.length}
                className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-l-2 border-gray-700"
              >
                {c.label} <span className="text-gray-600 normal-case">{c.range}</span>
              </th>
            ))}
          </tr>
          {/* Metric label row — rotated vertical text, clickable */}
          <tr>
            {metricDefs.map((m, mi) => {
              if (hiddenGroups.has(metricGroupId(mi))) return null;
              const isFirstOfGroup = afterSeparatorLabels.has(m.label) &&
                metricDefs[mi - 1] && !afterSeparatorLabels.has(metricDefs[mi - 1].label) && showOverall;
              const isActive = sortCol === mi;
              return (
                <th
                  key={m.label}
                  onClick={() => handleColClick(mi)}
                  className={`border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] ${isFirstOfGroup ? 'border-l-2 border-l-gray-600' : ''} ${isActive ? 'bg-[#1e2430]' : ''}`}
                  style={{ minWidth: 48 }}
                >
                  <div
                    className="flex flex-col items-center justify-end pb-2 pt-1 gap-1"
                    style={{ height: 64 }}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide text-center leading-tight ${isActive ? 'text-blue-400' : 'text-gray-400'}`}
                      style={{ whiteSpace: 'pre' }}
                    >
                      {(() => {
                        const w = m.label.split(' ');
                        if (m.label === 'Bonus Conversion (PAB)') return 'Bonus\nConversion\n(PAB)';
                        if (w.length === 2) return w.join('\n');
                        if (w.length === 3 || w.length === 4) return `${w[0]} ${w[1]}\n${w.slice(2).join(' ')}`;
                        if (w.length >= 5) return `${w[0]} ${w[1]}\n${w[2]}\n${w.slice(3).join(' ')}`;
                        return m.label;
                      })()}
                    </span>
                    <span
                      className={`text-[9px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}
                    >
                      {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
              );
            })}
            {visibleEcoCats.map(c => ECO_VS.map((v, vi) => {
              const colKey = ecoColKey(c.key, v.key);
              const isActive = sortCol === colKey;
              const isFirstOfGroup = vi === 0;
              const w = v.label.split(' ');
              return (
                <th
                  key={colKey}
                  onClick={() => handleColClick(colKey)}
                  className={`border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] ${isFirstOfGroup ? 'border-l-2 border-l-gray-600' : ''} ${isActive ? 'bg-[#1e2430]' : ''}`}
                  style={{ minWidth: 48 }}
                >
                  <div className="flex flex-col items-center justify-end pb-2 pt-1 gap-1" style={{ height: 64 }}>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide text-center leading-tight ${isActive ? 'text-blue-400' : 'text-gray-400'}`}
                      style={{ whiteSpace: 'pre' }}
                    >
                      {`${w[0]}\n${w.slice(1).join(' ')}`}
                    </span>
                    <span className={`text-[9px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                      {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
              );
            }))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, rank) => (
            <tr key={team} className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
              <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 text-center py-3 text-[11px] font-bold text-gray-600">
                {rank + 1}
              </td>
              <td className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap" style={{ width: '1%' }}>
                <div className="flex items-center gap-2">
                  {teamLogos[team] && (
                    <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />
                  )}
                  {team}
                </div>
              </td>
              {metricDefs.map((m, mi) => {
                if (hiddenGroups.has(metricGroupId(mi))) return null;
                const val = m.getValue(rankings[team]);
                const color = getCellColor(val, metricAllValues[mi], m.lowerIsBetter ?? false);
                const isFirstOfGroup = afterSeparatorLabels.has(m.label) &&
                  metricDefs[mi - 1] && !afterSeparatorLabels.has(metricDefs[mi - 1].label) && showOverall;
                const isActive = sortCol === mi;
                return (
                  <td
                    key={m.label}
                    className={`py-3 text-center ${isActive ? 'bg-[#1e2430]' : 'bg-[#1a1d23]'} ${isFirstOfGroup ? 'border-l-2 border-l-gray-700' : ''}`}
                    style={{ minWidth: 48 }}
                  >
                    <span className={`text-[16px] ${color}`}>
                      {val !== null
                        ? m.countOnly ? val : `${val}%`
                        : <span className="text-gray-700">—</span>}
                    </span>
                    {showDetail && val !== null && m.getWL && (() => {
                      const { wins, total } = m.getWL(rankings[team]);
                      return total > 0 ? (
                        <div className="text-[11px] text-gray-600 whitespace-nowrap">
                          {wins}W-{total - wins}L
                        </div>
                      ) : null;
                    })()}
                  </td>
                );
              })}
              {visibleEcoCats.map(c => ECO_VS.map((v, vi) => {
                const colKey = ecoColKey(c.key, v.key);
                const mu = ecoMatchup(economy, team, c.key, v.key);
                const val = ecoValue(mu);
                const color = getCellColor(val, ecoAllValues[colKey], false);
                const isFirstOfGroup = vi === 0;
                const isActive = sortCol === colKey;
                return (
                  <td
                    key={colKey}
                    className={`py-3 text-center ${isActive ? 'bg-[#1e2430]' : 'bg-[#1a1d23]'} ${isFirstOfGroup ? 'border-l-2 border-l-gray-700' : ''}`}
                    style={{ minWidth: 48 }}
                  >
                    <span className={`text-[16px] ${color}`}>
                      {val !== null ? `${val}%` : <span className="text-gray-700">—</span>}
                    </span>
                    {showDetail && mu && mu.played > 0 && (
                      <div className="text-[11px] text-gray-600 whitespace-nowrap">
                        {mu.wins}W-{mu.played - mu.wins}L
                      </div>
                    )}
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    )}
    </div>
  );
}
