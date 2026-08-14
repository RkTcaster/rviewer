'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { AgentMatchDetail, AgentPickStat, CompositionStat, OverallMapFullStat } from '@/lib/types';
import { KPICard } from '@/components/KPICard';

// Una composición son 5 agentes: es el tope tanto de agentes elegidos como de la suma de roles
const MAX_PICKS = 5;
const CHIPS_COL_WIDTH = 'w-[400px]'; // 8 chips de 44px + gaps, alinea los steppers entre filas
const ROLE_COL_WIDTH = 'w-[76px]';   // nombre del rol más largo (INITIATOR) bajo su logo
// Roles con símbolo en public/roles; cualquier otro cae al nombre en texto
const ROLE_ICONS = new Set(['controller', 'duelist', 'initiator', 'sentinel']);

interface Props {
  stats: AgentPickStat[];
  compositions: CompositionStat[];
  agentMatches: AgentMatchDetail[];
  mapImages: Record<string, string>;
  agentImages: Record<string, string>;
  agentRoles: Record<string, string>;
  mapFullStats: Record<string, OverallMapFullStat>;
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

function CompositionIcons({ composition, agentImages }: { composition: string; agentImages: Record<string, string> }) {
  const agents = composition.split(', ');
  const allHaveIcons = agents.every(a => agentImages[a]);
  if (allHaveIcons) {
    return (
      <div className="flex gap-0.5 flex-wrap">
        {agents.map((agent, i) => (
          <img key={i} src={agentImages[agent]} alt={agent} title={agent} className="w-[25px] h-[25px] rounded" />
        ))}
      </div>
    );
  }
  return <span className="text-gray-300 text-xs leading-snug">{composition}</span>;
}

// Logo arriba, nombre del rol debajo. Sin símbolo (rol desconocido) queda solo el nombre.
function RoleIcon({ role, size, className = '' }: { role: string; size: number; className?: string }) {
  const key = role.toLowerCase();
  return (
    <span className="flex flex-col items-center gap-0.5 shrink-0">
      {ROLE_ICONS.has(key) && (
        <img src={`/roles/${key}.png`} alt={role} title={role} style={{ width: size, height: size }} className={className} />
      )}
      <span className="text-[9px] font-bold uppercase tracking-wider leading-none">{role}</span>
    </span>
  );
}

function formatDateDMY(raw?: string): string | null {
  if (!raw) return null;
  const [datePart] = raw.split(/[T ]/);
  const parts = datePart.split('-');
  if (parts.length !== 3) return null;
  const yy = parts[0].slice(-2);
  const mm = parts[1].padStart(2, '0');
  const dd = parts[2].padStart(2, '0');
  return `${dd}-${mm}-${yy}`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as AgentPickStat & { nmwr?: number };
  const played = d.nonMirrorPlayed ?? 0;
  const wins = d.nonMirrorWins ?? 0;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.agent}</p>
      <p className="text-green-400">Pick Rate: <span className="font-bold">{d.pickRate}%</span></p>
      {d.nmwr !== undefined && (
        <p className="text-amber-400">NMWR: <span className="font-bold">{d.nmwr}%</span> <span className="text-gray-400">({wins}-{played - wins})</span></p>
      )}
      <p className="text-blue-400">Times Picked: <span className="font-bold">{d.timesPlayed}</span></p>
    </div>
  );
}

function MapWLTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { map: string; wins: number; losses: number; nmwr: number };
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.map}</p>
      <p className="text-amber-400">NMWR: <span className="font-bold">{d.nmwr}%</span></p>
      <p className="text-green-400">Wins: <span className="font-bold">{d.wins}</span></p>
      <p className="text-red-400">Losses: <span className="font-bold">{-d.losses}</span></p>
    </div>
  );
}

