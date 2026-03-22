'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { OverallMapStat } from '@/lib/types';

interface Props {
  stats: OverallMapStat[];
}

const PICKS_COLOR = '#4ade80';    // green-400
const DECIDERS_COLOR = '#60a5fa'; // blue-400
const BANS_COLOR = '#f87171';     // red-400

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const picks = payload.find((p: any) => p.dataKey === 'picks')?.value ?? 0;
  const deciders = payload.find((p: any) => p.dataKey === 'deciders')?.value ?? 0;
  const bans = payload.find((p: any) => p.dataKey === 'bansNeg')?.value ?? 0;
  return (
    <div className="bg-[#1a1d23] border border-gray-700 rounded-lg p-3 text-sm shadow-xl">
      <div className="font-bold text-white mb-2">{label}</div>
      <div className="flex items-center gap-2 text-green-400">
        <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
        Picks: <span className="font-bold ml-1">{picks}</span>
      </div>
      <div className="flex items-center gap-2 text-blue-400">
        <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
        Deciders: <span className="font-bold ml-1">{deciders}</span>
      </div>
      <div className="flex items-center gap-2 text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
        Bans: <span className="font-bold ml-1">{Math.abs(bans)}</span>
      </div>
    </div>
  );
}

export function MapPicksSection({ stats }: Props) {
  const data = useMemo(() =>
    stats
      .slice()
      .sort((a, b) => (b.picks + b.deciders) - (a.picks + a.deciders))
      .map(s => ({
        mapName: s.mapName,
        picks: s.picks,
        deciders: s.deciders,
        bansNeg: -s.bans,
      })),
    [stats]
  );

  if (stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region or tournament to see map picks data...
      </div>
    );
  }

  const maxPos = Math.max(...data.map(d => d.picks + d.deciders));
  const maxNeg = Math.max(...data.map(d => Math.abs(d.bansNeg)));
  const yMax = Math.ceil(Math.max(maxPos, maxNeg) * 1.15);

  return (
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 p-6">
      <div className="flex gap-6 mb-6 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: PICKS_COLOR }} />
          Picks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: DECIDERS_COLOR }} />
          Deciders
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: BANS_COLOR }} />
          Bans
        </span>
      </div>

      <ResponsiveContainer width="100%" height={420}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 8 }}
          barCategoryGap="30%"
          stackOffset="sign"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3139" vertical={false} />
          <XAxis
            dataKey="mapName"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[-yMax, yMax]}
            tickFormatter={v => String(Math.abs(v))}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine y={0} stroke="#374151" strokeWidth={1.5} />

          {/* Positive stack: picks + deciders */}
          <Bar dataKey="picks" stackId="a" fill={PICKS_COLOR} radius={[0, 0, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="picks"
              position="inside"
              formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')}
              style={{ fill: '#052e16', fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
          <Bar dataKey="deciders" stackId="a" fill={DECIDERS_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="deciders"
              position="top"
              formatter={(v: unknown) => (Number(v) > 0 ? Number(v) : '')}
              style={{ fill: '#93c5fd', fontSize: 11, fontWeight: 700 }}
            />
          </Bar>

          {/* Negative stack: bans */}
          <Bar dataKey="bansNeg" stackId="a" fill={BANS_COLOR} radius={[0, 0, 4, 4]} isAnimationActive={false}>
            <LabelList
              dataKey="bansNeg"
              position="inside"
              formatter={(v: unknown) => (Number(v) < 0 ? Math.abs(Number(v)) : '')}
              style={{ fill: '#000000', fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
