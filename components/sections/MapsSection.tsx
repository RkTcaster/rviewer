'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { CompositionStat, MapStat } from '@/lib/types';

type SortKey = 'mapName' | 'picks' | 'bans' | 'deciders' | 'rivalPicks' | 'rivalBans';
type SortDir = 'asc' | 'desc';

interface Props {
  stats: MapStat[];
  compositions: CompositionStat[];
  agentImages: Record<string, string>;
  mapImages?: Record<string, string>;
}

export function MapsSection({ stats, compositions, agentImages, mapImages = {} }: Props) {
  const compsByMap = compositions.reduce<Record<string, CompositionStat[]>>((acc, c) => {
    if (!acc[c.map]) acc[c.map] = [];
    acc[c.map].push(c);
    return acc;
  }, {});
  const [sortKey, setSortKey] = useState<SortKey>('mapName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const allMaps = stats.map(s => s.mapName).sort((a, b) => a.localeCompare(b));
  // Map filter chips — por defecto todos los mapas visibles excepto Abyss, Bind y Corrode
  const DEFAULT_HIDDEN_MAPS = ['abyss', 'bind', 'corrode'];
  const [hiddenMaps, setHiddenMaps] = useState<Set<string>>(
    () => new Set(allMaps.filter(m => DEFAULT_HIDDEN_MAPS.includes(m.toLowerCase())))
  );
  function toggleMap(map: string) {
    setHiddenMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedStats = stats.filter(s => !hiddenMaps.has(s.mapName)).sort((a, b) => {
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
    <div className="flex flex-col gap-4">
    {/* Map filter chips */}
    <div className="flex flex-col gap-2">
      <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Maps</span>
      <div className="flex flex-wrap gap-2 px-1">
        {allMaps.map(map => {
          const active = !hiddenMaps.has(map);
          const img = mapImages[map];
          return (
            <button
              key={map}
              onClick={() => toggleMap(map)}
              className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                active
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {img && (
                <img
                  src={img}
                  alt={map}
                  className={`w-[50px] h-[40px] object-cover rounded shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
                />
              )}
              <span className={active ? '' : 'line-through'}>{map}</span>
            </button>
          );
        })}
      </div>
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
                Mapa<SortIcon col="mapName" />
              </th>
              <th className="p-4 text-center border-b border-gray-800 bg-gray-900/80">Winrate</th>
              <th className="p-4 text-center border-b border-gray-800 bg-rose-900/80">Atk Side</th>
              <th className="p-4 text-center border-b border-gray-800 bg-green-800/80">Def Side</th>
              <SortableTh col="picks" className="bg-green-900/30 text-green-400">Picks <span className="text-[10.5px] text-green-600 normal-case font-normal">(1st / 2nd)</span></SortableTh>
              <SortableTh col="bans" className="bg-red-900/30 text-red-400">Bans <span className="text-[10.5px] text-red-700 normal-case font-normal">(1st / 2nd)</span></SortableTh>
              <SortableTh col="deciders" className="bg-blue-900/30 text-blue-400">Decider</SortableTh>
              <SortableTh col="rivalPicks" className="bg-gray-900/80">Picks Rival</SortableTh>
              <SortableTh col="rivalBans" className="bg-gray-900/80">Bans Rival</SortableTh>
              <th className="p-4 border-b border-gray-800 bg-purple-900/30 text-purple-400">Compositions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedStats.map((s, i) => {
              const winrate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
              const atkRate = s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : null;
              const defRate = s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : null;

              const rowBg = i % 2 === 0 ? 'bg-[#1a1d23]' : 'bg-[#161920]';
              return (
                <tr key={s.mapName} className={`transition-colors ${rowBg} hover:bg-[#252a33]`}>
                  <td className="p-4 font-bold text-white">{s.mapName}</td>

                  <td className="p-4 text-center border-x border-gray-800">
                    <span className={`font-bold ${winrate >= 50 ? 'text-green-600' : 'text-red-400'}`}>{winrate}%</span>
                    <div className="text-[10px] text-gray-400">({s.wins}W - {s.played - s.wins}L)</div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {atkRate !== null ? `${atkRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {s.attTotal > 0 ? `(${s.attWins}W - ${s.attTotal - s.attWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {defRate !== null ? `${defRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {s.defTotal > 0 ? `(${s.defWins}W - ${s.defTotal - s.defWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center text-green-400 font-bold bg-green-900/10">
                    {s.picks}{s.picks > 0 && <span className="font-normal text-green-600 ml-1">({s.pick1}/{s.pick2})</span>}
                  </td>
                  <td className="p-4 text-center text-red-400 font-bold bg-red-900/10">
                    {s.bans}{s.bans > 0 && <span className="font-normal text-red-700 ml-1">({s.ban1}/{s.ban2})</span>}
                  </td>
                  <td className="p-4 text-center text-blue-400 font-bold bg-blue-900/10">{s.deciders}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalPicks}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalBans}</td>
                  <td className="p-4 bg-purple-900/10 min-w-[260px]">
                    {(compsByMap[s.mapName] ?? []).length === 0
                      ? <span className="text-gray-600 text-xs italic">Map not played</span>
                      : (compsByMap[s.mapName] ?? []).map((c) => {
                          const agents = c.composition.split(', ');
                          const allHaveIcons = agents.every(a => agentImages[a]);
                          return (
                            <div key={c.composition} className="flex items-center gap-1 leading-5">
                              {allHaveIcons
                                ? agents.map((agent, i) => (
                                    <img key={i} src={agentImages[agent]} alt={agent} title={agent} className="w-[25px] h-[25px] rounded" />
                                  ))
                                : <span className="text-gray-300 font-mono text-xs">{c.composition}</span>
                              }
                              {c.nonMirrorPlayed !== undefined && c.nonMirrorWins !== undefined
                                ? <span className="text-purple-400 text-xs">{c.nonMirrorWins}W-{c.nonMirrorPlayed - c.nonMirrorWins}L</span>
                                : <span className="text-purple-400 text-xs">({c.played})</span>
                              }
                            </div>
                          );
                        })
                    }
                  </td>
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
