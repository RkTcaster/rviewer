'use client';

import { useState } from 'react';
import { TeamRankStats } from '@/lib/types';

interface Props {
  rankings: Record<string, TeamRankStats>;
}

function pct(wins: number, total: number): number | null {
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

type MetricDef = {
  label: string;
  getValue: (s: TeamRankStats) => number | null;
  lowerIsBetter?: boolean;
  countOnly?: boolean;
};
type SeparatorDef = { separator: true; label: string };
type RowDef = MetricDef | SeparatorDef;

const METRICS: RowDef[] = [
  { label: 'Map Winrate',            getValue: s => pct(s.mapWins, s.mapPlayed) },
  { label: 'Round Winrate',          getValue: s => pct(s.attWins + s.defWins, s.attTotal + s.defTotal) },
  { label: 'Atk Side Winrate',       getValue: s => pct(s.attWins, s.attTotal) },
  { label: 'Plant Rate ATK',         getValue: s => pct(s.postPlantPl, s.attTotal) },
  { label: 'Post Plant WR',          getValue: s => s.postPlantPl > 0 ? pct(s.postPlantPl - s.postPlantDe, s.postPlantPl) : null },
  { label: 'Def Side Winrate',       getValue: s => pct(s.defWins, s.defTotal) },
  { label: 'Plant Rate DEF',         getValue: s => pct(s.retakePl, s.defTotal), lowerIsBetter: true },
  { label: 'Retake Eff',             getValue: s => pct(s.retakeDe, s.retakePl) },
  { separator: true, label: 'First 3 rounds performance' },
  { label: 'Pistol Winrate',         getValue: s => pct(s.pistolWins, s.pistolTotal) },
  { label: 'Post Pistol Into Win',   getValue: s => pct(s.antiEcoWins, s.antiEcoTotal) },
  { label: 'Bonus Conversion (PAB)', getValue: s => pct(s.pabWins, s.pabTotal) },
  { label: 'PAB Atk',               getValue: s => pct(s.pabAtkWins, s.pabAtkTotal) },
  { label: 'PAB Def',               getValue: s => pct(s.pabDefWins, s.pabDefTotal) },
  { label: 'Lost R1 + R2 + R3',    getValue: s => pct(s.first3Lost, s.first3Total), lowerIsBetter: true },
  { label: 'Timeout Losses',         getValue: s => s.timeoutLosses, lowerIsBetter: true, countOnly: true },
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

export function StatsRankSection({ rankings }: Props) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allTeams = Object.keys(rankings).sort();
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(new Set());

  const baseTeams = allTeams.filter(t => !hiddenTeams.has(t));

  function toggleTeam(team: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  if (baseTeams.length === 0) {
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

  // Pre-compute per-metric values for all teams (for coloring, always uses base alphabetical order)
  const metricAllValues = metricDefs.map(m => baseTeams.map(t => m.getValue(rankings[t])));

  // Sort teams by selected column
  const teams = sortCol === null
    ? baseTeams
    : [...baseTeams].sort((a, b) => {
        const valA = metricDefs[sortCol].getValue(rankings[a]);
        const valB = metricDefs[sortCol].getValue(rankings[b]);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      });

  function handleColClick(mi: number) {
    if (sortCol === mi) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(mi);
      setSortDir('desc');
    }
  }

  return (
    <div className="flex flex-col gap-4">

    {/* Team filter chips */}
    <div className="flex flex-wrap gap-2 px-1">
      {allTeams.map(team => {
        const active = !hiddenTeams.has(team);
        return (
          <button
            key={team}
            onClick={() => toggleTeam(team)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
              active
                ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400 line-through'
            }`}
          >
            {team}
          </button>
        );
      })}
    </div>

    <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-x-auto">
      <table className="border-collapse">
        <thead className="bg-[#0f1115]">
          {/* Group header row */}
          <tr>
            <th className="sticky left-0 z-10 bg-[#0f1115] border-b border-gray-800 w-8" rowSpan={2} />
            <th className="sticky left-8 z-10 bg-[#0f1115] border-b border-r border-gray-800" rowSpan={2} />
            <th
              colSpan={firstGroupCount}
              className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-600 border-b border-gray-700"
            />
            <th
              colSpan={secondGroupCount}
              className="px-3 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-gray-500 border-b border-l-2 border-gray-700"
            >
              {separatorLabel}
            </th>
          </tr>
          {/* Metric label row — rotated vertical text, clickable */}
          <tr>
            {metricDefs.map((m, mi) => {
              const isFirstOfGroup = afterSeparatorLabels.has(m.label) &&
                metricDefs[mi - 1] && !afterSeparatorLabels.has(metricDefs[mi - 1].label);
              const isActive = sortCol === mi;
              return (
                <th
                  key={m.label}
                  onClick={() => handleColClick(mi)}
                  className={`border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] ${isFirstOfGroup ? 'border-l-2 border-l-gray-600' : ''} ${isActive ? 'bg-[#1e2430]' : ''}`}
                  style={{ width: 48, minWidth: 48 }}
                >
                  <div
                    className="flex items-end justify-center pb-2 pt-1 gap-1"
                    style={{ height: 120 }}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${isActive ? 'text-blue-400' : 'text-gray-400'}`}
                      style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`text-[9px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}
                      style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                    >
                      {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, rank) => (
            <tr key={team} className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
              <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 text-center py-3 text-[11px] font-bold text-gray-600">
                {rank + 1}
              </td>
              <td className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap">
                {team}
              </td>
              {metricDefs.map((m, mi) => {
                const val = m.getValue(rankings[team]);
                const color = getCellColor(val, metricAllValues[mi], m.lowerIsBetter ?? false);
                const isFirstOfGroup = afterSeparatorLabels.has(m.label) &&
                  metricDefs[mi - 1] && !afterSeparatorLabels.has(metricDefs[mi - 1].label);
                const isActive = sortCol === mi;
                return (
                  <td
                    key={m.label}
                    className={`py-3 text-center ${isActive ? 'bg-[#1e2430]' : 'bg-[#1a1d23]'} ${isFirstOfGroup ? 'border-l-2 border-l-gray-700' : ''}`}
                    style={{ width: 48 }}
                  >
                    <span className={`text-sm ${color}`}>
                      {val !== null
                        ? m.countOnly ? val : `${val}%`
                        : <span className="text-gray-700">—</span>}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}
