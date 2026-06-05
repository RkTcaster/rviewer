'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AgentPickStat, CompositionStat, OverallMapFullStat } from '@/lib/types';
import { KPICard } from '@/components/KPICard';

interface Props {
  stats: AgentPickStat[];
  compositions: CompositionStat[];
  mapImages: Record<string, string>;
  agentImages: Record<string, string>;
  mapFullStats: Record<string, OverallMapFullStat>;
}

function AgentYTick({ x, y, payload, agentImages }: any) {
  const src = agentImages?.[payload.value];
  return (
    <g transform={`translate(${x},${y})`}>
      {src
        ? <image x={-28} y={-12} width={24} height={24} href={src} />
        : <text x={-4} y={4} textAnchor="end" fill="#9ca3af" fontSize={12}>{payload.value}</text>
      }
    </g>
  );
}

function CompositionIcons({ composition, agentImages }: { composition: string; agentImages: Record<string, string> }) {
  const agents = composition.split(', ');
  const allHaveIcons = agents.every(a => agentImages[a]);
  if (allHaveIcons) {
    return (
      <div className="flex gap-0.5 flex-wrap">
        {agents.map((agent, i) => (
          <img key={i} src={agentImages[agent]} alt={agent} title={agent} className="w-[25px] h-[25px] rounded" />
        ))}
      </div>
    );
  }
  return <span className="text-gray-300 text-xs leading-snug">{composition}</span>;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as AgentPickStat & { nmwr?: number };
  const played = d.nonMirrorPlayed ?? 0;
  const wins = d.nonMirrorWins ?? 0;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.agent}</p>
      <p className="text-green-400">Pick Rate: <span className="font-bold">{d.pickRate}%</span></p>
      {d.nmwr !== undefined && (
        <p className="text-amber-400">NMWR: <span className="font-bold">{d.nmwr}%</span> <span className="text-gray-400">({wins}-{played - wins})</span></p>
      )}
      <p className="text-blue-400">Times Picked: <span className="font-bold">{d.timesPlayed}</span></p>
    </div>
  );
}

