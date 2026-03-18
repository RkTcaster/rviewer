'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { OverallMapStat } from '@/lib/types';

interface Props {
  stats: OverallMapStat[];
}

type SortKey = 'mapName' | 'picks' | 'bans' | 'deciders' | 'appearances';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="inline ml-1 opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="inline ml-1 text-blue-400" />
    : <ChevronDown size={12} className="inline ml-1 text-blue-400" />;
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

export function MapPicksSection({ stats }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('picks');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const totalPicks = stats.reduce((s, m) => s + m.picks, 0);
  const totalBans = stats.reduce((s, m) => s + m.bans, 0);

  const sorted = useMemo(() => stats.slice().sort((a, b) => {
    const appA = a.picks + a.deciders;
    const appB = b.picks + b.deciders;
    let cmp = sortKey === 'mapName'
      ? a.mapName.localeCompare(b.mapName)
      : sortKey === 'appearances'
      ? appA - appB
      : a[sortKey] - b[sortKey];
    return sortDir === 'asc' ? cmp : -cmp;
  }), [stats, sortKey, sortDir]);

  function Th({ col, className, children }: { col: SortKey; className?: string; children: React.ReactNode }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className={`p-4 text-center border-b border-gray-800 cursor-pointer select-none hover:bg-white/5 ${className ?? ''}`}
      >
        {children}<SortIcon active={sortKey === col} dir={sortDir} />
      </th>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region or tournament to see map picks data...
      </div>
    );
  }

  return (
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
            <tr>
              <th
                onClick={() => handleSort('mapName')}
                className="p-4 border-b border-gray-800 cursor-pointer select-none hover:bg-white/5"
              >
                Map<SortIcon active={sortKey === 'mapName'} dir={sortDir} />
              </th>
              <Th col="picks" className="bg-green-900/30 text-green-400">Picks</Th>
              <Th col="bans" className="bg-red-900/30 text-red-400">Bans</Th>
              <Th col="deciders" className="bg-blue-900/30 text-blue-400">Deciders</Th>
              <Th col="appearances" className="bg-gray-900/80">Appearances</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((s) => {
              const appearances = s.picks + s.deciders;
              return (
                <tr key={s.mapName} className="hover:bg-[#252a33] transition-colors">
                  <td className="p-4 font-bold text-white">{s.mapName}</td>
                  <td className="p-4 text-center bg-green-900/10">
                    <div className="font-bold text-green-400">{s.picks}</div>
                    <div className="text-[10px] text-gray-500">{pct(s.picks, totalPicks)}% of picks</div>
                  </td>
                  <td className="p-4 text-center bg-red-900/10">
                    <div className="font-bold text-red-400">{s.bans}</div>
                    <div className="text-[10px] text-gray-500">{pct(s.bans, totalBans)}% of bans</div>
                  </td>
                  <td className="p-4 text-center text-blue-400 font-bold bg-blue-900/10">
                    {s.deciders || <span className="text-gray-600">-</span>}
                  </td>
                  <td className="p-4 text-center text-gray-300 font-bold">{appearances}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
