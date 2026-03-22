'use client';

import { useState } from 'react';
import { PlayerStat, TournamentPlayerAvg } from '@/lib/types';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

type StatKey = 'kd' | 'rating' | 'acs' | 'adr' | 'hs';

interface StatCfg {
  label: string;
  max: number;
  decimals: number;
  lowerIsBetter?: boolean;
  both: (s: PlayerStat) => number;
  atk:  (s: PlayerStat) => number;
  def:  (s: PlayerStat) => number;
  taBoth: (ta: TournamentPlayerAvg) => number;
  taAtk:  (ta: TournamentPlayerAvg) => number;
  taDef:  (ta: TournamentPlayerAvg) => number;
}

const STAT_CONFIG: Record<StatKey, StatCfg> = {
  kd: {
    label: 'K/D', max: 2.0, decimals: 2,
    both: s => s.kd,        atk: s => s.kdAtk,       def: s => s.kdDef,
    taBoth: t => t.kd,      taAtk: t => t.kdAtk,     taDef: t => t.kdDef,
  },
  rating: {
    label: 'Rating', max: 1.8, decimals: 2,
    both: s => s.rating,    atk: s => s.ratingAtk,   def: s => s.ratingDef,
    taBoth: t => t.rating,  taAtk: t => t.ratingAtk, taDef: t => t.ratingDef,
  },
  acs: {
    label: 'ACS', max: 350, decimals: 0,
    both: s => s.acs,       atk: s => s.acsAtk,      def: s => s.acsDef,
    taBoth: t => t.acs,     taAtk: t => t.acsAtk,    taDef: t => t.acsDef,
  },
  adr: {
    label: 'ADR', max: 180, decimals: 0,
    both: s => s.adr,       atk: s => s.adrAtk,      def: s => s.adrDef,
    taBoth: t => t.adr,     taAtk: t => t.adrAtk,    taDef: t => t.adrDef,
  },
  hs: {
    label: 'HS%', max: 50, decimals: 1,
    both: s => s.hs * 100,       atk: s => s.hsAtk * 100,      def: s => s.hsDef * 100,
    taBoth: t => t.hs * 100,     taAtk: t => t.hsAtk * 100,    taDef: t => t.hsDef * 100,
  },
};

const STAT_ORDER: StatKey[] = ['kd', 'rating', 'acs', 'adr', 'hs'];

function statColor(val: number, max: number, lowerIsBetter = false): string {
  const ratio = Math.min(Math.max(val / max, 0), 1);
  const r = lowerIsBetter ? 1 - ratio : ratio;
  if (r >= 0.65) return '#22c55e';
  if (r >= 0.40) return '#eab308';
  return '#ef4444';
}

function angleForVal(val: number, max: number): number {
  const p = Math.min(Math.max(val / max, 0), 1);
  return (1 - p) * Math.PI;
}

function GaugeMarkers({ atkVal, defVal, max }: { atkVal: number; defVal: number; max: number }) {
  const cx = 70, cy = 90, innerR = 52, outerR = 78, halfBase = 3;
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 140, height: 80, overflow: 'visible' }}>
      {([{ val: atkVal, fill: '#ef4444' }, { val: defVal, fill: '#22c55e' }] as const).map(({ val, fill }, i) => {
        const α = angleForVal(val, max);
        const cosA = Math.cos(α), sinA = Math.sin(α);
        const tanX = -sinA, tanY = -cosA;
        const tipX = cx + innerR * cosA, tipY = cy - innerR * sinA;
        const baseX = cx + outerR * cosA, baseY = cy - outerR * sinA;
        return (
          <polygon
            key={i}
            points={`${tipX},${tipY} ${baseX + halfBase * tanX},${baseY + halfBase * tanY} ${baseX - halfBase * tanX},${baseY - halfBase * tanY}`}
            fill={fill}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function StatGauge({ val, atkVal, defVal, cfg }: { val: number; atkVal: number; defVal: number; cfg: StatCfg }) {
  const color = statColor(val, cfg.max, cfg.lowerIsBetter);
  const pct = Math.min(Math.max(val / cfg.max, 0), 1) * 100;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 80 }}>
        <RadialBarChart
          width={140} height={100} cx={70} cy={90}
          innerRadius={55} outerRadius={75}
          startAngle={180} endAngle={0}
          data={[{ value: pct, fill: color }]}
          style={{ overflow: 'visible' }}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: '#374151' }} dataKey="value" cornerRadius={4} angleAxisId={0} />
        </RadialBarChart>
        <GaugeMarkers atkVal={atkVal} defVal={defVal} max={cfg.max} />
        <span className="absolute font-bold text-xl" style={{ bottom: 4, color }}>
          {val.toFixed(cfg.decimals)}
        </span>
      </div>
      <div className="flex gap-2 text-[10px] font-semibold">
        <span style={{ color: '#ef4444' }}>ATK {atkVal.toFixed(cfg.decimals)}</span>
        <span style={{ color: '#22c55e' }}>DEF {defVal.toFixed(cfg.decimals)}</span>
      </div>
    </div>
  );
}

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
}: {
  stats: PlayerStat[];
  tournamentAvg?: TournamentPlayerAvg | null;
}) {
  const [stat, setStat] = useState<StatKey>('kd');
  const cfg = STAT_CONFIG[stat] ?? STAT_CONFIG['kd'];

  if (!stats || stats.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No player data available for the selected filters.
      </div>
    );
  }

  const mean = (fn: (s: PlayerStat) => number) => {
    const vals = stats.map(fn);
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Stat selector */}
      <div className="flex flex-wrap gap-2">
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
      </div>

      {/* KPI cards */}
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

      {/* Player grid */}
      <div className="grid grid-cols-5 gap-4">
        {[...stats].sort((a, b) => a.player.localeCompare(b.player)).map((s) => (
          <div
            key={s.player}
            className="bg-[#1a1d23] rounded-xl p-4 flex flex-col items-center gap-1 border border-gray-800"
          >
            <span className="text-sm font-bold text-gray-100 truncate w-full text-center">{s.player}</span>
            <span className="text-[11px] text-gray-400">{s.agent}</span>
            <StatGauge val={cfg.both(s)} atkVal={cfg.atk(s)} defVal={cfg.def(s)} cfg={cfg} />
            <span className="text-[11px] text-gray-500 mt-1">{s.maps} maps</span>
            <span className="text-[11px] text-gray-600">{s.kills}K / {s.deaths}D</span>
          </div>
        ))}
      </div>
    </div>
  );
}