export function AgentPicksSection({ stats, compositions, mapImages, agentImages, mapFullStats }: Props) {
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'pickRate' | 'nmwr'>('pickRate');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const clickSort = (key: 'pickRate' | 'nmwr') => {
    if (sortBy === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const maps = useMemo(() => [...new Set(stats.map(s => s.map))].sort(), [stats]);

  const isAll = selectedMaps.size === 0;
  const single = selectedMaps.size === 1 ? [...selectedMaps][0] : null;
  const inScope = (map: string) => isAll || selectedMaps.has(map);

  const toggleMap = (map: string) =>
    setSelectedMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });

  const filtered = useMemo(() => {
    const nmwr = (wins?: number, played?: number) =>
      played && played > 0 ? Math.round((wins ?? 0) / played * 100) : undefined;

    const dir = sortDir === 'desc' ? 1 : -1;
    const cmp = (a: { pickRate: number; nmwr?: number }, b: { pickRate: number; nmwr?: number }) => {
      if (sortBy === 'nmwr') {
        const an = a.nmwr, bn = b.nmwr;
        if (an === undefined && bn === undefined) return b.pickRate - a.pickRate;
        if (an === undefined) return 1;   // no-data siempre al final
        if (bn === undefined) return -1;
        return an !== bn ? (bn - an) * dir : b.pickRate - a.pickRate;
      }
      return (b.pickRate - a.pickRate) * dir;
    };

    if (single) {
      const mapFiltered = stats
        .filter(s => s.map === single)
        .map(s => ({ ...s, nmwr: nmwr(s.nonMirrorWins, s.nonMirrorPlayed) }));
      const existingAgents = new Set(mapFiltered.map(s => s.agent));
      const totalMaps = mapFiltered[0]?.totalMaps ?? 0;
      for (const agent of Object.keys(agentImages)) {
        if (!existingAgents.has(agent)) {
          mapFiltered.push({ agent, map: single, timesPlayed: 0, pickRate: 0, totalMaps, nonMirrorPlayed: 0, nonMirrorWins: 0, nmwr: undefined });
        }
      }
      return mapFiltered.sort(cmp);
    }

    const scope = stats.filter(s => inScope(s.map));
    const mapTotals: Record<string, number> = {};
    for (const s of scope) {
      if (!(s.map in mapTotals)) mapTotals[s.map] = s.totalMaps;
    }
    const totalDenominator = Object.values(mapTotals).reduce((a, b) => a + b, 0) * 2;

    const byAgent: Record<string, { timesPlayed: number; nonMirrorPlayed: number; nonMirrorWins: number }> = {};
    for (const s of scope) {
      if (!byAgent[s.agent]) byAgent[s.agent] = { timesPlayed: 0, nonMirrorPlayed: 0, nonMirrorWins: 0 };
      byAgent[s.agent].timesPlayed += s.timesPlayed;
      byAgent[s.agent].nonMirrorPlayed += s.nonMirrorPlayed ?? 0;
      byAgent[s.agent].nonMirrorWins += s.nonMirrorWins ?? 0;
    }
    for (const agent of Object.keys(agentImages)) {
      if (!byAgent[agent]) byAgent[agent] = { timesPlayed: 0, nonMirrorPlayed: 0, nonMirrorWins: 0 };
    }

    return Object.entries(byAgent)
      .map(([agent, { timesPlayed, nonMirrorPlayed, nonMirrorWins }]) => ({
        agent,
        map: '',
        timesPlayed,
        pickRate: totalDenominator > 0 ? Math.round((timesPlayed / totalDenominator) * 100) : 0,
        totalMaps: 0,
        nonMirrorPlayed,
        nonMirrorWins,
        nmwr: nmwr(nonMirrorWins, nonMirrorPlayed),
      }))
      .sort(cmp);
  }, [stats, selectedMaps, agentImages, sortBy, sortDir]);

  const mapCount = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const s of stats) {
      if (inScope(s.map) && !seen.has(s.map)) { seen.add(s.map); total += s.totalMaps; }
    }
    return total;
  }, [stats, selectedMaps]);

  // Compositions panel data
  const compositionPanel = useMemo(() => {
    if (single) {
      return compositions
        .filter(c => c.map === single)
        .sort((a, b) => b.played - a.played);
    }
    // Scoped maps, top 3 each
    const byMap: Record<string, CompositionStat[]> = {};
    for (const c of compositions) {
      if (!inScope(c.map)) continue;
      if (!byMap[c.map]) byMap[c.map] = [];
      byMap[c.map].push(c);
    }
    return Object.entries(byMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([map, comps]) => ({
        map,
        comps: comps.sort((a, b) => b.played - a.played).slice(0, 3),
      }));
  }, [compositions, selectedMaps]);

  const chartHeight = Math.max(300, filtered.length * 36);
  const maxPickRate = Math.max(10, ...filtered.map(d => d.pickRate));
  const xDomain: [number, number] = [0, maxPickRate];

  if (stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region or tournament to see agent pick data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI + Map filter row */}
      <div className="flex items-start gap-6 flex-wrap">
        <KPICard
          title="Maps"
          value={String(mapCount)}
          label={single ?? (isAll ? 'all maps' : `${selectedMaps.size} maps`)}
          variant="neutral"
        />
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Map</label>
          <div className="flex flex-wrap gap-2">
            {[''].concat(maps).map(m => {
              const active = m ? selectedMaps.has(m) : isAll;
              const img = m ? mapImages[m] : undefined;
              return (
                <button
                  key={m || 'all'}
                  onClick={() => m ? toggleMap(m) : setSelectedMaps(new Set())}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {m
                    ? img && <img src={img} alt={m} className={`w-[50px] h-[40px] object-cover rounded shrink-0 transition-opacity ${active ? '' : 'opacity-70'}`} />
                    : <div className="w-[50px] h-[40px] rounded shrink-0 flex items-center justify-center bg-[#252a33] text-gray-400">ALL</div>}
                  <span>{m || 'All'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sort by</label>
          <div className="flex gap-2">
            {([['pickRate', 'Pick Rate'], ['nmwr', 'NMWR']] as const).map(([key, label]) => {
              const active = sortBy === key;
              return (
                <button
                  key={key}
                  onClick={() => clickSort(key)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {label}{active && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-gray-500 self-end pb-2 ml-auto">NMWR = win rate excluding mirror picks</p>
      </div>

      {/* Main 50/50 layout */}
      <div className="flex gap-6 items-start">
        {/* Bar chart — left half */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          <div className="flex">
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={filtered}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 24, bottom: 0 }}
                  onMouseMove={(s: any) => setHoveredIndex(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2d3139" />
                  <XAxis
                    type="number"
                    domain={xDomain}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#6b7280"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="agent"
                    stroke="#9ca3af"
                    tickLine={false}
                    width={32}
                    tick={<AgentYTick agentImages={agentImages} />}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="pickRate" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {filtered.map((entry, i) => (
                      <Cell key={i} fill={entry.pickRate >= 50 ? '#22c55e' : entry.pickRate >= 25 ? '#f59e0b' : entry.pickRate >= 5 ? '#1e3a8a' : '#fca5a5'} />
                    ))}
                    <LabelList dataKey="pickRate" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#9ca3af', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* NMWR column — aligned per agent row (chart uses margin top/bottom: 0) */}
            <div className="w-[90px] shrink-0 flex flex-col" style={{ height: chartHeight, paddingBottom: 30 }}>
              {filtered.map((d, i) => (
                <div key={i} className={`flex-1 flex items-center justify-end text-[11px] font-bold ${i === hoveredIndex ? 'bg-white/[0.04]' : ''}`}>
                  {d.nmwr !== undefined
                    ? <span className={d.nmwr >= 55 ? 'text-green-400' : d.nmwr <= 45 ? 'text-red-400' : 'text-gray-300'}>NMWR {d.nmwr}%</span>
                    : <span className="text-gray-600">—</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compositions panel — right half */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          {(() => {
            // Normalize to grouped format in both cases
            const groups: { map: string; comps: CompositionStat[] }[] = single
              ? [{ map: single, comps: compositionPanel as CompositionStat[] }]
              : compositionPanel as { map: string; comps: CompositionStat[] }[];

            if (groups.length === 0 || groups.every(g => g.comps.length === 0)) {
              return <p className="text-gray-600 text-sm">No data available</p>;
            }

            return (
              <div className="flex flex-col gap-4">
                {groups.map(({ map, comps }) => (
                  <div key={map} className="flex gap-3">
                    {/* Map column */}
                    <div className="flex flex-col items-center gap-1 w-[100px] shrink-0">
                      {mapImages[map] && (
                        <img src={mapImages[map]} alt={map} className="w-[100px] h-[55px] object-cover rounded opacity-80" />
                      )}
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide text-center leading-tight">{map}</span>
                      {/* Stats below map image only when a single map is selected */}
                      {single && mapFullStats[map] && (() => {
                        const s = mapFullStats[map];
                        const atk = s.attTotal > 0 ? Math.round(s.attWins / s.attTotal * 100) : 0;
                        const def = s.defTotal > 0 ? Math.round(s.defWins / s.defTotal * 100) : 0;
                        return (
                          <div className="flex flex-col items-center gap-0.5 w-full mt-1">
                            <span className="text-[11px] font-bold text-green-400">ATK {atk}%</span>
                            <span className="text-[11px] font-bold text-red-400">DEF {def}%</span>
                            <span className="text-[10px] text-gray-400">P {s.picks} · B {s.bans}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Compositions column */}
                    <div className="flex flex-col gap-1.5 justify-center flex-1 min-w-0">
                      {comps.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 flex-wrap">
                          <CompositionIcons composition={c.composition} agentImages={agentImages} />
                          <span className="text-gray-500 text-xs shrink-0">({c.played})</span>
                          {single && c.winRate !== undefined && (
                            <span className={`text-xs font-bold shrink-0 ${c.winRate >= 55 ? 'text-green-400' : c.winRate <= 45 ? 'text-red-400' : 'text-gray-300'}`}>
                              {c.winRate}% WR
                            </span>
                          )}
                          {single && c.teams && c.teams.length > 0 && (
                            <span className="text-[10px] text-gray-400 leading-tight">
                              {c.teams.map((t, j) => (
                                <span key={j}>
                                  {j > 0 && <span className="text-gray-600">, </span>}
                                  {t.team} <span className="text-gray-600">({t.played})</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Stats column (grouped view only) */}
                    {!single && mapFullStats[map] && (() => {
                      const s = mapFullStats[map];
                      const atk = s.attTotal > 0 ? Math.round(s.attWins / s.attTotal * 100) : 0;
                      const def = s.defTotal > 0 ? Math.round(s.defWins / s.defTotal * 100) : 0;
                      return (
                        <div className="flex flex-col justify-center gap-1 shrink-0">
                          <span className="text-[12.5px] font-bold text-green-400">ATK {atk}%</span>
                          <span className="text-[12.5px] font-bold text-red-400">DEF {def}%</span>
                          <span className="text-[12.5px] text-gray-400">Picks {s.picks} · Bans {s.bans}</span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
