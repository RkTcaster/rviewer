'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, LabelList } from 'recharts';
import { PostPistolForceStat, STATS_RANK_DEFAULT_TEAMS, TeamPostPistolForce } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { Tooltip } from '../Tooltip';
import { useUrlSet } from '@/hooks/useUrlSet';

interface Props {
  stats: Record<string, TeamPostPistolForce>;
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
}

// color: dominant color of each logo in public/region (same as the Neon + Phoenix region chart)
const REGION_ROWS: { id: string; label: string; color: string }[] = [
  { id: 'reg_0', label: 'Americas', color: '#FF570C' },
  { id: 'reg_1', label: 'EMEA', color: '#D5FF1D' },
  { id: 'reg_2', label: 'China', color: '#E73056' },
  { id: 'reg_3', label: 'Pacific', color: '#01D2D7' },
];

type Half = 'both' | 'r2' | 'r14';
type SortCol = 'losses' | 'forced' | 'forcePct' | 'forceWr' | 'ecoWr' | 'postEcoWr';

const HALF_OPTIONS = [['both', 'R2 + R14'], ['r2', 'R2'], ['r14', 'R14']] as const;

// halfTag: the header names the selected half chip, e.g. "Force % (R2)"
const COLUMNS: { key: SortCol; label: string; halfTag?: boolean }[] = [
  { key: 'losses',   label: 'Pistols lost' },
  { key: 'forced',   label: 'Forces' },
  { key: 'forcePct', label: 'Force %',  halfTag: true },
  { key: 'forceWr',  label: 'Force WR', halfTag: true },
  { key: 'ecoWr',    label: 'Eco WR',   halfTag: true },
  { key: 'postEcoWr', label: 'Post Eco WR', halfTag: true },
];

function pct(n: number, d: number): number | null {
  return d > 0 ? Math.round((n / d) * 100) : null;
}

function sumStats(list: (PostPistolForceStat | undefined)[]): PostPistolForceStat {
  const out = { losses: 0, forced: 0, forcedWins: 0, ecoWins: 0, postEcoTotal: 0, postEcoWins: 0 };
  for (const s of list) {
    if (!s) continue;
    out.losses += s.losses; out.forced += s.forced; out.forcedWins += s.forcedWins; out.ecoWins += s.ecoWins;
    out.postEcoTotal += s.postEcoTotal; out.postEcoWins += s.postEcoWins;
  }
  return out;
}

