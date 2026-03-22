'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { AgentPickStat } from '@/lib/types';

interface Props {
  statsLeft: AgentPickStat[];
  statsRight: AgentPickStat[];
  agentImages: Record<string, string>;
}

function aggregatePickRate(stats: AgentPickStat[]): Record<string, number> {
  const mapTotals: Record<string, number> = {};
  for (const s of stats) {
    if (!(s.map in mapTotals)) mapTotals[s.map] = s.totalMaps;
  }
  const denom = Object.values(mapTotals).reduce((a, b) => a + b, 0) * 2;
  const byAgent: Record<string, number> = {};
  for (const s of stats) {
    byAgent[s.agent] = (byAgent[s.agent] || 0) + s.timesPlayed;
  }
  const result: Record<string, number> = {};
  for (const [agent, played] of Object.entries(byAgent)) {
    result[agent] = denom > 0 ? Math.round((played / denom) * 100) : 0;
  }
  return result;
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

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.agent}</p>
      <p className="text-blue-400">Left: <span className="font-bold">{d.leftRate}%</span></p>
      <p className="text-orange-400">Right: <span className="font-bold">{d.rightRate}%</span></p>
      <p className={d.delta >= 0 ? 'text-green-400' : 'text-red-400'}>
        Delta: <span className="font-bold">{d.delta > 0 ? '+' : ''}{d.delta}%</span>
      </p>
    </div>
  );
}

export function MetaShiftSection({ statsLeft, statsRight, agentImages }: Props) {
  const chartData = useMemo(() => {
    const leftRates = aggregatePickRate(statsLeft);
    const rightRates = aggregatePickRate(statsRight);

    return Object.keys(agentImages)
      .map(agent => ({
        agent,
        leftRate: leftRates[agent] ?? 0,
        rightRate: rightRates[agent] ?? 0,
        delta: (leftRates[agent] ?? 0) - (rightRates[agent] ?? 0),
      }))
      .sort((a, b) => b.delta - a.delta);
  }, [statsLeft, statsRight, agentImages]);

  const isEmpty = statsLeft.length === 0 && statsRight.length === 0;

  if (isEmpty) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select filters on both sides to compare agent pick rates...
      </div>
    );
  }

  const chartHeight = Math.max(300, chartData.length * 36);
  const maxAbs = Math.max(10, ...chartData.map(d => Math.abs(d.delta)));
  const xDomain: [number, number] = [-maxAbs, maxAbs];

  return (
    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-4 mb-4">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Left pick rate</span>
        <span className="text-xs text-gray-500">vs</span>
        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Right pick rate</span>
        <span className="text-xs text-gray-500 ml-2">— bars show delta (left − right)</span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 24, bottom: 0 }}
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
          <ReferenceLine x={0} stroke="#4b5563" strokeWidth={1} />
          <Bar dataKey="delta" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.delta > 0 ? '#22c55e' : entry.delta < 0 ? '#f87171' : '#4b5563'}
              />
            ))}
            <LabelList
              dataKey="delta"
              position="right"
              formatter={(v: number) => v > 0 ? `+${v}%` : `${v}%`}
              style={{ fill: '#9ca3af', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
