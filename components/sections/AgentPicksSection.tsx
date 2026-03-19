'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AgentPickStat } from '@/lib/types';
import { KPICard } from '@/components/KPICard';

interface Props {
  stats: AgentPickStat[];
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

export function AgentPicksSection({ stats }: Props) {
  const [selectedMap, setSelectedMap] = useState<string>('');

  const maps = useMemo(() => [...new Set(stats.map(s => s.map))].sort(), [stats]);

  const filtered = useMemo(() => {
    if (selectedMap) {
      return stats
        .filter(s => s.map === selectedMap)
        .slice()
        .sort((a, b) => b.pickRate - a.pickRate);
    }

    // Aggregate across all maps: sum timesPlayed, recalculate pickRate
    // Denominator = sum of unique totalMaps per map name * 2
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

      {/* Bar chart */}
      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
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
                <Cell key={i} fill={entry.pickRate >= 50 ? '#22c55e' : entry.pickRate >= 25 ? '#f59e0b' : '#6b7280'} />
              ))}
              <LabelList dataKey="pickRate" position="right" formatter={(v: number) => `${v}%`} style={{ fill: '#9ca3af', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
