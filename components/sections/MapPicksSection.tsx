'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, LabelList,
} from 'recharts';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { OverallMapFullStat } from '@/lib/types';

interface Props {
  stats: OverallMapFullStat[];
}

const PICKS_COLOR = '#4ade80';    // green-400
const DECIDERS_COLOR = '#60a5fa'; // blue-400
const BANS_COLOR = '#f87171';     // red-400

type SortKey = 'mapName' | 'atkWr' | 'defWr' | 'roundsPlayed' | 'picks' | 'bans' | 'deciders';
type SortDir = 'asc' | 'desc';

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
  const chartData = useMemo(() =>
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

  const [sortKey, setSortKey] = useState<SortKey>('roundsPlayed');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const tableRows = useMemo(() => {
    const rows = stats.map(s => {
      const roundsPlayed = s.attTotal;
      const atkWr = s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : null;
      const defWr = s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : null;
      return { ...s, roundsPlayed, atkWr, defWr };
    });
    rows.sort((a, b) => {
      let cmp: number;
      if (sortKey === 'mapName') {
        cmp = a.mapName.localeCompare(b.mapName);
      } else {
        const av = (a[sortKey] ?? -1) as number;
        const bv = (b[sortKey] ?? -1) as number;
        cmp = av - bv;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [stats, sortKey, sortDir]);

  if (stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region or tournament to see map picks data...
      </div>
    );
  }

  const maxPos = Math.max(...chartData.map(d => d.picks + d.deciders));
  const maxNeg = Math.max(...chartData.map(d => Math.abs(d.bansNeg)));
  const yMax = Math.ceil(Math.max(maxPos, maxNeg) * 1.15);

  function SortIcon({ col }: { col: SortKey }) {
    if (col !== sortKey) return <ChevronsUpDown size={12} className="inline ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="inline ml-1 text-blue-400" />
      : <ChevronDown size={12} className="inline ml-1 text-blue-400" />;
  }

  function SortableTh({ col, className, children }: { col: SortKey; className?: string; children: React.ReactNode }) {
    return (
      <th
        className={`p-4 text-center border-b border-gray-800 cursor-pointer select-none hover:bg-white/5 ${className ?? ''}`}
        onClick={() => handleSort(col)}
      >
        {children}<SortIcon col={col} />
      </th>
    );
  }

  return (
    <div className="flex flex-col gap-6">
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
            data={chartData}
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

      <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
              <tr>
                <th
                  className="p-4 border-b border-gray-800 cursor-pointer select-none hover:bg-white/5"
                  onClick={() => handleSort('mapName')}
                >
                  Maps<SortIcon col="mapName" />
                </th>
                <SortableTh col="atkWr" className="bg-rose-900/80">Atk WR</SortableTh>
                <SortableTh col="defWr" className="bg-green-800/80">Def WR</SortableTh>
                <SortableTh col="roundsPlayed" className="bg-gray-900/80">Rounds played</SortableTh>
                <SortableTh col="picks" className="bg-green-900/30 text-green-400">Picks</SortableTh>
                <SortableTh col="bans" className="bg-red-900/30 text-red-400">Bans</SortableTh>
                <SortableTh col="deciders" className="bg-blue-900/30 text-blue-400">Deciders</SortableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tableRows.map((s, i) => {
                const rowBg = i % 2 === 0 ? 'bg-[#1a1d23]' : 'bg-[#161920]';
                return (
                  <tr key={s.mapName} className={`transition-colors ${rowBg} hover:bg-[#252a33]`}>
                    <td className="p-4 font-bold text-white">{s.mapName}</td>
                    <td className="p-4 text-center border-x border-gray-800">
                      {s.atkWr !== null
                        ? <span className={`font-bold ${s.atkWr >= 50 ? 'text-green-500' : 'text-red-400'}`}>{s.atkWr}%</span>
                        : <span className="text-gray-500">-</span>}
                    </td>
                    <td className="p-4 text-center border-x border-gray-800">
                      {s.defWr !== null
                        ? <span className={`font-bold ${s.defWr >= 50 ? 'text-green-500' : 'text-red-400'}`}>{s.defWr}%</span>
                        : <span className="text-gray-500">-</span>}
                    </td>
                    <td className="p-4 text-center text-gray-300">{s.roundsPlayed}</td>
                    <td className="p-4 text-center text-green-400 font-bold bg-green-900/10">{s.picks}</td>
                    <td className="p-4 text-center text-red-400 font-bold bg-red-900/10">{s.bans}</td>
                    <td className="p-4 text-center text-blue-400 font-bold bg-blue-900/10">{s.deciders}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
