'use client';

import { useState } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { Info } from 'lucide-react';
import { TeamProfile, TeamProfilingData } from '@/lib/types';
import { Tooltip } from '../Tooltip';

interface Props {
  data: TeamProfilingData;
  teamLogos?: Record<string, string>;
  hasTour?: boolean;
  // Teams of the main filter (the relevant ones) that played the selection
  fixedTeams: string[];
}

// Up to 3 teams overlaid. Categorical slots 1-3 of the dataviz palette, dark steps, validated
// all-pairs on the page surface #0f1115. A team keeps its slot (and color) while it stays picked.
const SLOT_COLORS = ['#3987e5', '#d95926', '#199e70'];
const MAX_TEAMS = SLOT_COLORS.length;

const rate = ([n, d]: [number, number]) => d === 0 ? null : n / d;
const pctLabel = ([n, d]: [number, number]) => d === 0 ? '—' : `${Math.round((n / d) * 100)}%`;
const countLabel = ([n, d]: [number, number]) => d === 0 ? '' : `${n}/${d}`;

// raw: the figure scaled min-max; higherOut: whether a higher raw value goes outside;
// show: the value always shown; detail: its counts, only with Detail info
type Axis = {
  key: string; label: string; raw: (p: TeamProfile) => number | null; higherOut: boolean;
  show: (p: TeamProfile) => string; detail: (p: TeamProfile) => string;
};
const AXES: Axis[] = [
  { key: 'atk', label: 'ATK WR', raw: p => rate(p.atk), higherOut: true, show: p => pctLabel(p.atk), detail: p => countLabel(p.atk) },
  { key: 'def', label: 'DEF WR', raw: p => rate(p.def), higherOut: true, show: p => pctLabel(p.def), detail: p => countLabel(p.def) },
  { key: 'fk', label: 'FK EFF', raw: p => rate(p.fk), higherOut: true, show: p => pctLabel(p.fk), detail: p => countLabel(p.fk) },
  { key: 'op', label: 'OP USE', raw: p => rate(p.op), higherOut: true, show: p => pctLabel(p.op), detail: p => countLabel(p.op) },
  { key: 'speed', label: 'ATK SPD', raw: p => p.plantMedian, higherOut: false,
    show: p => p.plantMedian === null ? '—' : `${Math.round(p.plantMedian)} s`,
    detail: p => p.plantMedian === null ? '' : `median plant, ${p.plants} plants` },
  { key: 'meta', label: 'OFFMETA', raw: p => p.meta, higherOut: true,
    show: p => p.meta === null ? '—' : p.meta.toFixed(2),
    detail: p => p.meta === null ? '' : `${p.metaMaps} maps` },
];

const LEGEND = (
  <dl className="w-[380px] flex flex-col gap-2 text-[11px] leading-snug text-gray-300">
    <div>
      <dt className="font-bold text-gray-100">Scale</dt>
      <dd className="text-gray-400">
        Each axis is scaled over the teams shown: worst 0, best 1 (last number with Detail info). The
        highest of the compared teams is green.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">ATK WR / DEF WR</dt>
      <dd className="text-gray-400">Rounds won over rounds played on each side.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">FK EFF</dt>
      <dd className="text-gray-400">First duels won: first kills over first kills + first deaths.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">OP USE</dt>
      <dd className="text-gray-400">Rounds with at least one Operator over eligible rounds (not 1, 2, 13, 14), both sides.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">ATK SPD</dt>
      <dd className="text-gray-400">Median plant time of the attack rounds with a plant; faster is further out.</dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">OFFMETA</dt>
      <dd className="text-gray-400">
        Per map, half the summed gap between the team&apos;s and the teams shown&apos; agent pick rates,
        over 5 agents (0 = same picks, 1 = nothing in common), averaged over the team&apos;s maps.
      </dd>
    </div>
    <div>
      <dt className="font-bold text-gray-100">Style axes</dt>
      <dd className="text-gray-400">
        OP USE, ATK SPD and OFFMETA describe style, not quality: outside = more Operator, faster
        plants, picks further from the meta. A bigger area is not a better team.
      </dd>
    </div>
  </dl>
);

// Min-max per axis over the teams shown: worst 0, best (or "most") 1; all equal → 0.5; no data → null
function scaleAxes(profiles: Record<string, TeamProfile>, teams: string[]) {
  const scaled: Record<string, Record<string, number | null>> = {};
  for (const axis of AXES) {
    const values = teams.map(t => axis.raw(profiles[t])).filter((v): v is number => v !== null);
    const min = Math.min(...values), max = Math.max(...values);
    for (const t of teams) {
      const v = axis.raw(profiles[t]);
      const s = v === null ? null : max === min ? 0.5 : (v - min) / (max - min);
      (scaled[t] ??= {})[axis.key] = s === null ? null : axis.higherOut ? s : 1 - s;
    }
  }
  return scaled;
}

type ChartRow = { axis: string; label: string } & Record<string, number | string>;

