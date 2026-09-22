'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { SeriesOutcomeStats, SeriesOutcomesData, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { Tooltip } from '../Tooltip';
import { KPICard } from '../KPICard';
import { useUrlSet } from '@/hooks/useUrlSet';

interface Props {
  data: SeriesOutcomesData;
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
}

// color: dominant color of each logo in public/region (same as Post Pistol Force)
const REGION_ROWS: { id: string; label: string; color: string }[] = [
  { id: 'reg_0', label: 'Americas', color: '#FF570C' },
  { id: 'reg_1', label: 'EMEA', color: '#D5FF1D' },
  { id: 'reg_2', label: 'China', color: '#E73056' },
  { id: 'reg_3', label: 'Pacific', color: '#01D2D7' },
];

type SortCol = 'series' | 'wr' | 'wrA' | 'wrB' | 'sweeps' | 'afterLoss' | 'comeback' | 'closer' | 'otMaps' | 'otWr';

// sub: the header's second line. Always rendered (invisible when absent) so every
// header keeps the same height and the columns never resize.
// The 2-1 columns name the score after map 1: `from 0-1` lost it, `from 1-0` won it.
const COLUMNS: { key: SortCol; label: string; sub?: string; subTone?: string; width: string }[] = [
  { key: 'series',    label: 'Series',    width: 'w-[70px]' },
  { key: 'wr',        label: 'Series WR', width: 'w-[115px]' },
  { key: 'wrA',       label: 'WR as A',   width: 'w-[115px]' },
  { key: 'wrB',       label: 'WR as B',   width: 'w-[115px]' },
  { key: 'sweeps',    label: '2-0',       width: 'w-[85px]' },
  { key: 'afterLoss', label: 'After losing', sub: 'a map',     width: 'w-[130px]' },
  { key: 'comeback',  label: '2-1',         sub: 'from 0-1',   width: 'w-[115px]' },
  { key: 'closer',    label: '2-1',         sub: 'from 1-0',   width: 'w-[115px]' },
  { key: 'otMaps',    label: 'OT maps',     sub: 'All formats', subTone: 'text-cyan-300/70', width: 'w-[95px]' },
  { key: 'otWr',      label: 'OT WR',       sub: 'All formats', subTone: 'text-cyan-300/70', width: 'w-[115px]' },
];

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

function sumStats(list: (SeriesOutcomeStats | undefined)[]): SeriesOutcomeStats {
  const out: SeriesOutcomeStats = {
    series: 0, wins: 0, asA: 0, asAWins: 0, asB: 0, asBWins: 0,
    sweeps: 0, down01: 0, down01Wins: 0, even11: 0, even11Wins: 0,
    maps: 0, otMaps: 0, otWins: 0,
  };
  for (const s of list) {
    if (!s) continue;
    out.series += s.series; out.wins += s.wins;
    out.asA += s.asA; out.asAWins += s.asAWins;
    out.asB += s.asB; out.asBWins += s.asBWins;
    out.sweeps += s.sweeps;
    out.down01 += s.down01; out.down01Wins += s.down01Wins;
    out.even11 += s.even11; out.even11Wins += s.even11Wins;
    out.maps += s.maps; out.otMaps += s.otMaps; out.otWins += s.otWins;
  }
  return out;
}

function colValue(s: SeriesOutcomeStats, col: SortCol): number | null {
  switch (col) {
    case 'series':   return s.series;
    case 'wr':       return pct(s.wins, s.series);
    case 'wrA':      return pct(s.asAWins, s.asA);
    case 'wrB':      return pct(s.asBWins, s.asB);
    case 'sweeps':   return s.sweeps;
    // Dropping a map lands the team in down01 or even11, never in sweeps, so the two
    // together are exactly the series where it lost at least one map.
    case 'afterLoss': return pct(s.down01Wins + s.even11Wins, s.down01 + s.even11);
    case 'comeback': return pct(s.down01Wins, s.down01);
    case 'closer':   return pct(s.even11Wins, s.even11);
    case 'otMaps':   return s.otMaps;
    case 'otWr':     return pct(s.otWins, s.otMaps);
  }
}

// WR cell: % colored against 50, raw W-L in the title so the % is never read without its sample
function wrCell(wins: number, total: number) {
  const v = pct(wins, total);
  if (v === null) return <span className="text-gray-700">—</span>;
  const tone = v > 50 ? 'text-green-300' : v < 50 ? 'text-red-300' : 'text-gray-200';
  return (
    <span className={`font-bold ${tone}`} title={`${wins}W-${total - wins}L`}>
      {v}% <span className="font-normal text-gray-500 text-[11px]">{wins}-{total - wins}</span>
    </span>
  );
}

