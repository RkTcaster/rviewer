'use client';

import { useState } from 'react';
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardData, MapStat, TeamRankStats } from '@/lib/types';

type Props = {
  pistols: DashboardData['pistols'];
  antiEco: DashboardData['antiEco'];
  recovery: DashboardData['recovery'];
  pab: DashboardData['pab'];
  stats: MapStat[];
  rankStats?: TeamRankStats;
};

const btnClass = (active: boolean) =>
  `px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
    active ? 'bg-[#252a33] text-white' : 'text-gray-500 hover:text-gray-300'
  }`;

function SankeyChart({
  data,
  nodeColors,
  denominator,
  height = 500,
}: {
  data: { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] };
  nodeColors: Record<string, string>;
  denominator: number;
  height?: number;
}) {
  const CustomNode = ({ x, y, width, height: h, payload }: any) => {
    const color = nodeColors[payload.name] ?? '#6b7280';
    const pct = payload.value && denominator > 0
      ? Math.round((payload.value / denominator) * 100)
      : null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={h} fill={color} opacity={0.85} rx={3} />
        <text x={x + width + 8} y={y + h / 2 - 6} fill="#e5e7eb" fontSize={12} fontWeight={600}>
          {payload.name}
        </text>
        <text x={x + width + 8} y={y + h / 2 + 10} fill="#9ca3af" fontSize={11}>
          {payload.value} rounds{pct !== null ? ` (${pct}%)` : ''}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={data}
        node={<CustomNode />}
        link={{ stroke: '#4b5563', opacity: 0.35 }}
        nodePadding={40}
        margin={{ top: 10, right: 200, bottom: 10, left: 10 }}
      >
        <Tooltip
          formatter={(value: number) => [value, 'rounds']}
          contentStyle={{ background: '#0f1115', border: '1px solid #374151', borderRadius: 8, color: '#ffffff' }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}

export function GraphsSection({ pistols, antiEco, recovery, pab, stats, rankStats }: Props) {
  const [chart, setChart] = useState<'pistol' | 'atk' | 'def'>('pistol');

  if (pistols.total === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No data available for this selection.
      </div>
    );
  }

  // --- Pistol Info data ---
  const pistolData = {
    nodes: [
      { name: 'Pistols Played' },
      { name: 'Pistol Win' },
      { name: 'Pistol Loss' },
      { name: 'Anti-Eco Win' },
      { name: 'Anti-Eco Loss' },
      { name: 'PAB Win' },
      { name: 'PAB Loss' },
      { name: 'Recovery Win' },
      { name: 'Recovery Loss' },
    ],
    links: [
      { source: 0, target: 1, value: pistols.wins },
      { source: 0, target: 2, value: pistols.total - pistols.wins },
      { source: 1, target: 3, value: antiEco.wins },
      { source: 1, target: 4, value: antiEco.total - antiEco.wins },
      { source: 3, target: 5, value: pab.wins },
      { source: 3, target: 6, value: pab.total - pab.wins },
      { source: 2, target: 7, value: recovery.wins },
      { source: 2, target: 8, value: recovery.total - recovery.wins },
    ],
  };

  const pistolColors: Record<string, string> = {
    'Pistols Played': '#6b7280',
    'Pistol Win':     '#22c55e',
    'Pistol Loss':    '#f87171',
    'Anti-Eco Win':   '#22c55e',
    'Anti-Eco Loss':  '#f87171',
    'PAB Win':        '#22c55e',
    'PAB Loss':       '#f87171',
    'Recovery Win':   '#22c55e',
    'Recovery Loss':  '#f87171',
  };

  // --- WR ATK data ---
  const attTotal      = stats.reduce((s, m) => s + m.attTotal, 0);
  const attWins       = stats.reduce((s, m) => s + m.attWins, 0);
  const postPlantPl   = rankStats?.postPlantPl ?? 0;
  const postPlantDe   = rankStats?.postPlantDe ?? 0;
  const postPlantWins = postPlantPl - postPlantDe;
  const noPlant       = attTotal - postPlantPl;
  const noPlantWins   = attWins - postPlantWins;
  const noPlantLosses = noPlant - noPlantWins;

  const atkData = {
    nodes: [
      { name: 'ATK Rounds' },
      { name: 'Plant' },
      { name: 'No Plant' },
      { name: 'Post Plant Win' },
      { name: 'Post Plant Loss' },
      { name: 'No Plant Win' },
      { name: 'No Plant Loss' },
    ],
    links: [
      { source: 0, target: 1, value: postPlantPl },
      { source: 0, target: 2, value: noPlant },
      { source: 1, target: 3, value: postPlantWins },
      { source: 1, target: 4, value: postPlantDe },
      { source: 2, target: 5, value: noPlantWins },
      { source: 2, target: 6, value: noPlantLosses },
    ],
  };

  // --- WR DEF data ---
  const defTotal      = stats.reduce((s, m) => s + m.defTotal, 0);
  const defWins       = stats.reduce((s, m) => s + m.defWins, 0);
  const plantDef      = rankStats?.retakePl ?? 0;   // opponent's plants (= plant rate def denominator)
  const retakeDe      = rankStats?.retakeDe ?? 0;   // our defuses = retake wins
  const retakeLosses  = plantDef - retakeDe;
  const noPlantDef    = defTotal - plantDef;
  const noPlantDefWins   = defWins - retakeDe;
  const noPlantDefLosses = noPlantDef - noPlantDefWins;

  const defData = {
    nodes: [
      { name: 'DEF Rounds' },
      { name: 'Plant (Opponent)' },
      { name: 'No Plant' },
      { name: 'Retake Win' },
      { name: 'Retake Loss' },
      { name: 'No Plant Win' },
      { name: 'No Plant Loss' },
    ],
    links: [
      { source: 0, target: 1, value: plantDef },
      { source: 0, target: 2, value: noPlantDef },
      { source: 1, target: 3, value: retakeDe },
      { source: 1, target: 4, value: retakeLosses },
      { source: 2, target: 5, value: noPlantDefWins },
      { source: 2, target: 6, value: noPlantDefLosses },
    ],
  };

  const defColors: Record<string, string> = {
    'DEF Rounds':       '#6b7280',
    'Plant (Opponent)': '#f87171',
    'No Plant':         '#6b7280',
    'Retake Win':       '#22c55e',
    'Retake Loss':      '#f87171',
    'No Plant Win':     '#22c55e',
    'No Plant Loss':    '#f87171',
  };

  const atkColors: Record<string, string> = {
    'ATK Rounds':      '#6b7280',
    'Plant':           '#3b82f6',
    'No Plant':        '#6b7280',
    'Post Plant Win':  '#22c55e',
    'Post Plant Loss': '#f87171',
    'No Plant Win':    '#22c55e',
    'No Plant Loss':   '#f87171',
  };

  return (
    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
          {chart === 'pistol' ? 'Economy Flow — Pistol → Anti-Eco → PAB'
            : chart === 'atk' ? 'ATK Flow — Plant Rate & Post Plant WR'
            : 'DEF Flow — Plant Rate DEF & Retake Eff'}
        </h2>
        <div className="ml-auto flex gap-1 bg-[#0f1115] rounded-lg p-1">
          <button onClick={() => setChart('pistol')} className={btnClass(chart === 'pistol')}>
            Pistol Info
          </button>
          <button onClick={() => setChart('atk')} className={btnClass(chart === 'atk')}>
            WR ATK
          </button>
          <button onClick={() => setChart('def')} className={btnClass(chart === 'def')}>
            WR DEF
          </button>
        </div>
      </div>

      {chart === 'pistol' ? (
        <SankeyChart data={pistolData} nodeColors={pistolColors} denominator={pistols.total} height={500} />
      ) : chart === 'atk' ? (
        <SankeyChart data={atkData} nodeColors={atkColors} denominator={attTotal} height={420} />
      ) : (
        <SankeyChart data={defData} nodeColors={defColors} denominator={defTotal} height={420} />
      )}
    </div>
  );
}
