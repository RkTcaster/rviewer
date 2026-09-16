'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { AgentPickStat } from '@/lib/types';

interface SideFilters {
  regIds: string[];
  team?: string;
}

interface Props {
  statsLeft: AgentPickStat[];
  statsRight: AgentPickStat[];
  agentImages: Record<string, string>;
  left: SideFilters;
  right: SideFilters;
  teamRegions: Record<string, string>;
}

// Etiqueta y color por region (mismos colores que Neon Dependency / Post Pistol Force).
// El color de reg_4 es el del logo de global, y se reusa para "All regions".
const REGION_META: Record<string, { label: string; color: string }> = {
  reg_0: { label: 'Americas', color: '#FF570C' },
  reg_1: { label: 'EMEA', color: '#D5FF1D' },
  reg_2: { label: 'China', color: '#E73056' },
  reg_3: { label: 'Pacific', color: '#01D2D7' },
  reg_4: { label: 'Global', color: '#9464F6' },
};
const REGION_ORDER = Object.keys(REGION_META);
const FALLBACK_COLOR = '#9ca3af';

// Un equipo elegido manda sobre las regiones y se pinta con el color de su region.
function sideItems({ regIds, team }: SideFilters, teamRegions: Record<string, string>) {
  if (team) return [{ label: team, color: REGION_META[teamRegions[team]]?.color ?? FALLBACK_COLOR }];
  if (regIds.length === 0) return [{ label: 'All regions', color: REGION_META.reg_4.color }];
  return [...regIds]
    .sort((a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b))
    .map(id => ({ label: REGION_META[id]?.label ?? id, color: REGION_META[id]?.color ?? FALLBACK_COLOR }));
}

