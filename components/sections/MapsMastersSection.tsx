'use client';

import { useState } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { MapWL, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';

interface Props {
  stats: Record<string, Record<string, MapWL>>;
  maps: string[];
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
}

const REGION_ROWS: { id: string; label: string }[] = [
  { id: 'reg_0', label: 'Americas' },
  { id: 'reg_1', label: 'EMEA' },
  { id: 'reg_2', label: 'China' },
  { id: 'reg_3', label: 'Pacific' },
];

const OVERALL_COL = -1;

function wr(wl: MapWL | undefined): number | null {
  if (!wl || wl.played === 0) return null;
  return Math.round((wl.wins / wl.played) * 100);
}

// Ícono resumen por mapa según win-rate: verde >60, amarillo 40-60, rojo <40, gris sin datos
function mapTick(pct: number | null, key: string) {
  const cls = 'w-3 h-3 shrink-0';
  if (pct === null) return <Minus key={key} className={`${cls} text-gray-600`} strokeWidth={3} />;
  if (pct > 60)     return <Check key={key} className={`${cls} text-green-400`} strokeWidth={3} />;
  if (pct < 40)     return <X     key={key} className={`${cls} text-red-400`} strokeWidth={3} />;
  return            <Minus key={key} className={`${cls} text-yellow-400`} strokeWidth={3} />;
}

// Fondo en gradiente según win-rate (misma paleta que Playoff %)
function heatmapBg(pct: number | null): string {
  if (pct === null) return 'transparent';
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 220 - t * 80;
  const sat = 55;
  const light = 18 + t * 28;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function getCellColor(value: number | null, allValues: (number | null)[]): string {
  if (value === null) return 'text-gray-600';
  const defined = allValues.filter((v): v is number => v !== null);
  if (defined.length <= 1) return 'text-gray-100';
  const best = Math.max(...defined);
  const worst = Math.min(...defined);
  if (value === best) return 'text-white font-black';
  if (value === worst) return 'text-gray-300';
  return 'text-gray-100';
}

// Marca si el valor es el mejor / peor de su columna (para resaltar con borde)
function getCellRank(value: number | null, allValues: (number | null)[]): 'best' | 'worst' | null {
  if (value === null) return null;
  const defined = allValues.filter((v): v is number => v !== null);
  if (defined.length <= 1) return null;
  const best = Math.max(...defined);
  const worst = Math.min(...defined);
  if (value === best) return 'best';
  if (value === worst) return 'worst';
  return null;
}

export function MapsMastersSection({ stats, maps, teamLogos = {}, teamRegions = {}, mapImages = {} }: Props) {
  const { navigate } = useNavigation();
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showDetail, setShowDetail] = useState(false);

  const allTeams = Object.keys(stats).sort();
  // Por defecto se muestran solo los equipos de STATS_RANK_DEFAULT_TEAMS (el resto ocultos)
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(
    () => new Set(allTeams.filter(t => !STATS_RANK_DEFAULT_TEAMS.includes(t)))
  );

  const baseTeams = allTeams.filter(t => !hiddenTeams.has(t));

  // Por defecto todos los mapas visibles excepto Bind
  const [hiddenMaps, setHiddenMaps] = useState<Set<string>>(
    () => new Set(maps.filter(m => m.toLowerCase() === 'bind'))
  );
  const visibleMaps = maps.filter(m => !hiddenMaps.has(m));

  function toggleTeam(team: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  function toggleMap(map: string) {
    setHiddenMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });
    setSortCol(null);
  }

  function resetFilters() {
    setHiddenTeams(new Set(allTeams.filter(t => !STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setHiddenMaps(new Set(maps.filter(m => m.toLowerCase() === 'bind')));
    setSortCol(null);
    setSortDir('desc');
    navigate('?section=maps-masters');
  }

  // Sin datos de torneos no hay chips que mostrar: placeholder completo.
  if (allTeams.length === 0 || maps.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region and tournament to see the maps...
      </div>
    );
  }

  // Valores por columna (mapa visible) para colorear best/worst — siempre sobre el orden base
  const mapAllValues = visibleMaps.map(m => baseTeams.map(t => wr(stats[t]?.[m])));

  // Win-rate general de un equipo sumando todos los mapas visibles (columnas)
  function overallWL(team: string): MapWL {
    let wins = 0, played = 0, bans = 0;
    for (const m of visibleMaps) {
      const wl = stats[team]?.[m];
      if (wl) { wins += wl.wins; played += wl.played; bans += wl.bans; }
    }
    return { wins, played, bans };
  }
  const overallAllValues = baseTeams.map(t => wr(overallWL(t)));

  const teams = (sortCol === null || sortCol >= visibleMaps.length)
    ? baseTeams
    : [...baseTeams].sort((a, b) => {
        const valA = sortCol === OVERALL_COL ? wr(overallWL(a)) : wr(stats[a]?.[visibleMaps[sortCol]]);
        const valB = sortCol === OVERALL_COL ? wr(overallWL(b)) : wr(stats[b]?.[visibleMaps[sortCol]]);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      });

  function handleColClick(mi: number) {
    if (sortCol === mi) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(mi);
      setSortDir('desc');
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Filtros: equipos (2 columnas) a la izquierda + mapas a la derecha */}
      {(() => {
        const renderTeamChip = (team: string) => {
          const active = !hiddenTeams.has(team);
          const logo = teamLogos[team];
          return (
            <button
              key={team}
              onClick={() => toggleTeam(team)}
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-[16px] font-bold uppercase tracking-wide transition-colors border ${
                active
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {logo && (
                <img
                  src={logo}
                  alt={team}
                  className={`w-6 h-6 object-contain shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
                />
              )}
              <span className={active ? '' : 'line-through'}>{team}</span>
            </button>
          );
        };

        const renderMapChip = (map: string) => {
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
        };

        const knownRegions = new Set(REGION_ROWS.map(r => r.id));
        const rows = REGION_ROWS.map(r => ({
          label: r.label,
          teams: allTeams.filter(t => teamRegions[t] === r.id),
        }));
        const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
        if (otherTeams.length > 0) rows.push({ label: 'Other', teams: otherTeams });
        const visibleRows = rows.filter(row => row.teams.length > 0);

        return (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {/* Teams — columna izquierda */}
            <div className="flex flex-col gap-2">
              <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>
              <div className="flex flex-col gap-2 px-1">
                {visibleRows.map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-right text-[10px] font-bold uppercase tracking-widest text-gray-600">
                      {row.label}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {row.teams.map(renderTeamChip)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maps */}
            <div className="flex flex-col gap-2">
              <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Maps</span>
              <div className="flex flex-wrap gap-2 px-1 max-w-md">
                {maps.map(renderMapChip)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Controls */}
      <div className="flex justify-start gap-2 px-1">
        <button
          onClick={() => setShowDetail(d => !d)}
          className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
            showDetail
              ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
              : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
          }`}
        >
          Detail info
        </button>
        <button
          onClick={resetFilters}
          className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
        >
          Reset filters
        </button>
      </div>

      {baseTeams.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Select at least one team to see the maps...
        </div>
      ) : (
      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-x-auto">
        <table className="border-separate w-full" style={{ borderSpacing: '1px 2px' }}>
          <thead className="bg-[#0f1115]">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0f1115] border-b border-gray-800 w-8 text-center align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                #
              </th>
              <th
                className="sticky left-8 z-10 bg-[#0f1115] border-b border-r border-gray-800 px-5 text-left align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap"
                style={{ width: '1%' }}
              >
                Team
              </th>
              {(() => {
                const isActive = sortCol === OVERALL_COL;
                return (
                  <th
                    onClick={() => handleColClick(OVERALL_COL)}
                    className={`border-b border-r border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] px-3 align-bottom pb-2 ${isActive ? 'bg-[#1e2430]' : ''}`}
                    style={{ minWidth: 64 }}
                  >
                    <div className="flex flex-col items-center justify-end gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        Overall
                      </span>
                      <span className={`text-[9px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                      </span>
                    </div>
                  </th>
                );
              })()}
              {visibleMaps.map((m, mi) => {
                const isActive = sortCol === mi;
                return (
                  <th
                    key={m}
                    onClick={() => handleColClick(mi)}
                    className={`border-b border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] px-3 align-bottom pb-2 ${isActive ? 'bg-[#1e2430]' : ''}`}
                    style={{ minWidth: 64 }}
                  >
                    <div className="flex flex-col items-center justify-end gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide text-center leading-tight ${isActive ? 'text-blue-400' : 'text-gray-400'}`}>
                        {m}
                      </span>
                      <span className={`text-[9px] shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
                        {isActive ? (sortDir === 'desc' ? '▼' : '▲') : '⇅'}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {teams.map((team, rank) => (
              <tr key={team} className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
                <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 text-center py-3 text-[11px] font-bold text-gray-600">
                  {rank + 1}
                </td>
                <td className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap" style={{ width: '1%' }}>
                  <div className="flex items-center gap-2">
                    {teamLogos[team] && (
                      <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />
                    )}
                    {team}
                  </div>
                </td>
                {(() => {
                  const wl = overallWL(team);
                  const val = wr(wl);
                  return (
                    <td
                      className="py-3 px-3 text-center border-r border-gray-800"
                      style={{ minWidth: 64 }}
                    >
                      {val !== null ? (
                        <div className="text-sm font-bold" style={{ color: heatmapBg(val) }}>
                          {val}%
                          {showDetail && <span className="text-gray-200/80 font-normal whitespace-nowrap"> {wl.wins}W-{wl.played - wl.wins}L</span>}
                        </div>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                      {showDetail && (
                        <div className="flex flex-wrap justify-center items-center gap-0.5 mt-1">
                          {visibleMaps.map(m => mapTick(wr(stats[team]?.[m]), m))}
                        </div>
                      )}
                    </td>
                  );
                })()}
                {visibleMaps.map((m, mi) => {
                  const wl = stats[team]?.[m];
                  const val = wr(wl);
                  const color = getCellColor(val, mapAllValues[mi]);
                  const rank = getCellRank(val, mapAllValues[mi]);
                  const isActive = sortCol === mi;
                  const ringColor =
                    rank === 'best' ? 'rgba(74,222,128,0.9)' :
                    rank === 'worst' ? '#181938' :
                    isActive ? 'rgba(59,130,246,0.4)' : null;
                  return (
                    <td
                      key={m}
                      className="py-3 px-3 text-center"
                      style={{
                        minWidth: 64,
                        backgroundColor: val !== null ? heatmapBg(val) : (isActive ? '#1e2430' : '#1a1d23'),
                        boxShadow: ringColor ? `inset 0 0 0 2px ${ringColor}` : undefined,
                      }}
                    >
                      {val !== null && wl ? (
                        <>
                          <div className={`text-sm ${color}`}>
                            {val}%
                            {showDetail && <span className="text-gray-200/80 font-normal whitespace-nowrap"> {wl.wins}W-{wl.played - wl.wins}L</span>}
                          </div>
                          {showDetail && (
                            <div className="text-[13px] text-gray-200/80 whitespace-nowrap">
                              {wl.played} Ply - {wl.bans} Ban
                            </div>
                          )}
                        </>
                      ) : showDetail && wl && wl.bans > 0 ? (
                        <div className="text-[15px] text-gray-600 font-normal whitespace-nowrap">
                          {wl.bans} Ban
                        </div>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