export function TeamProfilingSection({ data, teamLogos = {}, hasTour = false, fixedTeams }: Props) {
  const teams = fixedTeams.filter(t => data.teams[t]);
  // slots[i] = team drawn in color i (null = free slot)
  const [slots, setSlots] = useState<(string | null)[]>(() => [teams[0] ?? null, teams[1] ?? null, null]);
  const [showDetail, setShowDetail] = useState(false);
  // Teams that left the selection (filter change) drop out of their slot
  const picked = slots.map(t => (t && data.teams[t] ? t : null));

  if (teams.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        {hasTour ? 'No data for the selected filters' : 'Select a tournament to see Team Profiling...'}
      </div>
    );
  }

  const scaled = scaleAxes(data.teams, teams);
  const shown = picked.map((t, i) => ({ team: t, slot: i })).filter((x): x is { team: string; slot: number } => x.team !== null);

  function toggleTeam(team: string) {
    setSlots(() => {
      const next = [...picked];
      const at = next.indexOf(team);
      if (at >= 0) next[at] = null;
      else {
        const free = next.indexOf(null);
        if (free < 0) return next; // already 3 teams
        next[free] = team;
      }
      return next;
    });
  }

  const chartData: ChartRow[] = AXES.map(axis => {
    const row: ChartRow = { axis: axis.key, label: axis.label };
    for (const { team, slot } of shown) row[`s${slot}`] = scaled[team][axis.key] ?? 0;
    return row;
  });

  const missing = (n: number, label: string, table: string) => n < data.series && (
    <p className="px-1 text-xs text-gray-400">
      {label}: {n} of {data.series} series selected (the rest have no {table} rows)
    </p>
  );

  return (
    <div className="flex flex-col gap-4">
      {missing(data.buySeries, 'Buy data (OP USE)', 'round_buy')}
      {missing(data.roundDataSeries, 'Round data (FK EFF, ATK SPD)', 'round_summary / round_events')}

      {/* Team picker: up to 3 */}
      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Teams <span className="normal-case tracking-normal font-normal text-gray-500">(up to {MAX_TEAMS})</span>
        </span>
        <div className="flex flex-wrap gap-2 px-1">
          {teams.map(team => {
            const slot = picked.indexOf(team);
            const full = slot < 0 && shown.length >= MAX_TEAMS;
            return (
              <button
                key={team}
                onClick={() => toggleTeam(team)}
                disabled={full}
                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-bold transition-colors ${
                  slot >= 0 ? 'bg-gray-800 text-gray-100' : full ? 'border-gray-800 text-gray-600 cursor-not-allowed' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
                style={slot >= 0 ? { borderColor: SLOT_COLORS[slot] } : undefined}
              >
                {teamLogos[team] && <img src={teamLogos[team]} alt="" className="w-4 h-4 object-contain" />}
                {team}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl text-gray-400">Pick a team to draw its profile</div>
      ) : (
        <div className="flex flex-wrap gap-8 items-start">
          <div className="w-full max-w-[520px] h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={chartData} outerRadius="72%">
                <PolarGrid stroke="#2d3139" />
                <PolarAngleAxis dataKey="label" tick={{ fill: '#d1d5db', fontSize: 12, fontWeight: 700 }} />
                <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
                <ChartTooltip content={<RadarTooltip profiles={data.teams} shown={shown} scaled={scaled} showDetail={showDetail} />} />
                {shown.map(({ team, slot }) => (
                  <Radar
                    key={team}
                    name={team}
                    dataKey={`s${slot}`}
                    stroke={SLOT_COLORS[slot]}
                    strokeWidth={2}
                    fill={SLOT_COLORS[slot]}
                    fillOpacity={0.12}
                    dot={{ r: 4, fill: SLOT_COLORS[slot], stroke: '#0f1115', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend + raw figures (identity is never color alone) */}
          <div className="flex flex-col gap-3 min-w-[320px]">
            <div className="flex items-center gap-4">
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
            </div>
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="text-left pb-2 pr-4 text-[11px] font-bold uppercase tracking-wide text-gray-500">Axis</th>
                  {shown.map(({ team, slot }) => (
                    <th key={team} className="text-left pb-2 pr-4">
                      <span className="flex items-center gap-1.5 text-gray-100 font-bold">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: SLOT_COLORS[slot] }} />
                        {teamLogos[team] && <img src={teamLogos[team]} alt="" className="w-4 h-4 object-contain" />}
                        {team}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {AXES.map(axis => {
                  // Highest of the compared teams in green, like the best value in Stats Rank
                  // (the scaled value, so on ATK SPD the fastest); only with 2+ teams
                  const values = shown.map(({ team }) => scaled[team][axis.key]).filter((v): v is number => v !== null);
                  const top = shown.length >= 2 && values.length ? Math.max(...values) : null;
                  return (
                  <tr key={axis.key} className="border-t border-gray-800">
                    <td className="py-1.5 pr-4 font-bold text-gray-300 whitespace-nowrap">{axis.label}</td>
                    {shown.map(({ team }) => {
                      const s = scaled[team][axis.key];
                      return (
                        <td key={team} className={`py-1.5 pr-4 whitespace-nowrap ${s !== null && s === top ? 'text-green-400 font-black' : 'text-gray-200'}`}>
                          <div>{axis.show(data.teams[team])}</div>
                          {showDetail && (
                            <div className="text-[11px] font-normal text-gray-500">
                              {[axis.detail(data.teams[team]), s === null ? '' : s.toFixed(2)].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RadarTooltip({ active, payload, profiles, shown, scaled, showDetail }: {
  active?: boolean;
  payload?: { payload: ChartRow }[];
  profiles: Record<string, TeamProfile>;
  shown: { team: string; slot: number }[];
  scaled: Record<string, Record<string, number | null>>;
  showDetail: boolean;
}) {
  if (!active || !payload?.length) return null;
  const axis = AXES.find(a => a.key === payload[0].payload.axis);
  if (!axis) return null;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-bold text-gray-100">{axis.label}</p>
      {shown.map(({ team, slot }) => {
        const s = scaled[team][axis.key];
        return (
          <p key={team} className="flex items-center gap-1.5 text-gray-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: SLOT_COLORS[slot] }} />
            <span className="font-bold text-gray-100">{team}</span>
            {axis.show(profiles[team])}
            {showDetail && (
              <span className="text-gray-500">
                {[axis.detail(profiles[team]), s === null ? '' : s.toFixed(2)].filter(Boolean).join(' · ')}
              </span>
            )}
          </p>
        );
      })}
    </div>
  );
}
