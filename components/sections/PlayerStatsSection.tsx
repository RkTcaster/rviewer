'use client';

import { useState } from 'react';
import { PlayerMatchPoint, PlayerStat, PlayerTimelineData, TournamentPlayerAvg } from '@/lib/types';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

type StatKey = 'kd' | 'rating' | 'acs' | 'adr' | 'hs' | 'fkfd' | 'kast';
type SideKey = 'both' | 'atk' | 'def';

interface StatCfg {
  label: string;
  decimals: number;
  both: (s: PlayerStat) => number;
  atk:  (s: PlayerStat) => number;
  def:  (s: PlayerStat) => number;
  taBoth: (ta: TournamentPlayerAvg) => number;
  taAtk:  (ta: TournamentPlayerAvg) => number;
  taDef:  (ta: TournamentPlayerAvg) => number;
}

const STAT_CONFIG: Record<StatKey, StatCfg> = {
  kd: {
    label: 'K/D', decimals: 2,
    both: s => s.kd,        atk: s => s.kdAtk,       def: s => s.kdDef,
    taBoth: t => t.kd,      taAtk: t => t.kdAtk,     taDef: t => t.kdDef,
  },
  rating: {
    label: 'Rating', decimals: 2,
    both: s => s.rating,    atk: s => s.ratingAtk,   def: s => s.ratingDef,
    taBoth: t => t.rating,  taAtk: t => t.ratingAtk, taDef: t => t.ratingDef,
  },
  acs: {
    label: 'ACS', decimals: 0,
    both: s => s.acs,       atk: s => s.acsAtk,      def: s => s.acsDef,
    taBoth: t => t.acs,     taAtk: t => t.acsAtk,    taDef: t => t.acsDef,
  },
  adr: {
    label: 'ADR', decimals: 0,
    both: s => s.adr,       atk: s => s.adrAtk,      def: s => s.adrDef,
    taBoth: t => t.adr,     taAtk: t => t.adrAtk,    taDef: t => t.adrDef,
  },
  hs: {
    label: 'HS%', decimals: 1,
    both: s => s.hs * 100,       atk: s => s.hsAtk * 100,      def: s => s.hsDef * 100,
    taBoth: t => t.hs * 100,     taAtk: t => t.hsAtk * 100,    taDef: t => t.hsDef * 100,
  },
  fkfd: {
    label: 'FK-FD', decimals: 2,
    both: s => s.fkfd,           atk: s => s.fkfdAtk,          def: s => s.fkfdDef,
    taBoth: t => t.fkfd,         taAtk: t => t.fkfdAtk,        taDef: t => t.fkfdDef,
  },
  kast: {
    label: 'KAST%', decimals: 1,
    both: s => s.kast * 100,     atk: s => s.kastAtk * 100,    def: s => s.kastDef * 100,
    taBoth: t => t.kast * 100,   taAtk: t => t.kastAtk * 100,  taDef: t => t.kastDef * 100,
  },
};

const STAT_ORDER: StatKey[] = ['kd', 'rating', 'acs', 'adr', 'hs', 'fkfd', 'kast'];
const PLAYER_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fb923c', '#a78bfa'];

function resolveValue(m: PlayerMatchPoint, stat: StatKey, side: SideKey): number {
  if (stat === 'kd')     return side === 'both' ? m.kd     : side === 'atk' ? m.kdAtk     : m.kdDef;
  if (stat === 'rating') return side === 'both' ? m.rating : side === 'atk' ? m.ratingAtk : m.ratingDef;
  if (stat === 'acs')    return side === 'both' ? m.acs    : side === 'atk' ? m.acsAtk    : m.acsDef;
  if (stat === 'adr')    return side === 'both' ? m.adr    : side === 'atk' ? m.adrAtk    : m.adrDef;
  if (stat === 'fkfd')   return side === 'both' ? m.fkfd   : side === 'atk' ? m.fkfdAtk   : m.fkfdDef;
  if (stat === 'kast')   return (side === 'both' ? m.kast  : side === 'atk' ? m.kastAtk   : m.kastDef) * 100;
  return (side === 'both' ? m.hs : side === 'atk' ? m.hsAtk : m.hsDef) * 100;
}

const abbrev = (name: string) => name.length > 12 ? name.slice(0, 11) + '…' : name;

function KpiCard({ title, both, atk, def, decimals }: { title: string; both: number; atk: number; def: number; decimals: number }) {
  return (
    <div className="bg-[#1a1d23] border border-gray-800 rounded-xl p-4 flex items-center gap-6">
      <div>
        <p className="text-[11px] text-gray-500 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-bold text-gray-100 mt-1">{both.toFixed(decimals)}</p>
      </div>
      <div className="h-10 w-px bg-gray-800" />
      <div>
        <p className="text-[11px] font-semibold" style={{ color: '#ef4444' }}>ATK</p>
        <p className="text-xl font-bold text-gray-100">{atk.toFixed(decimals)}</p>
      </div>
      <div className="h-10 w-px bg-gray-800" />
      <div>
        <p className="text-[11px] font-semibold" style={{ color: '#22c55e' }}>DEF</p>
        <p className="text-xl font-bold text-gray-100">{def.toFixed(decimals)}</p>
      </div>
    </div>
  );
}

