'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { CompositionStat } from '@/lib/types';

interface Props {
  stats: CompositionStat[];
}

type SortKey = 'map' | 'played' | 'composition';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} className="inline ml-1 opacity-30" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="inline ml-1 text-blue-400" />
    : <ChevronDown size={12} className="inline ml-1 text-blue-400" />;
}

export function CompositionsSection({ stats }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('map');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key === 'played' ? 'desc' : 'asc');
    }
  }

  const sorted = useMemo(() => stats.slice().sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'map') cmp = a.map.localeCompare(b.map);
    else if (sortKey === 'played') cmp = a.played - b.played;
    else cmp = a.composition.localeCompare(b.composition);
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
        Select a region or tournament to see composition data...
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
                onClick={() => handleSort('map')}
                className="p-4 border-b border-gray-800 cursor-pointer select-none hover:bg-white/5"
              >
                Map<SortIcon active={sortKey === 'map'} dir={sortDir} />
              </th>
              <Th col="played" className="bg-blue-900/30 text-blue-400">Played</Th>
              <th
                onClick={() => handleSort('composition')}
                className="p-4 border-b border-gray-800 cursor-pointer select-none hover:bg-white/5"
              >
                Composition<SortIcon active={sortKey === 'composition'} dir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.map((s, i) => (
              <tr key={i} className="hover:bg-[#252a33] transition-colors">
                <td className="p-4 font-bold text-white">{s.map}</td>
                <td className="p-4 text-center bg-blue-900/10 font-bold text-blue-400">{s.played}</td>
                <td className="p-4 text-gray-300 font-mono text-sm">{s.composition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
