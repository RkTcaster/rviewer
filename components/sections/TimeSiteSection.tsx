'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { TimeSiteData, TimeSiteRound, STATS_RANK_DEFAULT_TEAMS } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { useUrlSet } from '@/hooks/useUrlSet';
import { TeamChipsPanel } from '../TeamChipsPanel';
import { Tooltip } from '../Tooltip';

interface Props {
  stats: TimeSiteData['stats'] | null;
  maps: string[];
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
  hasTour?: boolean;
  defaultHiddenMaps?: string[];
}

type Side = 'all' | 'atk' | 'def';
const SIDES: { key: Side; label: string }[] = [
  { key: 'all', label: 'Both' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
];

// Plant speed buckets, in seconds into the round
const FAST_MAX = 30;
const SLOW_MIN = 60;

// A team's rounds on the visible maps, reduced to what the columns read
type Agg = {
  rounds: number;          // rounds the plant columns are counted over
  plants: number[];        // plant times
  sites: Record<string, number>;
  fbRounds: number;        // rounds the first-blood columns are counted over
  fb: number[];            // first kill times, whoever made it
  fk: number[];            // first kill times when the team made it
  fd: number[];            // first kill times when the team took it
  fbToPlant: number[];     // plant time minus first kill time, first kill before the plant
};

// A column is either a % (frac) or a time in seconds (times + how to reduce them)
type Col = { key: string; label: string } &
  ({ frac: (a: Agg) => [number, number]; times?: never; stat?: never }
    | { times: (a: Agg) => number[]; stat: 'avg' | 'median'; frac?: never });

const BASE_COLS: Col[] = [
  { key: 'plantRate', label: 'Plant rate',   frac: a => [a.plants.length, a.rounds] },
  { key: 'avgPlant',  label: 'Avg plant',    times: a => a.plants, stat: 'avg' },
  { key: 'medPlant',  label: 'Median plant', times: a => a.plants, stat: 'median' },
  { key: 'fast',      label: `Fast <${FAST_MAX}s`, frac: a => [a.plants.filter(t => t < FAST_MAX).length, a.plants.length] },
  { key: 'mid',       label: `Mid ${FAST_MAX}-${SLOW_MIN}s`, frac: a => [a.plants.filter(t => t >= FAST_MAX && t <= SLOW_MIN).length, a.plants.length] },
  { key: 'slow',      label: `Slow >${SLOW_MIN}s`, frac: a => [a.plants.filter(t => t > SLOW_MIN).length, a.plants.length] },
];
const FB_COLS: Col[] = [
  { key: 'avgFb',     label: 'Avg FB',       times: a => a.fb, stat: 'avg' },
  { key: 'medFb',     label: 'Median FB',    times: a => a.fb, stat: 'median' },
  { key: 'avgFk',     label: 'Avg FK time',  times: a => a.fk, stat: 'avg' },
  { key: 'avgFd',     label: 'Avg FD time',  times: a => a.fd, stat: 'avg' },
  { key: 'fbToPlant', label: 'FB → plant',   times: a => a.fbToPlant, stat: 'avg' },
];

function reduceTimes(ts: number[], stat: 'avg' | 'median'): number | null {
  if (ts.length === 0) return null;
  if (stat === 'avg') return ts.reduce((s, t) => s + t, 0) / ts.length;
  const sorted = [...ts].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct([n, d]: [number, number]): number | null {
  return d === 0 ? null : Math.round((n / d) * 100);
}

// Sort value: the % for a ratio column, the seconds for a time column (null without data)
function colValue(col: Col, a: Agg): number | null {
  return col.frac ? pct(col.frac(a)) : reduceTimes(col.times(a), col.stat);
}

// Gradient background by % (same palette as Operator Use)
function heatmapBg(pct: number | null): string {
  if (pct === null) return 'transparent';
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 220 - t * 80;
  const sat = 55;
  const light = 18 + t * 28;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function legend() {
  return (
    <dl className="w-[360px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
      <div>
        <dt className="font-bold text-gray-100">Rounds counted</dt>
        <dd className="text-gray-400">Every round, pistols included. Times are seconds into the round.</dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Whose plant</dt>
        <dd className="text-gray-400">
          The plant columns always count the attacker&apos;s plant. ATK and Both show the team&apos;s own
          plants; DEF shows the rival&apos;s plants against the team.
        </dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Plant rate</dt>
        <dd className="text-gray-400">Rounds with a plant over rounds counted.</dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Avg plant / Median plant</dt>
        <dd className="text-gray-400">When the spike went down, over the rounds with a plant.</dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Fast / Mid / Slow</dt>
        <dd className="text-gray-400">
          Share of plants before {FAST_MAX}s, from {FAST_MAX}s to {SLOW_MIN}s, and after {SLOW_MIN}s. They add up to 100%.
        </dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Sites</dt>
        <dd className="text-gray-400">
          Share of plants on each site. Only with a single map on, since A on one map is not A on another.
        </dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Avg FB / Median FB</dt>
        <dd className="text-gray-400">
          When the round&apos;s first kill happened, whoever made it. These follow the side buttons over
          every round of that side.
        </dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Avg FK time / Avg FD time</dt>
        <dd className="text-gray-400">The same time, split by whether the team made the first kill or took it.</dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">FB → plant</dt>
        <dd className="text-gray-400">
          Seconds from the first kill to the plant, in rounds with a plant where the first kill came before it.
        </dd>
      </div>
      <div>
        <dt className="font-bold text-gray-100">Detail info</dt>
        <dd className="text-gray-400">Adds the counts under each %, and the number of rounds under each time.</dd>
      </div>
    </dl>
  );
}

export function TimeSiteSection({ stats, maps, teamLogos = {}, teamRegions = {}, mapImages = {}, hasTour = false, defaultHiddenMaps = [] }: Props) {
  const { navigate } = useNavigation();
  const [side, setSide] = useState<Side>('all');
  const [showDetail, setShowDetail] = useState(false);
  const [sortCol, setSortCol] = useState('plantRate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const data = stats ?? {};
  const allTeams = Object.keys(data).sort();
  const [selectedTeams, setSelectedTeams] = useUrlSet('teams', allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t)));
  const baseTeams = allTeams.filter(t => selectedTeams.has(t));

  // Hidden maps: not columns, they filter which rounds are summed per team
  const [hiddenMaps, setHiddenMaps] = useUrlSet('hideMaps', maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase())));
  const visibleMaps = maps.filter(m => !hiddenMaps.has(m));
  const singleMap = visibleMaps.length === 1 ? visibleMaps[0] : null;

  function toggleMap(map: string) {
    setHiddenMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });
  }

  function resetFilters() {
    setSelectedTeams(new Set(allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setHiddenMaps(new Set(maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase()))));
    setSide('all');
    setSortCol('plantRate');
    setSortDir('desc');
    navigate('?section=time-site');
  }

  if (allTeams.length === 0 || maps.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        {hasTour ? 'No round data for the selected filters' : 'Select a tournament to see Time & Site...'}
      </div>
    );
  }

  // A team's rounds on the visible maps. Plant columns read the attack rounds (DEF: the rival's
  // attack), first-blood columns the rounds of the chosen side
  function aggregate(team: string): Agg {
    const plantRounds: TimeSiteRound[] = [];
    const fbRounds: TimeSiteRound[] = [];
    for (const m of visibleMaps) {
      const s = data[team]?.[m];
      if (!s) continue;
      plantRounds.push(...(side === 'def' ? s.def : s.atk));
      if (side !== 'def') fbRounds.push(...s.atk);
      if (side !== 'atk') fbRounds.push(...s.def);
    }
    const agg: Agg = { rounds: plantRounds.length, plants: [], sites: {}, fbRounds: fbRounds.length, fb: [], fk: [], fd: [], fbToPlant: [] };
    for (const r of plantRounds) {
      if (r.plantT === null) continue;
      agg.plants.push(r.plantT);
      if (r.site) agg.sites[r.site] = (agg.sites[r.site] ?? 0) + 1;
      if (r.fbT !== null && r.fbT <= r.plantT) agg.fbToPlant.push(r.plantT - r.fbT);
    }
    for (const r of fbRounds) {
      if (r.fbT === null) continue;
      agg.fb.push(r.fbT);
      if (r.fbOwn === true) agg.fk.push(r.fbT);
      else if (r.fbOwn === false) agg.fd.push(r.fbT);
    }
    return agg;
  }

  const totals = Object.fromEntries(baseTeams.map(t => [t, aggregate(t)]));

  // Site columns: the sites any shown team planted on the single visible map
  const siteKeys = singleMap
    ? [...new Set(baseTeams.flatMap(t => Object.keys(totals[t].sites)))].sort()
    : [];
  const siteCols: Col[] = siteKeys.map(s => ({
    key: `site:${s}`, label: `Site ${s}`, frac: a => [a.sites[s] ?? 0, a.plants.length],
  }));
  const cols = [...BASE_COLS, ...siteCols, ...FB_COLS];

  const sortColDef = cols.find(c => c.key === sortCol) ?? cols[0];
  const teams = [...baseTeams].sort((a, b) => {
    const valA = colValue(sortColDef, totals[a]);
    const valB = colValue(sortColDef, totals[b]);
    if (valA === null && valB === null) return 0;
    if (valA === null) return 1;
    if (valB === null) return -1;
    return sortDir === 'asc' ? valA - valB : valB - valA;
  });

  function handleColClick(col: string) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function pctCell(key: string, c: [number, number]) {
    const val = pct(c);
    return (
      <td
        key={key}
        className="py-3 px-3 text-center"
        style={{ backgroundColor: val !== null ? heatmapBg(val) : '#1a1d23' }}
      >
        {val !== null ? (
          <>
            <div className="text-sm font-bold text-gray-100">{val}%</div>
            {showDetail && (
              <div className="text-[13px] text-gray-200/80 whitespace-nowrap">{c[0]}/{c[1]}</div>
            )}
          </>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </td>
    );
  }

  function timeCell(key: string, ts: number[], stat: 'avg' | 'median') {
    const val = reduceTimes(ts, stat);
    return (
      <td key={key} className="py-3 px-3 text-center">
        {val !== null ? (
          <>
            <div className="text-sm font-bold text-gray-200">{val.toFixed(1)}s</div>
            {showDetail && (
              <div className="text-[13px] text-gray-400 whitespace-nowrap">{ts.length} rds</div>
            )}
          </>
        ) : (
          <span className="text-gray-700">—</span>
        )}
      </td>
    );
  }

  function cell(col: Col, a: Agg) {
    return col.frac ? pctCell(col.key, col.frac(a)) : timeCell(col.key, col.times(a), col.stat);
  }

  const headerCls = 'border-b border-gray-800 px-3 align-bottom pb-2 text-[11px] font-bold uppercase tracking-wide';

  return (
    <div className="flex flex-col gap-4">

      {/* Filters: teams on the left + maps on the right */}
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <TeamChipsPanel
          allTeams={allTeams}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          teamLogos={teamLogos}
          teamRegions={teamRegions}
        />

        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Maps</span>
          <div className="flex gap-2 px-1 overflow-x-auto">
            {maps.map(map => {
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
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-start items-center gap-3 px-1">
        <div className="flex gap-1.5">
          {SIDES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSide(key)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                side === key
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
        <Tooltip content={legend()} className="items-center">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-200 hover:text-white transition-colors cursor-help">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Legend
          </span>
        </Tooltip>
        {!singleMap && (
          <span className="text-[11px] text-gray-500">Turn on a single map to see plant sites</span>
        )}
      </div>

      {baseTeams.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Select at least one team to see Time &amp; Site...
        </div>
      ) : (
      <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800 overflow-auto max-h-[85vh] w-fit max-w-full">
        <table className="border-separate" style={{ borderSpacing: '1px 2px' }}>
          <thead className="bg-[#0f1115] sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-10 bg-[#0f1115] border-b border-gray-800 w-8 text-center align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500" style={{ minWidth: 32 }}>
                #
              </th>
              <th className="sticky left-8 z-10 bg-[#0f1115] border-b border-r border-gray-800 px-5 text-left align-bottom pb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">
                Team
              </th>
              {cols.map(({ key, label }) => {
                const isActive = sortColDef.key === key;
                return (
                  <th
                    key={key}
                    onClick={() => handleColClick(key)}
                    className={`${headerCls} cursor-pointer select-none transition-colors hover:bg-[#252a33] whitespace-nowrap ${isActive ? 'bg-[#1e2430]' : ''}`}
                    style={{ minWidth: 88 }}
                  >
                    <div className="flex flex-col items-center justify-end gap-1">
                      <span className={isActive ? 'text-blue-400' : 'text-gray-400'}>{label}</span>
                      <span className={`text-[9px] ${isActive ? 'text-blue-400' : 'text-gray-600'}`}>
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
                <td className="sticky left-0 z-10 bg-[#1a1d23] w-8 text-center py-3 text-[11px] font-bold text-gray-600" style={{ minWidth: 32 }}>
                  {rank + 1}
                </td>
                <td className="sticky left-8 z-10 bg-[#1a1d23] px-5 py-3 text-[11px] font-bold text-gray-300 border-r border-gray-800 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {teamLogos[team] && (
                      <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />
                    )}
                    {team}
                  </div>
                </td>
                {cols.map(col => cell(col, totals[team]))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
