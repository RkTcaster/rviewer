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
  const d = payload[0].payload as AgentPickStat;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.agent}</p>
      <p className="text-green-400">Pick Rate: <span className="font-bold">{d.pickRate}%</span></p>
      <p className="text-blue-400">Times Picked: <span className="font-bold">{d.timesPlayed}</span></p>
    </div>
  );
}

export function AgentPicksSection({ stats, compositions, mapImages, agentImages, mapFullStats }: Props) {
  const [selectedMap, setSelectedMap] = useState<string>('');

  const maps = useMemo(() => [...new Set(stats.map(s => s.map))].sort(), [stats]);

  const filtered = useMemo(() => {
    if (selectedMap) {
      const mapFiltered = stats
        .filter(s => s.map === selectedMap)
        .slice()
        .sort((a, b) => b.pickRate - a.pickRate);
      const existingAgents = new Set(mapFiltered.map(s => s.agent));
      const totalMaps = mapFiltered[0]?.totalMaps ?? 0;
      for (const agent of Object.keys(agentImages)) {
        if (!existingAgents.has(agent)) {
          mapFiltered.push({ agent, map: selectedMap, timesPlayed: 0, pickRate: 0, totalMaps });
        }
      }
      return mapFiltered.sort((a, b) => b.pickRate - a.pickRate);
    }

    const mapTotals: Record<string, number> = {};
    for (const s of stats) {
      if (!(s.map in mapTotals)) mapTotals[s.map] = s.totalMaps;
    }
    const totalDenominator = Object.values(mapTotals).reduce((a, b) => a + b, 0) * 2;

    const byAgent: Record<string, { timesPlayed: number }> = {};
    for (const s of stats) {
      if (!byAgent[s.agent]) byAgent[s.agent] = { timesPlayed: 0 };
      byAgent[s.agent].timesPlayed += s.timesPlayed;
    }
    for (const agent of Object.keys(agentImages)) {
      if (!byAgent[agent]) byAgent[agent] = { timesPlayed: 0 };
    }

    return Object.entries(byAgent)
      .map(([agent, { timesPlayed }]) => ({
        agent,
        map: '',
        timesPlayed,
        pickRate: totalDenominator > 0 ? Math.round((timesPlayed / totalDenominator) * 100) : 0,
        totalMaps: 0,
      }))
      .sort((a, b) => b.pickRate - a.pickRate);
  }, [stats, selectedMap, agentImages]);

  const mapCount = useMemo(() => {
    if (selectedMap) {
      return stats.find(s => s.map === selectedMap)?.totalMaps ?? 0;
    }
    const seen = new Set<string>();
    let total = 0;
    for (const s of stats) {
      if (!seen.has(s.map)) { seen.add(s.map); total += s.totalMaps; }
    }
    return total;
  }, [stats, selectedMap]);

  // Compositions panel data
  const compositionPanel = useMemo(() => {
    if (selectedMap) {
      // Top 10 for the selected map
      return compositions
        .filter(c => c.map === selectedMap)
        .sort((a, b) => b.played - a.played)
        .slice(0, 10);
    }
    // All maps, top 2 each
    const byMap: Record<string, CompositionStat[]> = {};
    for (const c of compositions) {
      if (!byMap[c.map]) byMap[c.map] = [];
      byMap[c.map].push(c);
    }
    return Object.entries(byMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([map, comps]) => ({
        map,
        comps: comps.sort((a, b) => b.played - a.played).slice(0, 3),
      }));
  }, [compositions, selectedMap]);

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
      <div className="flex items-start gap-6">
        <KPICard
          title="Maps"
          value={String(mapCount)}
          label={selectedMap || 'all maps'}
          variant="neutral"
        />
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Map</label>
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-600 min-w-[160px]"
          >
            <option value="">All Maps</option>
            {maps.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Main 50/50 layout */}
      <div className="flex gap-6 items-start">
        {/* Bar chart — left half */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={filtered}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 24, bottom: 0 }}
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

        {/* Compositions panel — right half */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          {(() => {
            // Normalize to grouped format in both cases
            const groups: { map: string; comps: CompositionStat[] }[] = selectedMap
              ? [{ map: selectedMap, comps: compositionPanel as CompositionStat[] }]
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
                      {/* Stats below map image only when a map is selected */}
                      {selectedMap && mapFullStats[map] && (() => {
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
                          {selectedMap && c.teams && c.teams.length > 0 && (
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
                    {/* Stats column (all-maps view only) */}
                    {!selectedMap && mapFullStats[map] && (() => {
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