function StatCells({ s }: { s: SeriesOutcomeStats }) {
  const sweepPct = pct(s.sweeps, s.series);
  const otPct = pct(s.otMaps, s.maps);
  return (
    <>
      <td className="py-2.5 px-2 text-center text-sm text-gray-300">{s.series}</td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.wins, s.series)}</td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.asAWins, s.asA)}</td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.asBWins, s.asB)}</td>
      <td className="py-2.5 px-2 text-center text-sm font-bold text-amber-300" title={`${s.sweeps} of ${s.series} series`}>
        {s.sweeps}
        {sweepPct !== null && <span className="font-normal text-gray-500 text-[11px]"> {sweepPct}%</span>}
      </td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.down01Wins + s.even11Wins, s.down01 + s.even11)}</td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.down01Wins, s.down01)}</td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.even11Wins, s.even11)}</td>
      <td className="py-2.5 px-2 text-center text-sm font-bold text-cyan-300" title={`${s.otMaps} of ${s.maps} maps`}>
        {s.otMaps}
        {otPct !== null && <span className="font-normal text-gray-500 text-[11px]"> {otPct}%</span>}
      </td>
      <td className="py-2.5 px-2 text-center text-sm">{wrCell(s.otWins, s.otMaps)}</td>
    </>
  );
}

const LEGEND = (
  <dl className="w-[340px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
    <div>
      <dt className="font-bold text-gray-100">Scope</dt>
      <dd className="text-gray-400">
        <b>Series</b> through <b>2-1 from 1-0</b> are <b>Bo3 only</b> — that partition is exact only in a
        Bo3. The two <b>OT</b> columns are per map and cover <b>every format</b>, Bo5 finals included.
        The Bo filter does not apply here.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Team A / Team B</dt>
      <dd className="text-gray-400">
        Team A is the side that <b>opens the veto</b> and picks first; team B is the other one. Veto
        order, not seeding.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">2-0</dt>
      <dd className="text-gray-400">Series won without dropping a map, and what share of the series played that is.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">After losing a map</dt>
      <dd className="text-gray-400">
        Of the series where the team <b>dropped at least one map</b>, how often it still won. The two
        columns to its right are this same number split by <b>which</b> map it lost.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">2-1 from 0-1</dt>
      <dd className="text-gray-400">The team <b>lost map 1</b>: how often it still won the series. The comeback rate.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">2-1 from 1-0</dt>
      <dd className="text-gray-400">The team <b>won map 1 and lost map 2</b>: how often it still won the series.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Overtime</dt>
      <dd className="text-gray-400">
        A map that played <b>more than 24 rounds</b>. An OT map counts for both teams; OT WR only for
        the one that won it. Counted over <b>all formats</b>, so the map total is wider than the Bo3
        series above.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">All and region rows</dt>
      <dd className="text-gray-400">Raw sum of the selected teams. They change as you toggle chips.</dd>
    </div>
  </dl>
);