export function AgentPicksSection({ stats, compositions, agentMatches, mapImages, agentImages, agentRoles, mapFullStats }: Props) {
  const [selectedMaps, setSelectedMaps] = useState<Set<string>>(new Set());
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>({});
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'pickRate' | 'nmwr'>('pickRate');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [rightMode, setRightMode] = useState<'comps' | 'detail'>('comps');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const clickSort = (key: 'pickRate' | 'nmwr') => {
    if (sortBy === key) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortBy(key); setSortDir('desc'); }
  };

  const maps = useMemo(() => [...new Set(stats.map(s => s.map))].sort(), [stats]);
  // Una fila por rol, roles en orden alfabético y agentes alfabéticos dentro de cada fila
  const agentsByRole = useMemo(() => {
    const byRole: Record<string, string[]> = {};
    for (const agent of Object.keys(agentImages).sort()) {
      (byRole[agentRoles[agent] ?? 'Other'] ??= []).push(agent);
    }
    return Object.entries(byRole).sort(([a], [b]) => a.localeCompare(b));
  }, [agentImages, agentRoles]);

  const isAll = selectedMaps.size === 0;
  const single = selectedMaps.size === 1 ? [...selectedMaps][0] : null;
  const inScope = (map: string) => isAll || selectedMaps.has(map);

  const toggleMap = (map: string) =>
    setSelectedMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });

  const roleTotal = Object.values(roleCounts).reduce((a, b) => a + b, 0);
  // Mismo criterio de agrupado que agentsByRole, para que el chip y su fila usen la misma clave
  const roleOf = (agent: string) => agentRoles[agent] ?? 'Other';

  // Elegir un agente ocupa un cupo de su rol; soltarlo lo devuelve
  const toggleAgent = (agent: string) => {
    const role = roleOf(agent);
    if (selectedAgents.has(agent)) {
      setSelectedAgents(prev => {
        const next = new Set(prev);
        next.delete(agent);
        return next;
      });
      setRoleCounts(prev => ({ ...prev, [role]: Math.max(0, (prev[role] ?? 0) - 1) }));
      return;
    }
    if (roleTotal >= MAX_PICKS) return;
    setSelectedAgents(prev => new Set(prev).add(agent));
    setRoleCounts(prev => ({ ...prev, [role]: (prev[role] ?? 0) + 1 }));
  };

  const clearAgents = () => {
    setRoleCounts(prev => {
      const next = { ...prev };
      for (const agent of selectedAgents) {
        const role = roleOf(agent);
        next[role] = Math.max(0, (next[role] ?? 0) - 1);
      }
      return next;
    });
    setSelectedAgents(new Set());
  };

  const bumpRole = (role: string, delta: number) => {
    const count = roleCounts[role] ?? 0;
    if (delta > 0) {
      if (roleTotal >= MAX_PICKS) return;
      setRoleCounts(prev => ({ ...prev, [role]: (prev[role] ?? 0) + 1 }));
      return;
    }
    if (count === 0) return;
    setRoleCounts(prev => ({ ...prev, [role]: count - 1 }));
    // Si el cupo que queda no alcanza para los agentes ya elegidos de ese rol, suelta el último
    const chosen = [...selectedAgents].filter(a => roleOf(a) === role);
    if (chosen.length > count - 1) {
      const drop = chosen[chosen.length - 1];
      setSelectedAgents(prev => {
        const next = new Set(prev);
        next.delete(drop);
        return next;
      });
    }
  };

  // Ambos filtros condicionan el panel de composiciones y el NMWR, y se combinan en AND:
  // un agente elegido ya ocupa un cupo de su rol.
  const compHasAgents = (composition: string[]) => {
    if (selectedAgents.size === 0) return true;
    const inComp = new Set(composition);
    for (const a of selectedAgents) if (!inComp.has(a)) return false;
    return true;
  };

  // Cada rol con contador > 0 debe aparecer exactamente esa cantidad de veces en la comp
  const compMatchesRoles = (composition: string[]) => {
    if (roleTotal === 0) return true;
    const counts: Record<string, number> = {};
    for (const a of composition) {
      const role = agentRoles[a];
      if (role) counts[role] = (counts[role] ?? 0) + 1;
    }
    for (const [role, n] of Object.entries(roleCounts)) {
      if (n > 0 && (counts[role] ?? 0) !== n) return false;
    }
    return true;
  };

  const compFilterActive = selectedAgents.size > 0 || roleTotal > 0;

  // NMWR condicionado al filtro de comps, recalculado desde los partidos no-espejo.
  // null = sin filtro → se usan los agregados que ya vienen del server.
  const nmByComp = useMemo(() => {
    if (!compFilterActive) return null;
    const by: Record<string, { nonMirrorPlayed: number; nonMirrorWins: number }> = {};
    for (const m of agentMatches) {
      if (!inScope(m.map)) continue;
      if (!compHasAgents(m.composition) || !compMatchesRoles(m.composition)) continue;
      const e = (by[m.agent] ??= { nonMirrorPlayed: 0, nonMirrorWins: 0 });
      e.nonMirrorPlayed++;
      if (m.won) e.nonMirrorWins++;
    }
    return by;
  }, [agentMatches, selectedMaps, selectedAgents, roleCounts]);

  const filtered = useMemo(() => {
    const nmwr = (wins?: number, played?: number) =>
      played && played > 0 ? Math.round((wins ?? 0) / played * 100) : undefined;
    const nm = (agent: string, fallback: { nonMirrorPlayed?: number; nonMirrorWins?: number }) =>
      nmByComp
        ? (nmByComp[agent] ?? { nonMirrorPlayed: 0, nonMirrorWins: 0 })
        : { nonMirrorPlayed: fallback.nonMirrorPlayed ?? 0, nonMirrorWins: fallback.nonMirrorWins ?? 0 };

    const dir = sortDir === 'desc' ? 1 : -1;
    const cmp = (a: { pickRate: number; nmwr?: number }, b: { pickRate: number; nmwr?: number }) => {
      if (sortBy === 'nmwr') {
        const an = a.nmwr, bn = b.nmwr;
        if (an === undefined && bn === undefined) return b.pickRate - a.pickRate;
        if (an === undefined) return 1;   // no-data siempre al final
        if (bn === undefined) return -1;
        return an !== bn ? (bn - an) * dir : b.pickRate - a.pickRate;
      }
      return (b.pickRate - a.pickRate) * dir;
    };

    if (single) {
      const mapFiltered = stats
        .filter(s => s.map === single)
        .map(s => {
          const { nonMirrorPlayed, nonMirrorWins } = nm(s.agent, s);
          return { ...s, nonMirrorPlayed, nonMirrorWins, nmwr: nmwr(nonMirrorWins, nonMirrorPlayed) };
        });
      const existingAgents = new Set(mapFiltered.map(s => s.agent));
      const totalMaps = mapFiltered[0]?.totalMaps ?? 0;
      for (const agent of Object.keys(agentImages)) {
        if (!existingAgents.has(agent)) {
          mapFiltered.push({ agent, map: single, timesPlayed: 0, pickRate: 0, totalMaps, nonMirrorPlayed: 0, nonMirrorWins: 0, nmwr: undefined });
        }
      }
      return mapFiltered.sort(cmp);
    }

    const scope = stats.filter(s => inScope(s.map));
    const mapTotals: Record<string, number> = {};
    for (const s of scope) {
      if (!(s.map in mapTotals)) mapTotals[s.map] = s.totalMaps;
    }
    const totalDenominator = Object.values(mapTotals).reduce((a, b) => a + b, 0) * 2;

    const byAgent: Record<string, { timesPlayed: number; nonMirrorPlayed: number; nonMirrorWins: number }> = {};
    for (const s of scope) {
      if (!byAgent[s.agent]) byAgent[s.agent] = { timesPlayed: 0, nonMirrorPlayed: 0, nonMirrorWins: 0 };
      byAgent[s.agent].timesPlayed += s.timesPlayed;
      byAgent[s.agent].nonMirrorPlayed += s.nonMirrorPlayed ?? 0;
      byAgent[s.agent].nonMirrorWins += s.nonMirrorWins ?? 0;
    }
    for (const agent of Object.keys(agentImages)) {
      if (!byAgent[agent]) byAgent[agent] = { timesPlayed: 0, nonMirrorPlayed: 0, nonMirrorWins: 0 };
    }

    return Object.entries(byAgent)
      .map(([agent, agg]) => {
        const { nonMirrorPlayed, nonMirrorWins } = nm(agent, agg);
        return {
          agent,
          map: '',
          timesPlayed: agg.timesPlayed,
          pickRate: totalDenominator > 0 ? Math.round((agg.timesPlayed / totalDenominator) * 100) : 0,
          totalMaps: 0,
          nonMirrorPlayed,
          nonMirrorWins,
          nmwr: nmwr(nonMirrorWins, nonMirrorPlayed),
        };
      })
      .sort(cmp);
  }, [stats, selectedMaps, agentImages, sortBy, sortDir, nmByComp]);

  const mapCount = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const s of stats) {
      if (inScope(s.map) && !seen.has(s.map)) { seen.add(s.map); total += s.totalMaps; }
    }
    return total;
  }, [stats, selectedMaps]);

  // Compositions panel data
  const compositionPanel = useMemo(() => {
    const matches = (c: CompositionStat) => {
      const agents = c.composition.split(', ');
      return compHasAgents(agents) && compMatchesRoles(agents);
    };
    const isFiltered = compFilterActive;

    if (single) {
      return compositions
        .filter(c => c.map === single && matches(c))
        .sort((a, b) => b.played - a.played);
    }
    // Scoped maps, top 3 each (todas las coincidencias si hay filtro de agentes o roles)
    const byMap: Record<string, CompositionStat[]> = {};
    for (const c of compositions) {
      if (!inScope(c.map) || !matches(c)) continue;
      if (!byMap[c.map]) byMap[c.map] = [];
      byMap[c.map].push(c);
    }
    return Object.entries(byMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([map, comps]) => {
        const sorted = comps.sort((a, b) => b.played - a.played);
        return { map, comps: isFiltered ? sorted : sorted.slice(0, 3) };
      });
  }, [compositions, selectedMaps, selectedAgents, roleCounts]);

  // Resumen del filtro de comps: agentes elegidos + cupos de rol sin agente + slots libres.
  // Un rol con cupo > 0 queda fijado a esa cantidad exacta, así que los libres solo pueden ser de los roles sin cupo.
  const teamComposition = useMemo(() => {
    const chosenByRole: Record<string, number> = {};
    for (const agent of selectedAgents) {
      const role = roleOf(agent);
      chosenByRole[role] = (chosenByRole[role] ?? 0) + 1;
    }
    return {
      chosen: [...selectedAgents],
      pending: Object.entries(roleCounts)
        .map(([role, n]) => ({ role, n: n - (chosenByRole[role] ?? 0) }))
        .filter(({ n }) => n > 0)
        .sort((a, b) => a.role.localeCompare(b.role)),
      freeSlots: MAX_PICKS - roleTotal,
      freeRoles: agentsByRole.map(([role]) => role).filter(role => (roleCounts[role] ?? 0) === 0),
    };
  }, [selectedAgents, roleCounts, agentRoles, agentsByRole]);

  // Detail mode: agent shown = explicit selection, or top NMWR agent in current view
  const detailAgent = useMemo(() => {
    if (selectedAgent && filtered.some(d => d.agent === selectedAgent)) return selectedAgent;
    return filtered.find(d => d.nmwr !== undefined)?.agent ?? null;
  }, [selectedAgent, filtered]);

  // Mismo predicado que el NMWR del gráfico, si no el encabezado del panel no cierra con la columna
  const matchList = useMemo(() => {
    if (!detailAgent) return [];
    return agentMatches
      .filter(m => m.agent === detailAgent && inScope(m.map) && compHasAgents(m.composition) && compMatchesRoles(m.composition))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [agentMatches, detailAgent, selectedMaps, selectedAgents, roleCounts]);

  const mapWL = useMemo(() => {
    const by: Record<string, { wins: number; losses: number }> = {};
    for (const m of matchList) {
      if (!by[m.map]) by[m.map] = { wins: 0, losses: 0 };
      if (m.won) by[m.map].wins++; else by[m.map].losses++;
    }
    return Object.entries(by)
      .map(([map, { wins, losses }]) => ({
        map,
        wins,                // positivo
        losses: -losses,     // negativo (hacia abajo)
        total: wins + losses,
        nmwr: Math.round((wins / (wins + losses)) * 100),
      }))
      .sort((a, b) => a.map.localeCompare(b.map));
  }, [matchList]);

  const chartHeight = Math.max(300, filtered.length * 36);
  const maxPickRate = Math.max(10, ...filtered.map(d => d.pickRate));
  const xDomain: [number, number] = [0, maxPickRate];

  if (stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region or tournament to see agent pick data...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filters — same 50/50 split as the panels below */}
      <div className="flex gap-6 items-start">
        {/* Map filter — left half */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Map</label>
          <div className="flex flex-wrap gap-2">
            {[''].concat(maps).map(m => {
              const active = m ? selectedMaps.has(m) : isAll;
              const img = m ? mapImages[m] : undefined;
              return (
                <button
                  key={m || 'all'}
                  onClick={() => m ? toggleMap(m) : setSelectedMaps(new Set())}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {m
                    ? img && <img src={img} alt={m} className={`w-[50px] h-[40px] object-cover rounded shrink-0 transition-opacity ${active ? '' : 'opacity-70'}`} />
                    : <div className="w-[50px] h-[40px] rounded shrink-0 flex items-center justify-center bg-[#252a33] text-gray-400">ALL</div>}
                  <span>{m || 'All'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Agent filter — right half, only affects the compositions panel */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`${ROLE_COL_WIDTH} shrink-0`} />
            <div className={`${CHIPS_COL_WIDTH} shrink-0 flex items-center gap-3`}>
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Agents in comps <span className="text-gray-600 font-normal normal-case">· max {MAX_PICKS} ({selectedAgents.size}/{MAX_PICKS})</span>
              </label>
              <button
                onClick={clearAgents}
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                  selectedAgents.size === 0
                    ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                All
              </button>
            </div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
              Players per role <span className="text-gray-600 font-normal normal-case">· {roleTotal}/{MAX_PICKS}</span>
            </label>
          </div>
          {agentsByRole.map(([role, agents]) => {
            const count = roleCounts[role] ?? 0;
            return (
              <div key={role} className="flex items-center gap-2">
                <span className={`${ROLE_COL_WIDTH} shrink-0 flex items-center justify-center ${count > 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                  <RoleIcon role={role} size={20} className={count > 0 ? 'opacity-100' : 'opacity-50'} />
                </span>
                <div className={`${CHIPS_COL_WIDTH} shrink-0 flex flex-wrap gap-1.5`}>
                  {agents.map(agent => {
                    const active = selectedAgents.has(agent);
                    const capped = !active && roleTotal >= MAX_PICKS;
                    return (
                      <button
                        key={agent}
                        onClick={() => toggleAgent(agent)}
                        disabled={capped}
                        title={agent}
                        className={`p-1 rounded-lg border transition-colors ${
                          active
                            ? 'bg-blue-900/40 border-blue-700 hover:bg-blue-900/60'
                            : capped
                              ? 'bg-transparent border-gray-800 opacity-30 cursor-not-allowed'
                              : 'bg-transparent border-gray-700 hover:border-gray-500'
                        }`}
                      >
                        <img src={agentImages[agent]} alt={agent} className={`w-[34px] h-[34px] rounded transition-opacity ${active ? '' : 'opacity-70'}`} />
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => bumpRole(role, -1)}
                    disabled={count === 0}
                    title={`One less ${role}`}
                    className="w-6 h-6 rounded border border-gray-700 text-gray-400 text-[13px] font-bold leading-none transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-25 disabled:hover:border-gray-700 disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <span className={`w-5 text-center text-xs font-bold ${count > 0 ? 'text-blue-300' : 'text-gray-600'}`}>{count}</span>
                  <button
                    onClick={() => bumpRole(role, 1)}
                    disabled={roleTotal >= MAX_PICKS}
                    title={`One more ${role}`}
                    className="w-6 h-6 rounded border border-gray-700 text-gray-400 text-[13px] font-bold leading-none transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-25 disabled:hover:border-gray-700 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KPI + view controls — same 50/50 split; both columns stretch to the KPI card height so the pills align */}
      <div className="flex gap-6">
        <div className="flex-1 min-w-0 flex items-start gap-6 flex-wrap">
          <KPICard
            title="Maps"
            value={String(mapCount)}
            label={single ?? (isAll ? 'all maps' : `${selectedMaps.size} maps`)}
            variant="neutral"
          />
          <div className="flex flex-col gap-1 self-end pb-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sort by</label>
            <div className="flex gap-2">
              {([['pickRate', 'Pick Rate'], ['nmwr', 'NMWR']] as const).map(([key, label]) => {
                const active = sortBy === key;
                return (
                  <button
                    key={key}
                    onClick={() => clickSort(key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                      active
                        ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                        : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {label}{active && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-gray-500 self-end pb-2 ml-auto text-right">
            NMWR = win rate excluding mirror picks
            {compFilterActive && <span className="text-blue-400/80"> · conditioned on the team composition filter</span>}
          </p>
        </div>
        <div className="flex-1 min-w-0 flex items-start gap-6 flex-wrap">
          <div className="flex flex-col gap-1 self-end pb-2">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Detail info</label>
            <div className="flex gap-2">
              {([['comps', 'Compositions'], ['detail', 'NMWR Detail']] as const).map(([key, label]) => {
                const active = rightMode === key;
                return (
                  <button
                    key={key}
                    onClick={() => setRightMode(key)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                      active
                        ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                        : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1 self-end pb-2 min-w-0">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Team composition</label>
            <div className="flex items-center gap-1.5 flex-wrap min-h-[28px]">
              {selectedAgents.size === 0 && roleTotal === 0 ? (
                <span className="text-xs text-gray-400">All compositions</span>
              ) : (
                <>
                  {teamComposition.chosen.map(agent => (
                    <img key={agent} src={agentImages[agent]} alt={agent} title={agent} className="w-[28px] h-[28px] rounded" />
                  ))}
                  {teamComposition.pending.map(({ role, n }) => (
                    <span key={role} className="flex items-center gap-1 text-xs text-gray-300">
                      + {n} <RoleIcon role={role} size={18} className="opacity-90" />
                    </span>
                  ))}
                  {teamComposition.freeSlots > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      + {teamComposition.freeSlots}
                      {teamComposition.freeRoles.length > 0 && (
                        <span className="flex items-center gap-1.5">
                          ({teamComposition.freeRoles.map(r => <RoleIcon key={r} role={r} size={16} className="opacity-60" />)})
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main 50/50 layout */}
      <div className="flex gap-6 items-start">
        {/* Bar chart — left half */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          {/* Qué filtros afectan a cada columna */}
          <div className="flex items-end gap-2 mb-3">
            <p className="flex-1 min-w-0 text-[10px] text-gray-500 leading-tight">
              <span className="font-bold text-gray-400 uppercase tracking-wider">Pick rate</span> · filter only by maps &amp; tournaments
            </p>
            <p className="w-[120px] shrink-0 text-right text-[10px] text-gray-500 leading-tight">
              <span className="font-bold text-gray-400 uppercase tracking-wider">NMWR</span> · filter by current comp
            </p>
          </div>
          <div className="flex">
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={filtered}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 24, bottom: 0 }}
                  onMouseMove={(s: any) => setHoveredIndex(typeof s?.activeTooltipIndex === 'number' ? s.activeTooltipIndex : null)}
                  onMouseLeave={() => setHoveredIndex(null)}
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
                  <Bar dataKey="pickRate" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {filtered.map((entry, i) => (
                      <Cell key={i} fill={entry.pickRate >= 50 ? '#22c55e' : entry.pickRate >= 25 ? '#f59e0b' : entry.pickRate >= 5 ? '#1e3a8a' : '#fca5a5'} />
                    ))}
                    <LabelList dataKey="pickRate" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: '#9ca3af', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* NMWR column — aligned per agent row (chart uses margin top/bottom: 0) */}
            <div className="w-[120px] shrink-0 flex flex-col" style={{ height: chartHeight, paddingBottom: 30 }}>
              {filtered.map((d, i) => {
                const clickable = rightMode === 'detail' && d.nmwr !== undefined;
                const isSelected = rightMode === 'detail' && d.agent === detailAgent;
                return (
                  <div
                    key={i}
                    onClick={clickable ? () => setSelectedAgent(d.agent) : undefined}
                    className={`flex-1 flex items-center justify-end gap-1.5 text-[11px] font-bold ${clickable ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-500/15' : i === hoveredIndex ? 'bg-white/[0.04]' : ''}`}
                  >
                    {d.nmwr !== undefined
                      ? <>
                          <span className={d.nmwr >= 55 ? 'text-green-400' : d.nmwr <= 45 ? 'text-red-400' : 'text-gray-300'}>NMWR {d.nmwr}%</span>
                          <span className="text-gray-500 font-normal">({d.nonMirrorPlayed ?? 0})</span>
                        </>
                      : <span className="text-gray-600">—</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right half — Compositions or NMWR Detail */}
        <div className="flex-1 min-w-0 bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          {rightMode === 'detail' ? (
            !detailAgent ? (
              <p className="text-gray-600 text-sm">Click an agent to see its non-mirror matches</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {agentImages[detailAgent] && <img src={agentImages[detailAgent]} alt={detailAgent} className="w-6 h-6 rounded" />}
                  <span className="font-bold text-white">{detailAgent}</span>
                  {(() => {
                    const nmwr = filtered.find(d => d.agent === detailAgent)?.nmwr;
                    return nmwr !== undefined && (
                      <span className={`font-bold text-sm ${nmwr >= 55 ? 'text-green-400' : nmwr <= 45 ? 'text-red-400' : 'text-gray-300'}`}>NMWR {nmwr}%</span>
                    );
                  })()}
                  <span className="text-gray-500 text-xs">
                    {matchList.length} non-mirror · {matchList.filter(m => m.won).length}W-{matchList.filter(m => !m.won).length}L
                  </span>
                </div>
                {mapWL.length > 0 && (
                  <div className="bg-[#1a1d23] rounded-lg border border-gray-800 p-3">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={mapWL} margin={{ top: 20, right: 8, left: 0, bottom: 0 }} stackOffset="sign">
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d3139" />
                        <XAxis
                          type="category"
                          dataKey="map"
                          stroke="#6b7280"
                          fontSize={10}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          type="number"
                          stroke="#6b7280"
                          fontSize={10}
                          tickLine={false}
                          allowDecimals={false}
                          tickFormatter={(v) => String(Math.abs(v))}
                        />
                        <Tooltip content={<MapWLTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <ReferenceLine y={0} stroke="#4b5563" />
                        <Bar dataKey="wins" stackId="wl" fill="#22c55e" maxBarSize={48}>
                          <LabelList
                            dataKey="wins"
                            position="top"
                            content={(props: any) => {
                              const { x, y, width, index } = props;
                              const d = mapWL[index];
                              if (!d) return null;
                              return (
                                <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="#9ca3af" fontSize={10} fontWeight="bold">
                                  {d.nmwr}% ({d.wins}-{-d.losses})
                                </text>
                              );
                            }}
                          />
                        </Bar>
                        <Bar dataKey="losses" stackId="wl" fill="#fca5a5" maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {matchList.length === 0 ? (
                  <p className="text-gray-600 text-sm">No matches in scope</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {matchList.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 py-1 border-b border-gray-800/60 last:border-0">
                        <span className={`text-[11px] font-bold w-5 shrink-0 ${m.won ? 'text-green-400' : 'text-red-400'}`}>{m.won ? 'W' : 'L'}</span>
                        <span className="text-[11px] font-bold text-blue-400 w-[70px] shrink-0 truncate" title={m.map}>{m.map}</span>
                        <div className="w-[135px] shrink-0 flex justify-end">
                          <CompositionIcons composition={m.composition.join(', ')} agentImages={agentImages} />
                        </div>
                        <span className="text-xs text-gray-200 shrink-0 w-[150px] truncate text-center" title={`${m.team} vs ${m.opponent}`}>
                          {m.team} <span className="text-gray-600">vs</span> {m.opponent}
                        </span>
                        <div className="w-[135px] shrink-0 flex justify-start">
                          <CompositionIcons composition={m.oppComposition.join(', ')} agentImages={agentImages} />
                        </div>
                        {m.url
                          ? <a href={m.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[11px] font-bold text-blue-400 hover:text-blue-300 shrink-0">{formatDateDMY(m.date) ?? m.date} ↗</a>
                          : <span className="ml-auto text-[11px] text-gray-400 shrink-0">{formatDateDMY(m.date) ?? m.date}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : (() => {
            // Normalize to grouped format in both cases
            const groups: { map: string; comps: CompositionStat[] }[] = single
              ? [{ map: single, comps: compositionPanel as CompositionStat[] }]
              : compositionPanel as { map: string; comps: CompositionStat[] }[];

            if (groups.length === 0 || groups.every(g => g.comps.length === 0)) {
              return <p className="text-gray-600 text-sm">No data available</p>;
            }

            return (
              <div className="flex flex-col gap-4">
                {groups.map(({ map, comps }) => (
                  <div key={map} className="flex gap-3">
                    {/* Map column */}
                    <div className="flex flex-col items-center gap-1 w-[100px] shrink-0">
                      {mapImages[map] && (
                        <img src={mapImages[map]} alt={map} className="w-[100px] h-[55px] object-cover rounded opacity-80" />
                      )}
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide text-center leading-tight">{map}</span>
                      {/* Stats below map image only when a single map is selected */}
                      {single && mapFullStats[map] && (() => {
                        const s = mapFullStats[map];
                        const atk = s.attTotal > 0 ? Math.round(s.attWins / s.attTotal * 100) : 0;
                        const def = s.defTotal > 0 ? Math.round(s.defWins / s.defTotal * 100) : 0;
                        return (
                          <div className="flex flex-col items-center gap-0.5 w-full mt-1">
                            <span className="text-[11px] font-bold text-green-400">ATK {atk}%</span>
                            <span className="text-[11px] font-bold text-red-400">DEF {def}%</span>
                            <span className="text-[10px] text-gray-400">P {s.picks} · B {s.bans}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Compositions column */}
                    <div className="flex flex-col gap-1.5 justify-center flex-1 min-w-0">
                      {comps.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5 flex-wrap">
                          <CompositionIcons composition={c.composition} agentImages={agentImages} />
                          <span className="text-gray-500 text-xs shrink-0">({c.played})</span>
                          {single && c.winRate !== undefined && (
                            <span className={`text-xs font-bold shrink-0 ${c.winRate >= 55 ? 'text-green-400' : c.winRate <= 45 ? 'text-red-400' : 'text-gray-300'}`}>
                              {c.winRate}% WR
                            </span>
                          )}
                          {single && c.teams && c.teams.length > 0 && (
                            <span className="text-[10px] text-gray-400 leading-tight">
                              {c.teams.map((t, j) => (
                                <span key={j}>
                                  {j > 0 && <span className="text-gray-600">, </span>}
                                  {t.team} <span className="text-gray-600">({t.played})</span>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {/* Stats column (grouped view only) */}
                    {!single && mapFullStats[map] && (() => {
                      const s = mapFullStats[map];
                      const atk = s.attTotal > 0 ? Math.round(s.attWins / s.attTotal * 100) : 0;
                      const def = s.defTotal > 0 ? Math.round(s.defWins / s.defTotal * 100) : 0;
                      return (
                        <div className="flex flex-col justify-center gap-1 shrink-0">
                          <span className="text-[12.5px] font-bold text-green-400">ATK {atk}%</span>
                          <span className="text-[12.5px] font-bold text-red-400">DEF {def}%</span>
                          <span className="text-[12.5px] text-gray-400">Picks {s.picks} · Bans {s.bans}</span>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
