'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { MapStat } from '@/lib/types';

type SortKey = 'mapName' | 'picks' | 'bans' | 'deciders' | 'rivalPicks' | 'rivalBans';
type SortDir = 'asc' | 'desc';

interface Props {
  stats: MapStat[];
}

export function MapsSection({ stats }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('mapName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedStats = stats.slice().sort((a, b) => {
    let cmp: number;
    if (sortKey === 'mapName') {
      cmp = a.mapName.localeCompare(b.mapName);
    } else {
      cmp = a[sortKey] - b[sortKey];
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

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
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
            <tr>
              <th
                className="p-4 border-b border-gray-800 cursor-pointer select-none hover:bg-white/5"
                onClick={() => handleSort('mapName')}
              >
                Mapa<SortIcon col="mapName" />
              </th>
              <th className="p-4 text-center border-b border-gray-800 bg-gray-900/80">Winrate</th>
              <th className="p-4 text-center border-b border-gray-800 bg-rose-900/80">Atk Side</th>
              <th className="p-4 text-center border-b border-gray-800 bg-green-800/80">Def Side</th>
              <SortableTh col="picks" className="bg-green-900/30 text-green-400">Picks</SortableTh>
              <SortableTh col="bans" className="bg-red-900/30 text-red-400">Bans</SortableTh>
              <SortableTh col="deciders" className="bg-blue-900/30 text-blue-400">Decider</SortableTh>
              <SortableTh col="rivalPicks" className="bg-gray-900/80">Picks Rival</SortableTh>
              <SortableTh col="rivalBans" className="bg-gray-900/80">Bans Rival</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedStats.map((s) => {
              const winrate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
              const atkRate = s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : null;
              const defRate = s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : null;

              return (
                <tr key={s.mapName} className="hover:bg-[#252a33] transition-colors">
                  <td className="p-4 font-bold text-white bg-[#1a1d23]">{s.mapName}</td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <span className={`font-bold ${winrate >= 50 ? 'text-green-600' : 'text-red-400'}`}>{winrate}%</span>
                    <div className="text-[10px] text-gray-400">({s.wins}W - {s.played - s.wins}L)</div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {atkRate !== null ? `${atkRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {s.attTotal > 0 ? `(${s.attWins}W - ${s.attTotal - s.attWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {defRate !== null ? `${defRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {s.defTotal > 0 ? `(${s.defWins}W - ${s.defTotal - s.defWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center text-green-400 font-bold bg-green-900/10">{s.picks}</td>
                  <td className="p-4 text-center text-red-400 font-bold bg-red-900/10">{s.bans}</td>
                  <td className="p-4 text-center text-blue-400 font-bold bg-blue-900/10">{s.deciders}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalPicks}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalBans}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