export function SeriesOutcomesSection({ data, teamLogos = {}, teamRegions = {} }: Props) {
  const { navigate } = useNavigation();
  const [sortCol, setSortCol] = useState<SortCol>('wr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allTeams = Object.keys(data.teams).sort();
  const [selectedTeams, setSelectedTeams] = useUrlSet('teams', allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t)));
  const baseTeams = allTeams.filter(t => selectedTeams.has(t));
  const allTeamsSelected = baseTeams.length === allTeams.length;

  if (allTeams.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region and tournament to see the data...
      </div>
    );
  }

  const teamStat = (team: string) => data.teams[team] ?? sumStats([]);

  function toggleTeam(team: string) {
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

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

  function resetFilters() {
    setSelectedTeams(new Set(allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setSortCol('wr');
    setSortDir('desc');
    navigate('?section=series-outcomes');
  }

  function handleColClick(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const teams = [...baseTeams].sort((a, b) => {
    const va = colValue(teamStat(a), sortCol);
    const vb = colValue(teamStat(b), sortCol);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return sortDir === 'asc' ? va - vb : vb - va;
  });

  const knownRegions = new Set(REGION_ROWS.map(r => r.id));
  const chipRows: { label: string; logo: string | null; teams: string[] }[] = REGION_ROWS.map(r => ({
    label: r.label,
    logo: `/region/${r.label.toLowerCase()}.png`,
    teams: allTeams.filter(t => teamRegions[t] === r.id),
  }));
  const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
  if (otherTeams.length > 0) chipRows.push({ label: 'Other', logo: null, teams: otherTeams });

  // Circuit-wide, counted per series (not by summing teams), so it ignores the chips
  const g = data.global;
  const kpiPct = (n: number, d: number) => { const v = pct(n, d); return v === null ? '—' : `${v}%`; };

  return (
    <div className="flex flex-col gap-4">

      {/* Circuit-wide KPIs — every Bo3 series in the selection, independent of the team chips */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard title="Bo3 series" label="in the selection" value={`${g.series}`} />
        <KPICard
          title="Team A wins"
          label={`${g.teamAWins} of ${g.series}`}
          value={kpiPct(g.teamAWins, g.series)}
          variant={g.teamAWins * 2 > g.series ? 'success' : 'danger'}
        />
        <KPICard title="2-0" label={`${g.sweeps} series`} value={kpiPct(g.sweeps, g.series)} />
        <KPICard title="2-1 from 0-1" label={`${g.comebacks} · winner lost map 1`} value={kpiPct(g.comebacks, g.series)} />
        <KPICard title="2-1 from 1-0" label={`${g.closers} · winner lost map 2`} value={kpiPct(g.closers, g.series)} />
        <KPICard title="Overtime maps" label={`${g.otMaps} of ${g.maps} · all formats`} value={kpiPct(g.otMaps, g.maps)} />
      </div>

      {/* Teams by region */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>
          <button
            onClick={() => setSelectedTeams(allTeamsSelected ? new Set() : new Set(allTeams))}
            className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
          >
            {allTeamsSelected ? 'Clear' : 'Add all'}
          </button>
          <Tooltip content={LEGEND} className="items-center">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-200 hover:text-white transition-colors cursor-help">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Legend
            </span>
          </Tooltip>
          <button
            onClick={resetFilters}
            className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
          >
            Reset filters
          </button>
          <span className="text-[10px] text-gray-600">
            Click a region logo to add / remove all teams from that region
          </span>
        </div>
        <div className="flex flex-col gap-2 px-1">
          {chipRows.filter(row => row.teams.length > 0).map(row => {
            const anyVisible = row.teams.some(t => selectedTeams.has(t));
            return (
              <div key={row.label} className="flex items-center gap-3">
                <button
                  onClick={() => toggleRegionTeams(row.teams)}
                  title={`${row.label} — select / clear the whole region`}
                  className={`w-12 shrink-0 flex items-center justify-start text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-100 ${
                    anyVisible ? 'text-gray-400' : 'text-gray-600 opacity-50'
                  }`}
                >
                  {row.logo
                    ? <img src={row.logo} alt={row.label} className={`w-[30px] h-[30px] object-contain shrink-0 transition-all ${anyVisible ? '' : 'grayscale'}`} />
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
      </div>

      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-x-auto">
        <table className="w-full min-w-[1230px] table-fixed border-collapse">
          <thead className="bg-[#0f1115]">
            <tr>
              <th className="w-8 text-center py-2 border-b border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500">#</th>
              <th className="w-[130px] px-3 py-2 text-left border-b border-r border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">Team</th>
              {COLUMNS.map(c => {
                const isActive = sortCol === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={() => handleColClick(c.key)}
                    className={`${c.width} px-2 py-2 border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] ${isActive ? 'bg-[#1e2430]' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        {c.label}
                      </span>
                      <span className={`text-[9px] ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                      </span>
                    </div>
                    <div className={`text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${c.subTone ?? 'text-gray-500'} ${c.sub ? '' : 'invisible'}`}>
                      {c.sub ?? ' '}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Aggregate rows: All + one per region, raw sums of the selected teams, outside the sort */}
            <tr className="border-b border-gray-800">
              <td className="w-8" />
              <td className="px-3 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-100 border-r border-gray-800 whitespace-nowrap">All</td>
              <StatCells s={sumStats(baseTeams.map(teamStat))} />
            </tr>
            {REGION_ROWS.map(r => {
              const regTeams = baseTeams.filter(t => teamRegions[t] === r.id);
              if (regTeams.length === 0) return null;
              return (
                <tr key={r.id} className="border-b border-gray-800">
                  <td className="w-8" />
                  <td className="px-3 py-2.5 text-[11px] font-black uppercase tracking-widest border-r border-gray-800 whitespace-nowrap" style={{ color: r.color }}>
                    <div className="flex items-center gap-2">
                      <img src={`/region/${r.label.toLowerCase()}.png`} alt={r.label} className="w-4 h-4 object-contain shrink-0" />
                      {r.label}
                    </div>
                  </td>
                  <StatCells s={sumStats(regTeams.map(teamStat))} />
                </tr>
              );
            })}
            <tr><td colSpan={2 + COLUMNS.length} className="h-1 bg-gray-700" /></tr>
            {teams.map((team, rank) => (
              <tr key={team} className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
                <td className="w-8 text-center py-2.5 text-[11px] font-bold text-gray-600">{rank + 1}</td>
                <td className="px-3 py-2.5 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {teamLogos[team] && <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />}
                    {team}
                  </div>
                </td>
                <StatCells s={teamStat(team)} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