export function PlayerStatsSection({
  stats,
  tournamentAvg,
  timeline,
}: {
  stats: PlayerStat[];
  tournamentAvg?: TournamentPlayerAvg | null;
  timeline: PlayerTimelineData;
}) {
  const [stat, setStat] = useState<StatKey>('kd');
  const [side, setSide] = useState<SideKey>('both');
  const cfg = STAT_CONFIG[stat];

  const allSeriesIds = [...new Set(timeline.flatMap(pt => pt.matches.map(m => m.seriesId)))];

  // Y axis domain fixed across all sides so switching Both/ATK/DEF doesn't rescale
  const allSideValues = timeline.flatMap(pt =>
    pt.matches.flatMap(m => (['both', 'atk', 'def'] as SideKey[]).map(s => resolveValue(m, stat, s)))
  ).filter(v => isFinite(v));
  const yMin = allSideValues.length ? Math.min(...allSideValues) : 0;
  const yMax = allSideValues.length ? Math.max(...allSideValues) : 1;
  const yPad = (yMax - yMin) * 0.1 || 0.1;
  const yDomain: [number, number] = [
    parseFloat((yMin - yPad).toFixed(cfg.decimals)),
    parseFloat((yMax + yPad).toFixed(cfg.decimals)),
  ];

  const tournAvgValue = tournamentAvg
    ? (() => {
        if (stat === 'kd')     return side === 'both' ? tournamentAvg.kd     : side === 'atk' ? tournamentAvg.kdAtk     : tournamentAvg.kdDef;
        if (stat === 'rating') return side === 'both' ? tournamentAvg.rating : side === 'atk' ? tournamentAvg.ratingAtk : tournamentAvg.ratingDef;
        if (stat === 'acs')    return side === 'both' ? tournamentAvg.acs    : side === 'atk' ? tournamentAvg.acsAtk    : tournamentAvg.acsDef;
        if (stat === 'adr')    return side === 'both' ? tournamentAvg.adr    : side === 'atk' ? tournamentAvg.adrAtk    : tournamentAvg.adrDef;
        return (side === 'both' ? tournamentAvg.hs : side === 'atk' ? tournamentAvg.hsAtk : tournamentAvg.hsDef) * 100;
      })()
    : null;

  const chartData = allSeriesIds.map(sid => {
    const point: Record<string, string | number | null> = {};
    for (const pt of timeline) {
      const m = pt.matches.find(x => x.seriesId === sid);
      if (!point.__label && m) {
        point.__label = abbrev(m.rival);
      }
      point[pt.player] = m != null ? resolveValue(m, stat, side) : null;
    }
    // Team avg for this match: average of all non-null player values
    const playerVals = timeline
      .map(pt => point[pt.player])
      .filter((v): v is number => v != null);
    point['Team Avg'] = playerVals.length
      ? Math.round((playerVals.reduce((a, b) => a + b, 0) / playerVals.length) * 100) / 100
      : null;
    if (tournAvgValue != null) point['Tourn. Avg'] = tournAvgValue;
    return point;
  });

  const mean = (fn: (s: PlayerStat) => number) => {
    if (!stats.length) return 0;
    const vals = stats.map(fn);
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Selectors */}
      <div className="flex flex-wrap items-center gap-2">
        {STAT_ORDER.map(key => (
          <button
            key={key}
            onClick={() => setStat(key)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
              stat === key
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-[#1a1d23] border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {STAT_CONFIG[key].label}
          </button>
        ))}
        <div className="flex gap-1 ml-auto">
          {(['both', 'atk', 'def'] as SideKey[]).map(s => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                side === s
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-[#1a1d23] border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              {s === 'both' ? 'Both' : s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      {stats.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <KpiCard
            title={`Team avg — ${cfg.label}`}
            both={mean(cfg.both)}
            atk={mean(cfg.atk)}
            def={mean(cfg.def)}
            decimals={cfg.decimals}
          />
          {tournamentAvg && (
            <KpiCard
              title={`Tournament avg — ${cfg.label}`}
              both={cfg.taBoth(tournamentAvg)}
              atk={cfg.taAtk(tournamentAvg)}
              def={cfg.taDef(tournamentAvg)}
              decimals={cfg.decimals}
            />
          )}
        </div>
      )}

      {/* Line chart */}
      {timeline.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] border border-dashed border-gray-700 rounded-xl text-gray-500 text-sm">
          Selecciona un equipo para ver la evolución por partido.
        </div>
      ) : (
        <div className="bg-[#1a1d23] border border-gray-800 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={438}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="__label"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                angle={-35}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(cfg.decimals)}
                domain={yDomain}
                width={48}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1d23', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#e5e7eb', fontWeight: 700 }}
                itemStyle={{ color: '#9ca3af' }}
                formatter={(value, name) => [value != null ? (value as number).toFixed(cfg.decimals) : '—', name ?? '']}
              />
              <Legend wrapperStyle={{ paddingTop: '12px', color: '#9ca3af', fontSize: '12px' }} />
              {timeline.map((pt, i) => (
                <Line
                  key={pt.player}
                  type="linear"
                  dataKey={pt.player}
                  stroke={PLAYER_COLORS[i % PLAYER_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 0, fill: PLAYER_COLORS[i % PLAYER_COLORS.length] }}
                  activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              ))}
              <Line
                type="linear"
                dataKey="Team Avg"
                stroke="#ffffff"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              {tournAvgValue != null && (
                <ReferenceLine
                  y={tournAvgValue}
                  stroke="#facc15"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  label={{ value: `Tourn. Avg ${tournAvgValue.toFixed(cfg.decimals)}`, position: 'insideTopRight', fill: '#facc15', fontSize: 10 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