function colValue(s: PostPistolForceStat, col: SortCol): number | null {
  switch (col) {
    case 'losses':   return s.losses;
    case 'forced':   return s.forced;
    case 'forcePct': return pct(s.forced, s.losses);
    case 'forceWr':  return pct(s.forcedWins, s.forced);
    case 'ecoWr':    return pct(s.ecoWins, s.losses - s.forced);
    case 'postEcoWr': return pct(s.postEcoWins, s.postEcoTotal);
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

function StatCells({ s }: { s: PostPistolForceStat }) {
  const forcePct = pct(s.forced, s.losses);
  return (
    <>
      <td className="py-2.5 px-3 text-center text-sm text-gray-300">{s.losses}</td>
      <td className="py-2.5 px-3 text-center text-sm text-gray-300">{s.forced}</td>
      <td className="py-2.5 px-3 text-center text-sm font-bold text-amber-300">{forcePct === null ? <span className="text-gray-700">—</span> : `${forcePct}%`}</td>
      <td className="py-2.5 px-3 text-center text-sm">{wrCell(s.forcedWins, s.forced)}</td>
      <td className="py-2.5 px-3 text-center text-sm">{wrCell(s.ecoWins, s.losses - s.forced)}</td>
      <td className="py-2.5 px-3 text-center text-sm">{wrCell(s.postEcoWins, s.postEcoTotal)}</td>
    </>
  );
}

const LEGEND = (
  <dl className="w-[340px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
    <div>
      <dt className="font-bold text-gray-100">Force</dt>
      <dd className="text-gray-400">
        The team lost the pistol (R1 / R13) and in the next round (R2 / R14) spent <b>more than 10000</b> or
        was left with <b>less than 1000</b> in the bank. Otherwise it counts as eco.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Force %</dt>
      <dd className="text-gray-400">Forces over pistols lost.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Force WR / Eco WR</dt>
      <dd className="text-gray-400">Win rate of the R2 / R14 itself when forcing / not forcing. Hover for the W-L.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Post Eco WR</dt>
      <dd className="text-gray-400">After a non-forced R2 / R14, how often the team won the next round (R3 / R15).</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Post Plant</dt>
      <dd className="text-gray-400">
        Combines with R2 + R14 / R2 / R14: only pistols the team lost by defuse, i.e. it attacked and planted.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">All and region rows</dt>
      <dd className="text-gray-400">Raw sum of the selected teams. They change as you toggle chips.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Coverage</dt>
      <dd className="text-gray-400">Maps without economy data are not counted.</dd>
    </div>
  </dl>
);

const FORCE_RATE_COLOR = '#f59e0b';
const FORCE_WR_COLOR = '#22c55e';

type ChartRow = { group: string; s: PostPistolForceStat; forceRate: number | null; forceWr: number | null };

// Both bars of a group with their raw sample: forces / pistols lost and forced rounds won / forces
function ChartTooltipContent({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload?.length) return null;
  const { group, s, forceRate, forceWr } = payload[0].payload;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{group}</p>
      <p style={{ color: FORCE_RATE_COLOR }}>Force rate: <span className="font-bold">{forceRate === null ? '—' : `${forceRate}%`}</span> <span className="text-gray-400">{s.forced}/{s.losses}</span></p>
      <p style={{ color: FORCE_WR_COLOR }}>Force round WR: <span className="font-bold">{forceWr === null ? '—' : `${forceWr}%`}</span> <span className="text-gray-400">{s.forcedWins}/{s.forced}</span></p>
    </div>
  );
}

export function PostPistolForceSection({ stats, teamLogos = {}, teamRegions = {} }: Props) {
  const { navigate } = useNavigation();
  const [half, setHalf] = useState<Half>('both');
  const [postPlant, setPostPlant] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('forcePct');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allTeams = Object.keys(stats).sort();
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

  // pp: only pistols lost by defuse (Post Plant modifier)
  const statFor = (team: string, h: Half, pp: boolean): PostPistolForceStat => {
    const t = stats[team];
    if (!t) return sumStats([]);
    const r2 = pp ? t.r2PostPlant : t.r2;
    const r14 = pp ? t.r14PostPlant : t.r14;
    return h === 'both' ? sumStats([r2, r14]) : h === 'r2' ? r2 : r14;
  };
  const teamStat = (team: string) => statFor(team, half, postPlant);
  const halfLabel = `${HALF_OPTIONS.find(([k]) => k === half)![1]}${postPlant ? ', Post Plant' : ''}`;

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
    setHalf('both');
    setPostPlant(false);
    setSortCol('forcePct');
    setSortDir('desc');
    navigate('?section=post-pistol-force');
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

  // Chart: raw sum of the selected teams — Overall, R2, R14 and Post Plant (both halves)
  const chartGroups: [string, Half, boolean][] = [['Overall', 'both', false], ['R2', 'r2', false], ['R14', 'r14', false], ['Post Plant', 'both', true]];
  const chartData: ChartRow[] = chartGroups.map(([group, h, pp]) => {
    const s = sumStats(baseTeams.map(t => statFor(t, h, pp)));
    return { group, s, forceRate: pct(s.forced, s.losses), forceWr: pct(s.forcedWins, s.forced) };
  });

  const pillClass = (active: boolean) => `px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
    active
      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
  }`;

  return (
    <div className="flex flex-col gap-4">

      {/* Teams por región */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>
          <button
            onClick={() => setSelectedTeams(allTeamsSelected ? new Set() : new Set(allTeams))}
            className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
          >
            {allTeamsSelected ? 'Clear' : 'Add all'}
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

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-start gap-2 px-1">
        {HALF_OPTIONS.map(([key, label]) => (
          <button key={key} onClick={() => setHalf(key)} className={pillClass(half === key)}>{label}</button>
        ))}
        <button onClick={() => setPostPlant(p => !p)} className={pillClass(postPlant)} title="Only pistols lost by defuse (the team attacked and planted)">
          Post Plant
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
      </div>

      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-[#0f1115]">
            <tr>
              <th className="w-8 text-center py-2 border-b border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500">#</th>
              <th className="px-5 py-2 text-left border-b border-r border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">Team</th>
              {COLUMNS.map(c => {
                const isActive = sortCol === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={() => handleColClick(c.key)}
                    className={`px-3 py-2 border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] ${isActive ? 'bg-[#1e2430]' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        {c.halfTag ? `${c.label} (${halfLabel})` : c.label}
                      </span>
                      <span className={`text-[9px] ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                      </span>
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
              <td className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-gray-100 border-r border-gray-800 whitespace-nowrap">All</td>
              <StatCells s={sumStats(baseTeams.map(teamStat))} />
            </tr>
            {REGION_ROWS.map(r => {
              const regTeams = baseTeams.filter(t => teamRegions[t] === r.id);
              if (regTeams.length === 0) return null;
              return (
                <tr key={r.id} className="border-b border-gray-800">
                  <td className="w-8" />
                  <td className="px-5 py-2.5 text-[11px] font-black uppercase tracking-widest border-r border-gray-800 whitespace-nowrap" style={{ color: r.color }}>
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
                <td className="px-5 py-2.5 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap">
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

      {/* Force rate and force round WR, raw sum of the selected teams */}
      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 p-4 flex flex-col gap-3 max-w-2xl">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Selected teams</span>
          {([['Force rate', FORCE_RATE_COLOR], ['Force round WR', FORCE_WR_COLOR]] as const).map(([label, color]) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-300">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 0 }} barGap={0} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d3139" />
            <XAxis dataKey="group" stroke="#6b7280" fontSize={11} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="#6b7280" fontSize={10} tickLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            {([['forceRate', FORCE_RATE_COLOR], ['forceWr', FORCE_WR_COLOR]] as const).map(([key, color]) => (
              <Bar key={key} dataKey={key} fill={color} radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false}>
                <LabelList dataKey={key} position="top" fill="#e5e7eb" fontSize={12} fontWeight={700} formatter={(v) => (v == null ? '' : `${v}%`)} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="px-1 text-[11px] leading-snug text-gray-400">
          {baseTeams.length === 0
            ? 'No teams selected.'
            : <>Evaluating {baseTeams.length} {baseTeams.length === 1 ? 'team' : 'teams'}: <span className="font-bold text-gray-200">{baseTeams.join(', ')}</span></>}
        </p>
      </div>
    </div>
  );
}
