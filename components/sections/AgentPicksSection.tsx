'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AgentPickStat, CompositionStat } from '@/lib/types';
import { KPICard } from '@/components/KPICard';

interface Props {
  stats: AgentPickStat[];
  compositions: CompositionStat[];
  mapImages: Record<string, string>;
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

export function AgentPicksSection({ stats, compositions, mapImages }: Props) {
  const [selectedMap, setSelectedMap] = useState<string>('');

  const maps = useMemo(() => [...new Set(stats.map(s => s.map))].sort(), [stats]);

  const filtered = useMemo(() => {
    if (selectedMap) {
      return stats
        .filter(s => s.map === selectedMap)
        .slice()
        .sort((a, b) => b.pickRate - a.pickRate);
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

    return Object.entries(byAgent)
      .map(([agent, { timesPlayed }]) => ({
        agent,
        map: '',
        timesPlayed,
        pickRate: totalDenominator > 0 ? Math.round((timesPlayed / totalDenominator) * 100) : 0,
        totalMaps: 0,
      }))
      .sort((a, b) => b.pickRate - a.pickRate);
  }, [stats, selectedMap]);

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
              margin={{ top: 0, right: 40, left: 80, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2d3139" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                stroke="#6b7280"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="agent"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                width={75}
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
          {selectedMap && mapImages[selectedMap] && (
            <img src={mapImages[selectedMap]} alt={selectedMap} className="w-full h-28 object-cover rounded-lg mb-4 opacity-90" />
          )}

          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">
            {selectedMap ? `Top 10 compositions — ${selectedMap}` : 'Most played compositions'}
          </h3>

          {selectedMap ? (
            // Top 10 for a single map
            <ol className="flex flex-col gap-2">
              {(compositionPanel as CompositionStat[]).map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-gray-600 text-xs w-4 shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-gray-200 text-sm leading-snug flex-1">
                    {c.composition}
                    <span className="ml-2 text-gray-500 text-xs">({c.played})</span>
                  </span>
                </li>
              ))}
              {(compositionPanel as CompositionStat[]).length === 0 && (
                <p className="text-gray-600 text-sm">No data available</p>
              )}
            </ol>
          ) : (
            // Per-map, top 2 each
            <div className="flex flex-col gap-5">
              {(compositionPanel as { map: string; comps: CompositionStat[] }[]).map(({ map, comps }) => (
                <div key={map}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {mapImages[map] && (
                      <img src={mapImages[map]} alt={map} className="w-16 h-9 object-cover rounded opacity-80" />
                    )}
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">{map}</p>
                  </div>
                  <ol className="flex flex-col gap-1">
                    {comps.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-gray-600 text-xs w-4 shrink-0 mt-0.5">{i + 1}.</span>
                        <span className="text-gray-300 text-xs leading-snug flex-1">
                          {c.composition}
                          <span className="ml-1.5 text-gray-500">({c.played})</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {(compositionPanel as any[]).length === 0 && (
                <p className="text-gray-600 text-sm">No data available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
