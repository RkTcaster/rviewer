'use client';

import { Sankey, Tooltip, ResponsiveContainer } from 'recharts';
import { VetoFlow } from '@/lib/types';

interface Props {
  flows: VetoFlow[];
  teamName: string;
}

const BAN_COLOR = '#f87171';
const PICK_COLOR = '#60a5fa';

// Nodos con prefijo de etapa para que el mismo mapa sea un nodo distinto por columna
const STAGE_PREFIX = { ban1: 'Ban: ', pick: 'Pick: ', ban2: 'Ban 2: ' } as const;

function buildSankey(flows: VetoFlow[]) {
  const linkCounts: Record<string, number> = {};
  for (const f of flows) {
    const ban1 = STAGE_PREFIX.ban1 + f.ban1;
    const pick = STAGE_PREFIX.pick + f.pick;
    linkCounts[`${ban1}→${pick}`] = (linkCounts[`${ban1}→${pick}`] ?? 0) + 1;
    if (f.ban2) {
      const ban2 = STAGE_PREFIX.ban2 + f.ban2;
      linkCounts[`${pick}→${ban2}`] = (linkCounts[`${pick}→${ban2}`] ?? 0) + 1;
    }
  }

  const nodeNames: string[] = [];
  const nodeIndex: Record<string, number> = {};
  const getNode = (name: string) => {
    if (nodeIndex[name] === undefined) {
      nodeIndex[name] = nodeNames.length;
      nodeNames.push(name);
    }
    return nodeIndex[name];
  };

  // Links ordenados por valor descendente para una lectura más estable
  const links = Object.entries(linkCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => {
      const [source, target] = key.split('→');
      return { source: getNode(source), target: getNode(target), value };
    });

  return { nodes: nodeNames.map(name => ({ name })), links };
}

export function VetoSection({ flows, teamName }: Props) {
  if (flows.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No draft data available for this selection.
      </div>
    );
  }

  const data = buildSankey(flows);
  const totalSeries = flows.length;

  // Secuencias completas más repetidas (solo Bo3, que tienen las 3 etapas)
  const seqCounts: Record<string, number> = {};
  for (const f of flows) {
    if (!f.ban2) continue;
    const key = `${f.ban1}|${f.pick}|${f.ban2}`;
    seqCounts[key] = (seqCounts[key] ?? 0) + 1;
  }
  const topSequences = Object.entries(seqCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const CustomNode = ({ x, y, width, height: h, payload }: any) => {
    const isBan = payload.name.startsWith('Ban');
    const color = isBan ? BAN_COLOR : PICK_COLOR;
    const pct = payload.value && totalSeries > 0
      ? Math.round((payload.value / totalSeries) * 100)
      : null;
    return (
      <g>
        <rect x={x} y={y} width={width} height={h} fill={color} opacity={0.85} rx={3} />
        <text x={x + width + 8} y={y + h / 2 - 4} fill="#e5e7eb" fontSize={12} fontWeight={600}>
          {payload.name}
        </text>
        <text x={x + width + 8} y={y + h / 2 + 10} fill="#9ca3af" fontSize={11}>
          {payload.value}{pct !== null ? ` (${pct}%)` : ''}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
        <div className="flex items-baseline gap-3 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
            Veto Flow — Ban → Pick → Ban 2
          </h2>
          <span className="text-xs text-gray-500">
            {teamName} · {totalSeries} series
          </span>
        </div>
        <ResponsiveContainer width="100%" height={Math.max(420, data.nodes.length * 26)}>
          <Sankey
            data={data}
            node={<CustomNode />}
            link={{ stroke: '#4b5563', opacity: 0.35 }}
            nodePadding={24}
            margin={{ top: 10, right: 140, bottom: 10, left: 10 }}
          >
            <Tooltip
              formatter={(value: unknown) => [`${value}`, 'series'] as [string, string]}
              contentStyle={{ background: '#0f1115', border: '1px solid #374151', borderRadius: 8, color: '#ffffff' }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>

      {topSequences.length > 0 && (
        <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
            Most repeated sequences (Bo3)
          </h2>
          <div className="flex flex-col gap-2">
            {topSequences.map(([key, count]) => {
              const [ban1, pick, ban2] = key.split('|');
              const pct = Math.round((count / totalSeries) * 100);
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 text-right font-bold text-gray-200">
                    {count}× <span className="text-[11px] font-normal text-gray-500">({pct}%)</span>
                  </span>
                  <span className="text-red-400 font-semibold">Ban {ban1}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-blue-400 font-semibold">Pick {pick}</span>
                  <span className="text-gray-600">→</span>
                  <span className="text-red-400 font-semibold">Ban {ban2}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