function SideLabel({ side, filters, teamRegions }: { side: 'A' | 'B'; filters: SideFilters; teamRegions: Record<string, string> }) {
  const items = sideItems(filters, teamRegions);
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border ${side === 'A' ? 'border-blue-500/60' : 'border-orange-500/60'}`}>
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-600">·</span>}
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: item.color }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function aggregatePickRate(stats: AgentPickStat[]): Record<string, number> {
  const mapComps: Record<string, number> = {};
  for (const s of stats) {
    if (!(s.map in mapComps)) mapComps[s.map] = s.comps;
  }
  const denom = Object.values(mapComps).reduce((a, b) => a + b, 0);
  const byAgent: Record<string, number> = {};
  for (const s of stats) {
    byAgent[s.agent] = (byAgent[s.agent] || 0) + s.timesPlayed;
  }
  const result: Record<string, number> = {};
  for (const [agent, played] of Object.entries(byAgent)) {
    result[agent] = denom > 0 ? Math.round((played / denom) * 100) : 0;
  }
  return result;
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

// Misma etiqueta que el header, en una linea: "Americas · EMEA: 42%"
function TooltipRow({ filters, teamRegions, value }: { filters: SideFilters; teamRegions: Record<string, string>; value: number }) {
  const items = sideItems(filters, teamRegions);
  return (
    <p>
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && <span className="text-gray-600"> · </span>}
          <span style={{ color: item.color }}>{item.label}</span>
        </span>
      ))}
      <span className="text-gray-400">: </span>
      <span className="font-bold text-white">{value}%</span>
    </p>
  );
}

// Pick rate mas bajo de los dos lados, pegado al eje central y del lado opuesto a la
// barra (que siempre esta vacio). Se omite cuando ese minimo es 0.
function MinRateLabel({ x, y, width, height, viewBox, index, data }: any) {
  const d = data[index];
  const box = { x, y, width, height, ...(viewBox ?? {}) };
  if (!d || d.minRate === 0 || box.x === undefined) return null;
  // El cero es el borde de la barra que toca el eje: el izquierdo si crece a la derecha
  // y el derecho si crece a la izquierda. Con min/max no importa si recharts manda
  // width negativo o x ya corrido al extremo.
  const zero = d.delta > 0
    ? Math.min(box.x, box.x + box.width)
    : Math.max(box.x, box.x + box.width);
  const toLeft = d.delta >= 0;
  return (
    <text
      x={zero + (toLeft ? -6 : 6)}
      y={box.y + box.height / 2}
      textAnchor={toLeft ? 'end' : 'start'}
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={11}
      fontWeight="bold"
    >
      {d.minRate}%
    </text>
  );
}

function CustomTooltip({ active, payload, left, right, teamRegions }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#0f1115] border border-gray-700 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="font-bold text-white mb-1">{d.agent}</p>
      <TooltipRow filters={left} teamRegions={teamRegions} value={d.leftRate} />
      <TooltipRow filters={right} teamRegions={teamRegions} value={d.rightRate} />
      <p className={d.delta >= 0 ? 'text-green-400' : 'text-red-400'}>
        Delta: <span className="font-bold">{d.delta > 0 ? '+' : ''}{d.delta}%</span>
      </p>
    </div>
  );
}

export function MetaShiftSection({ statsLeft, statsRight, agentImages, left, right, teamRegions }: Props) {
  const [sortBy, setSortBy] = useState<'delta' | 'leftRate'>('delta');
  const [regionColor, setRegionColor] = useState(false);
  const [showPickRate, setShowPickRate] = useState(false);

  // Solo tiene sentido con exactamente una region por lado y sin equipos: ahi cada
  // signo del delta representa una region concreta.
  const canRegionColor = !left.team && !right.team && left.regIds.length === 1 && right.regIds.length === 1;
  const posColor = canRegionColor && regionColor ? (REGION_META[left.regIds[0]]?.color ?? FALLBACK_COLOR) : '#22c55e';
  const negColor = canRegionColor && regionColor ? (REGION_META[right.regIds[0]]?.color ?? FALLBACK_COLOR) : '#f87171';

  const chartData = useMemo(() => {
    const leftRates = aggregatePickRate(statsLeft);
    const rightRates = aggregatePickRate(statsRight);

    return Object.keys(agentImages)
      .map(agent => ({
        agent,
        leftRate: leftRates[agent] ?? 0,
        rightRate: rightRates[agent] ?? 0,
        delta: (leftRates[agent] ?? 0) - (rightRates[agent] ?? 0),
        minRate: Math.min(leftRates[agent] ?? 0, rightRates[agent] ?? 0),
      }))
      .filter(d => d.leftRate > 0 || d.rightRate > 0)
      .sort((a, b) => sortBy === 'delta' ? b.delta - a.delta : b.leftRate - a.leftRate);
  }, [statsLeft, statsRight, agentImages, sortBy]);

  const isEmpty = statsLeft.length === 0 && statsRight.length === 0;

  if (isEmpty) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Select filters on both sides to compare agent pick rates...
      </div>
    );
  }

  const chartHeight = Math.max(300, chartData.length * 36);
  // Un 15% de aire para que la barra mas larga no llegue a tocar el eje Y ni los iconos
  const maxAbs = Math.ceil(Math.max(10, ...chartData.map(d => Math.abs(d.delta))) * 1.15);
  const xDomain: [number, number] = [-maxAbs, maxAbs];

  return (
    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <SideLabel side="A" filters={left} teamRegions={teamRegions} />
        <span className="text-xs text-gray-500">vs</span>
        <SideLabel side="B" filters={right} teamRegions={teamRegions} />
        <span className="text-xs text-gray-500 ml-2">— bars show delta (left − right)</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowPickRate(v => !v)}
            title="Mostrar en el eje el pick rate mas bajo de los dos lados"
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              showPickRate ? 'bg-[#252a33] text-white' : 'bg-[#0f1115] text-gray-500 hover:text-gray-300'
            }`}
          >
            Pick rate
          </button>
          <button
            onClick={() => setRegionColor(v => !v)}
            disabled={!canRegionColor}
            title={canRegionColor ? 'Pintar las barras con el color de cada region' : 'Requiere una sola region por lado y sin equipos elegidos'}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !canRegionColor
                ? 'bg-[#0f1115] text-gray-700 cursor-not-allowed'
                : regionColor
                  ? 'bg-[#252a33] text-white'
                  : 'bg-[#0f1115] text-gray-500 hover:text-gray-300'
            }`}
          >
            Region color
          </button>
          <div className="flex gap-1 bg-[#0f1115] rounded-lg p-1">
            <button
              onClick={() => setSortBy('delta')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${sortBy === 'delta' ? 'bg-[#252a33] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sort by delta
            </button>
            <button
              onClick={() => setSortBy('leftRate')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${sortBy === 'leftRate' ? 'bg-[#252a33] text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sort by left pick rate
            </button>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 24, bottom: 0 }}
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
          <Tooltip content={<CustomTooltip left={left} right={right} teamRegions={teamRegions} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine x={0} stroke="#4b5563" strokeWidth={1} />
          <Bar dataKey="delta" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.delta > 0 ? posColor : entry.delta < 0 ? negColor : '#4b5563'}
              />
            ))}
            {showPickRate ? <LabelList content={<MinRateLabel data={chartData} />} /> : null}
            <LabelList
              dataKey="delta"
              position="right"
              formatter={(v: unknown) => { const n = v as number; return n > 0 ? `+${n}%` : `${n}%`; }}
              style={{ fill: '#9ca3af', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
