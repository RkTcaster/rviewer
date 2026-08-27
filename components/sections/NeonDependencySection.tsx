'use client';

import { useState } from 'react';
import { Check, Info, Minus, X } from 'lucide-react';
import { DuoMapStat, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { Tooltip } from '../Tooltip';

interface Props {
  stats: Record<string, Record<string, DuoMapStat>>;
  maps: string[];
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
  defaultHiddenMaps?: string[];
}

const REGION_ROWS: { id: string; label: string }[] = [
  { id: 'reg_0', label: 'Americas' },
  { id: 'reg_1', label: 'EMEA' },
  { id: 'reg_2', label: 'China' },
  { id: 'reg_3', label: 'Pacific' },
];

// Duo % = maps where the team fielded Neon and Phoenix together / times it played the map
function duoPct(s: DuoMapStat | undefined): number | null {
  if (!s || s.played === 0) return null;
  return Math.round((s.duo / s.played) * 100);
}

// Raw sum of several cells: the aggregate row adds the counters and divides once, rather than
// averaging each team's percentage, so teams that played more maps weigh more.
function sumDuoStats(list: (DuoMapStat | undefined)[]): DuoMapStat {
  let played = 0, duo = 0, duoWins = 0;
  for (const s of list) {
    if (!s) continue;
    played += s.played; duo += s.duo; duoWins += s.duoWins;
  }
  return { played, duo, duoWins };
}

// Win rate on the maps where the duo was actually fielded. Null when it never was.
function duoWinPct(s: DuoMapStat | undefined): number | null {
  if (!s || s.duo === 0) return null;
  return Math.round((s.duoWins / s.duo) * 100);
}

// Win rate with the duo, rendered right of the agent icons. Nothing to show when the duo
// was never fielded; the title carries the raw W-L so the % is never read without its sample.
// labelTone: the map cells sit on the heatmap, where grey washes out against the lighter greens.
function winLabel(s: DuoMapStat, labelTone = 'text-gray-400') {
  const pct = duoWinPct(s);
  if (pct === null) return null;
  const tone = pct > 50 ? 'text-green-300' : pct < 50 ? 'text-red-300' : 'text-gray-200/80';
  return (
    <span className={`font-bold ${tone}`} title={`${s.duoWins}W-${s.duo - s.duoWins}L with the duo`}>
      <span className={`font-normal ${labelTone}`}>WR </span>{pct}%
    </span>
  );
}

// The duo's agent icons, shown instead of a "duo" label. Paths mirror agent_info.agent_path,
// hardcoded like the agents themselves so the section needs no agentImages prop.
const DUO_ICONS = (
  <span className="inline-flex items-center gap-0.5 align-middle">
    <img src="/agents/neon.png" alt="Neon" title="Neon" className="w-4 h-4 object-contain shrink-0" />
    <img src="/agents/phoenix.png" alt="Phoenix" title="Phoenix" className="w-4 h-4 object-contain shrink-0" />
  </span>
);

// What every encoded element of this table means. Local on purpose: the copy describes this
// table's rules (duo %, WR sample, tick thresholds) and is not reusable anywhere else.
const LEGEND = (
  <dl className="w-[340px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
    <div>
      <dt className="font-bold text-gray-100">Cell %  —  duo usage, not win rate</dt>
      <dd className="text-gray-400">
        Maps where the team fielded Neon <b>and</b> Phoenix at the same time, over maps played.
        The cell background is a heatmap of that same %.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Detail info</dt>
      <dd className="text-gray-400">
        Reveals <span className="text-gray-200">duo/played</span>, the two agent icons with the
        duo count, and <span className="text-gray-200">WR</span>.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">WR  —  win rate on the duo maps only</dt>
      <dd className="text-gray-400">
        Not the team&apos;s overall win rate. Hover the number for the raw W-L: with 4 or 5 maps,
        a 60% is 3W-2L.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">
        <Check className="inline w-3 h-3 text-green-400" strokeWidth={3} />
        <Minus className="inline w-3 h-3 text-yellow-400" strokeWidth={3} />
        <X className="inline w-3 h-3 text-red-400" strokeWidth={3} />
        <span className="ml-1">in Overall</span>
      </dt>
      <dd className="text-gray-400">
        Duo usage per map: over 60% / 40-60% / under 40%. Grey when the team never played it.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">All row</dt>
      <dd className="text-gray-400">
        Raw sum of the selected teams — totals added, then divided once. It changes as you
        toggle chips.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Region logos</dt>
      <dd className="text-gray-400">Click one to add or remove that whole region.</dd>
    </div>
  </dl>
);

// Per-map summary icon, same rules as Maps Rank: green >60, yellow 40-60, red <40, grey when no data
function mapTick(pct: number | null, key: string) {
  const cls = 'w-3 h-3 shrink-0';
  if (pct === null) return <Minus key={key} className={`${cls} text-gray-600`} strokeWidth={3} />;
  if (pct > 60)     return <Check key={key} className={`${cls} text-green-400`} strokeWidth={3} />;
  if (pct < 40)     return <X     key={key} className={`${cls} text-red-400`} strokeWidth={3} />;
  return            <Minus key={key} className={`${cls} text-yellow-400`} strokeWidth={3} />;
}

// Fondo en gradiente según % (misma paleta que Playoff % / Maps Masters)
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

export function NeonDependencySection({ stats, maps, teamLogos = {}, teamRegions = {}, mapImages = {}, defaultHiddenMaps = [] }: Props) {
  const { navigate } = useNavigation();
  const [sortCol, setSortCol] = useState<number | 'overall' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showDetail, setShowDetail] = useState(false);

  const allTeams = Object.keys(stats).sort();
  // Por defecto se muestran solo los equipos de STATS_RANK_DEFAULT_TEAMS (el resto ocultos)
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(
    () => new Set(allTeams.filter(t => !STATS_RANK_DEFAULT_TEAMS.includes(t)))
  );

  const baseTeams = allTeams.filter(t => !hiddenTeams.has(t));
  const allTeamsSelected = hiddenTeams.size === 0;

  // Por defecto ocultos los mapas fuera de rotación (in_rotation en maps_name_ids)
  const [hiddenMaps, setHiddenMaps] = useState<Set<string>>(
    () => new Set(maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase())))
  );
  const visibleMaps = maps.filter(m => !hiddenMaps.has(m));

  function toggleTeam(team: string) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  // Region logo acts as a bulk toggle for its row: clears the whole region when every team in
  // it is already on, otherwise turns them all on.
  function toggleRegionTeams(rowTeams: string[]) {
    setHiddenTeams(prev => {
      const next = new Set(prev);
      const allVisible = rowTeams.every(t => !next.has(t));
      for (const t of rowTeams) {
        if (allVisible) next.add(t); else next.delete(t);
      }
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
    navigate('?section=neon-dependency');
  }

  // Guarded on allTeams, not baseTeams: hiding every team must still render the chips so the
  // selection can be undone. Only a lack of data replaces the whole section with the placeholder.
  if (allTeams.length === 0 || maps.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select a region and tournament to see the maps...
      </div>
    );
  }

  // Overall duo usage per team: total maps with the duo / total maps played (across every map)
  function overallUsage(team: string): DuoMapStat {
    const byMap = stats[team];
    if (!byMap) return { played: 0, duo: 0, duoWins: 0 };
    let played = 0, duo = 0, duoWins = 0;
    for (const m in byMap) { played += byMap[m].played; duo += byMap[m].duo; duoWins += byMap[m].duoWins; }
    return { played, duo, duoWins };
  }

  // Valores por columna (mapa visible) para colorear best/worst — siempre sobre el orden base
  const mapAllValues = visibleMaps.map(m => baseTeams.map(t => duoPct(stats[t]?.[m])));

  const teams = (sortCol === null || (typeof sortCol === 'number' && sortCol >= visibleMaps.length))
    ? baseTeams
    : [...baseTeams].sort((a, b) => {
        const valA = sortCol === 'overall' ? duoPct(overallUsage(a)) : duoPct(stats[a]?.[visibleMaps[sortCol]]);
        const valB = sortCol === 'overall' ? duoPct(overallUsage(b)) : duoPct(stats[b]?.[visibleMaps[sortCol]]);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return sortDir === 'asc' ? valA - valB : valB - valA;
      });

  function handleColClick(col: number | 'overall') {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Filtros: equipos (por región) a la izquierda + mapas a la derecha */}
      {(() => {
        const renderTeamChip = (team: string) => {
          const active = !hiddenTeams.has(team);
          const logo = teamLogos[team];
          return (
            <button
              key={team}
              onClick={() => toggleTeam(team)}
              className={`w-[58px] flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg text-[12.8px] font-bold uppercase tracking-wide transition-colors border ${
                active
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {logo && (
                <img
                  src={logo}
                  alt={team}
                  className={`w-5 h-5 object-contain shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
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
              className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
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
        const rows: { label: string; logo: string | null; teams: string[] }[] = REGION_ROWS.map(r => ({
          label: r.label,
          logo: `/region/${r.label.toLowerCase()}.png`,
          teams: allTeams.filter(t => teamRegions[t] === r.id),
        }));
        const otherTeams = allTeams.filter(t => !knownRegions.has(teamRegions[t]));
        if (otherTeams.length > 0) rows.push({ label: 'Other', logo: null, teams: otherTeams });
        const visibleRows = rows.filter(row => row.teams.length > 0);

        return (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {/* Teams — columna izquierda */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Teams</span>
                <button
                  onClick={() => setHiddenTeams(allTeamsSelected ? new Set(allTeams) : new Set())}
                  className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                >
                  {allTeamsSelected ? 'Clear' : 'Add all'}
                </button>
                <span className="text-[10px] text-gray-600">
                  Click a region logo to add / remove all teams from that region
                </span>
              </div>
              <div className="flex flex-col gap-2 px-1">
                {visibleRows.map(row => (
                  <div key={row.label} className="flex items-center gap-3">
                    {(() => {
                      // The logo replaces the name; 'Other' has no logo and falls back to text.
                      // Dimmed like an inactive chip when no team of the row is selected.
                      const anyVisible = row.teams.some(t => !hiddenTeams.has(t));
                      return (
                        <button
                          onClick={() => toggleRegionTeams(row.teams)}
                          title={`${row.label} — select / clear the whole region`}
                          className={`w-12 shrink-0 flex items-center justify-start text-[10px] font-bold uppercase tracking-widest transition-opacity hover:opacity-100 ${
                            anyVisible ? 'text-gray-400' : 'text-gray-600 opacity-50'
                          }`}
                        >
                          {row.logo
                            ? <img src={row.logo} alt={row.label} className={`w-[30px] h-[30px] object-contain shrink-0 transition-all ${anyVisible ? '' : 'grayscale'}`} />
                            : row.label}
                        </button>
                      );
                    })()}
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
              <div className="flex gap-2 px-1 overflow-x-auto">
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
        <Tooltip content={LEGEND} className="items-center">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-200 hover:text-white transition-colors cursor-help">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Legend
          </span>
        </Tooltip>
        <button
          onClick={resetFilters}
          className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
        >
          Reset filters
        </button>
      </div>

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
                const isActive = sortCol === 'overall';
                return (
                  <th
                    onClick={() => handleColClick('overall')}
                    className={`border-b border-r border-gray-800 cursor-pointer select-none transition-colors hover:bg-[#252a33] px-3 align-bottom pb-2 ${isActive ? 'bg-[#1e2430]' : 'bg-[#0f1115]'}`}
                    style={{ minWidth: 72 }}
                  >
                    <div className="flex flex-col items-center justify-end gap-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide text-center leading-tight ${isActive ? 'text-blue-400' : 'text-amber-400'}`}>
                        Overall<br />Usage
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
            {/* Aggregate row: raw sum over the visible teams. Pinned above them and outside the
                sort, and excluded from mapAllValues so it never counts as a column's best/worst. */}
            {(() => {
              const tot = sumDuoStats(baseTeams.map(t => overallUsage(t)));
              const val = duoPct(tot);
              const mapTotals = visibleMaps.map(m => sumDuoStats(baseTeams.map(t => stats[t]?.[m])));
              return (
                <tr className="border-b-2 border-gray-700">
                  <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 py-3" />
                  <td className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-black uppercase tracking-widest text-gray-100 border-r border-gray-800 whitespace-nowrap" style={{ width: '1%' }}>
                    All
                  </td>
                  <td className="py-3 px-3 text-center border-r border-gray-800" style={{ minWidth: 72 }}>
                    {val !== null ? (
                      <div className="text-sm font-bold" style={{ color: heatmapBg(val) }}>
                        {val}%
                        {showDetail && <span className="text-gray-200/80 font-normal whitespace-nowrap"> {tot.duo}/{tot.played} {DUO_ICONS} {winLabel(tot)}</span>}
                      </div>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                    {showDetail && (
                      <div className="flex flex-wrap justify-center items-center gap-0.5 mt-1">
                        {mapTotals.map((mt, mi) => mapTick(duoPct(mt), visibleMaps[mi]))}
                      </div>
                    )}
                  </td>
                  {mapTotals.map((mt, mi) => {
                    const v = duoPct(mt);
                    return (
                      <td
                        key={visibleMaps[mi]}
                        className="py-3 px-3 text-center"
                        style={{ minWidth: 64, backgroundColor: v !== null ? heatmapBg(v) : '#1a1d23' }}
                      >
                        {v !== null ? (
                          <>
                            <div className="text-sm font-bold text-gray-100">
                              {v}%
                              {showDetail && <span className="text-gray-200/80 font-normal whitespace-nowrap"> {mt.duo}/{mt.played}</span>}
                            </div>
                            {showDetail && (
                              <div className="flex items-center justify-center gap-1 text-[13px] text-gray-200/80 whitespace-nowrap">
                                {mt.duo} {DUO_ICONS} {winLabel(mt, 'text-white')}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })()}
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
                  const ov = overallUsage(team);
                  const val = duoPct(ov);
                  return (
                    <td
                      className="py-3 px-3 text-center border-r border-gray-800"
                      style={{ minWidth: 72 }}
                    >
                      {val !== null ? (
                        <div className="text-sm font-bold" style={{ color: heatmapBg(val) }}>
                          {val}%
                          {showDetail && (
                            <span className="text-gray-200/80 font-normal whitespace-nowrap"> {ov.duo}/{ov.played} {DUO_ICONS} {winLabel(ov)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                      {showDetail && (
                        <div className="flex flex-wrap justify-center items-center gap-0.5 mt-1">
                          {visibleMaps.map(m => mapTick(duoPct(stats[team]?.[m]), m))}
                        </div>
                      )}
                    </td>
                  );
                })()}
                {visibleMaps.map((m, mi) => {
                  const wl = stats[team]?.[m];
                  const val = duoPct(wl);
                  const color = getCellColor(val, mapAllValues[mi]);
                  const cellRank = getCellRank(val, mapAllValues[mi]);
                  const isActive = sortCol === mi;
                  const ringColor =
                    cellRank === 'best' ? 'rgba(74,222,128,0.9)' :
                    cellRank === 'worst' ? '#181938' :
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
                            {showDetail && <span className="text-gray-200/80 font-normal whitespace-nowrap"> {wl.duo}/{wl.played}</span>}
                          </div>
                          {showDetail && (
                            <div className="flex items-center justify-center gap-1 text-[13px] text-gray-200/80 whitespace-nowrap">
                              {wl.duo} {DUO_ICONS} {winLabel(wl, 'text-white')}
                            </div>
                          )}
                        </>
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
    </div>
  );
}
