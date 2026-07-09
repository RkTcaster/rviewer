'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { FormMapPoint } from '@/lib/types';

interface Props {
  points: FormMapPoint[];
  teamName: string;
}

const WINDOWS = [3, 5, 10];
type Metric = 'round' | 'map';

const btnClass = (active: boolean) =>
  `px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
    active ? 'bg-[#252a33] text-white' : 'text-gray-500 hover:text-gray-300'
  }`;

function shortDate(date: string): string {
  const [, m, d] = date.split('T')[0].split('-');
  return `${d}/${m}`;
}

type ChartPoint = FormMapPoint & { idx: number; label: string; rolling: number };

export function FormSection({ points, teamName }: Props) {
  const [windowSize, setWindowSize] = useState(5);
  const [metric, setMetric] = useState<Metric>('round');

  if (points.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No match data available for this selection.
      </div>
    );
  }

  // WR rodante sobre los últimos N mapas terminando en cada punto
  const chartData: ChartPoint[] = points.map((p, i) => {
    const from = Math.max(0, i - windowSize + 1);
    const slice = points.slice(from, i + 1);
    let rolling: number;
    if (metric === 'round') {
      const won = slice.reduce((s, x) => s + x.roundsWon, 0);
      const lost = slice.reduce((s, x) => s + x.roundsLost, 0);
      rolling = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    } else {
      rolling = Math.round((slice.filter(x => x.won).length / slice.length) * 100);
    }
    return { ...p, idx: i, label: shortDate(p.date), rolling };
  }).slice(Math.min(windowSize - 1, points.length - 1));

  const ResultDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
      <circle
        cx={cx} cy={cy} r={4}
        fill={payload.won ? '#22c55e' : '#f87171'}
        stroke="#1a1d23" strokeWidth={1.5}
      />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const p: ChartPoint = payload[0].payload;
    return (
      <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-xs">
        <p className="font-bold text-gray-200">{p.map} vs {p.rival}</p>
        <p className="text-gray-400">{p.date.split('T')[0]}{p.event ? ` · ${p.event}` : ''}</p>
        <p className={p.won ? 'text-green-400' : 'text-red-400'}>
          {p.won ? 'Won' : 'Lost'} {p.roundsWon}-{p.roundsLost}
        </p>
        <p className="text-gray-300 mt-1">
          Rolling {metric === 'round' ? 'round' : 'map'} WR (last {windowSize}): <span className="font-bold">{p.rolling}%</span>
        </p>
      </div>
    );
  };

  return (
    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
            Form Timeline — Rolling {metric === 'round' ? 'Round' : 'Map'} Winrate
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {teamName} · {points.length} maps · dots show each map result (green = won, red = lost)
          </p>
        </div>
        <div className="ml-auto flex gap-3">
          <div className="flex gap-1 bg-[#0f1115] rounded-lg p-1">
            <button onClick={() => setMetric('round')} className={btnClass(metric === 'round')}>Round WR</button>
            <button onClick={() => setMetric('map')} className={btnClass(metric === 'map')}>Map WR</button>
          </div>
          <div className="flex gap-1 bg-[#0f1115] rounded-lg p-1">
            {WINDOWS.map(w => (
              <button key={w} onClick={() => setWindowSize(w)} className={btnClass(windowSize === w)}>
                Last {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252a33" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: '#374151' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <ReferenceLine y={50} stroke="#6b7280" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="rolling"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={<ResultDot />}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
