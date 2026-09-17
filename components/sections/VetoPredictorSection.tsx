'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Info, Lock, RotateCcw, Undo2 } from 'lucide-react';
import { Tooltip } from '@/components/Tooltip';
import { buildSnapshot, knownTeam, stepProbabilities, vetoDistribution, SLOTS } from '@/lib/vetoPredict';
import type { VetoModelRows } from '@/lib/data-service';

interface Props {
  model: VetoModelRows | null;
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
}

// Teams outside these regions ("Other") are not offered
const REGION_ROWS: { id: string; label: string }[] = [
  { id: 'reg_0', label: 'Americas' },
  { id: 'reg_1', label: 'EMEA' },
  { id: 'reg_2', label: 'China' },
  { id: 'reg_3', label: 'Pacific' },
];

// Same colors as VetoSection
const BAN_COLOR = '#f87171';
const PICK_COLOR = '#60a5fa';
const DECIDER_COLOR = '#9ca3af';

// Veto order: who acts at each of the 7 slots (the decider has no actor)
const SLOT_ACTOR: ('A' | 'B' | null)[] = ['A', 'B', 'A', 'B', 'A', 'B', null];
const slotKind = (i: number) => (i === 6 ? 'Decider' : i === 2 || i === 3 ? 'Pick' : 'Ban');
const slotColor = (i: number) => (i === 6 ? DECIDER_COLOR : i === 2 || i === 3 ? PICK_COLOR : BAN_COLOR);

// Test metrics of the model (264 BO3 series since 2026-07-01), from the notebook report
const ACCURACY: [string, string, string][] = [
  ['Top-1 per step (given the real veto state)', '52%', '27%'],
  ['Maps played (picks + decider), most likely veto', '58%', '43%'],
  ['Decider, most likely veto', '22%', '14%'],
  ['Bans and picks as sets', '3%', '1%'],
  ['Exact 7-map sequence', '3%', '0.02%'],
];

// Same palette as Maps Rank
function heatmapBg(pct: number): string {
  const t = Math.min(1, Math.max(0, pct / 100));
  return `hsl(${220 - t * 80}, 55%, ${18 + t * 28}%)`;
}

const fmt = (p: number) => `${(p * 100).toFixed(1)}%`;

export function VetoPredictorSection({ model, teamLogos = {}, teamRegions = {}, mapImages = {} }: Props) {
  const snap = useMemo(
    () => (model && model.teamMap.length > 0 ? buildSnapshot(model.teamMap, model.maps, model.coef, model.meta) : null),
    [model]
  );
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [editing, setEditing] = useState<'A' | 'B'>('A');
  const [pool, setPool] = useState<string[] | null>(null); // null = default pool of the snapshot
  const [locked, setLocked] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);

  const activePool = useMemo(() => pool ?? snap?.defaultPool ?? [], [pool, snap]);
  const ready = !!snap && !!teamA && !!teamB && activePool.length === 7;
  const dist = useMemo(
    () => (ready ? vetoDistribution(snap!, teamA, teamB, activePool, locked) : null),
    [ready, snap, teamA, teamB, activePool, locked]
  );

  if (!snap) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No veto model data. Upload the veto_* tables to Supabase.
      </div>
    );
  }

  const allMaps = [...snap.mapStats.keys()].sort();
  const teams = [...snap.teamStats.keys()].filter(t => knownTeam(snap, t)).sort();
  const rows = REGION_ROWS
    .map(r => ({ ...r, teams: teams.filter(t => teamRegions[t] === r.id) }))
    .filter(r => r.teams.length > 0);
  const nameOf = (actor: 'A' | 'B' | null) => (actor === 'A' ? teamA : actor === 'B' ? teamB : '');

  function resetVeto() {
    setLocked([]);
    setPicking(false);
  }

  // A click assigns the team to the side being edited; after choosing A, B is edited next
  function selectTeam(team: string) {
    const [current, other, setCurrent, setOther] = editing === 'A'
      ? [teamA, teamB, setTeamA, setTeamB]
      : [teamB, teamA, setTeamB, setTeamA];
    if (team === current) {
      setCurrent('');
    } else {
      if (team === other) setOther('');
      setCurrent(team);
      if (editing === 'A' && !teamB) setEditing('B');
    }
    resetVeto();
  }

  function swapTeams() {
    setTeamA(teamB);
    setTeamB(teamA);
    resetVeto();
  }

  function toggleMap(map: string) {
    const next = new Set(activePool);
    if (next.has(map)) next.delete(map); else next.add(map);
    setPool(allMaps.filter(m => next.has(m)));
    resetVeto();
  }

  const sideButton = (side: 'A' | 'B') => {
    const team = side === 'A' ? teamA : teamB;
    const active = editing === side;
    const color = side === 'A'
      ? (active ? 'bg-blue-900/40 border-blue-600 text-blue-300' : 'border-gray-700 text-blue-400/70 hover:border-gray-500')
      : (active ? 'bg-orange-900/30 border-orange-600 text-orange-300' : 'border-gray-700 text-orange-400/70 hover:border-gray-500');
    return (
      <button
        onClick={() => setEditing(side)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wide transition-colors ${color}`}
      >
        <span>Team {side}{side === 'A' && ' (starts veto)'}:</span>
        {team && teamLogos[team] && <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain" />}
        <span className="text-gray-200">{team || '—'}</span>
      </button>
    );
  };

  const renderTeamChip = (team: string) => {
    const style = team === teamA
      ? 'bg-blue-900/40 border-blue-600 text-blue-300'
      : team === teamB
        ? 'bg-orange-900/30 border-orange-600 text-orange-300'
        : 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300';
    return (
      <button
        key={team}
        onClick={() => selectTeam(team)}
        className={`w-[64px] flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-xl text-[13px] font-bold uppercase tracking-wide transition-colors border ${style}`}
      >
        {teamLogos[team] && <img src={teamLogos[team]} alt={team} className="w-6 h-6 object-contain shrink-0" />}
        <span>{team}</span>
      </button>
    );
  };

  const nextStep = locked.length;
  const nextProbs = dist && picking && nextStep < 6
    ? Object.entries(stepProbabilities(snap, teamA, teamB, activePool, locked)).sort((x, y) => y[1] - x[1])
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Selection: teams by region + map pool */}
      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {sideButton('A')}
          <button
            onClick={swapTeams}
            title="Swap teams (the order matters: Team A starts the veto)"
            className="p-1.5 rounded-lg border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          {sideButton('B')}
        </div>

        <div className="flex flex-col gap-2">
          {rows.map(row => (
            <div key={row.id} className="flex items-center gap-3">
              <span className="w-12 shrink-0 flex items-center justify-end">
                <img src={`/region/${row.label.toLowerCase()}.png`} alt={row.label} title={row.label} className="w-[30px] h-[30px] object-contain" />
              </span>
              <div className="flex flex-wrap gap-2">{row.teams.map(renderTeamChip)}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <span className={`text-[11px] font-bold uppercase tracking-widest ${activePool.length === 7 ? 'text-gray-500' : 'text-red-400'}`}>
            Map pool ({activePool.length}/7)
          </span>
          <div className="flex gap-2 overflow-x-auto">
            {allMaps.map(map => {
              const active = activePool.includes(map);
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
                  {mapImages[map] && (
                    <img src={mapImages[map]} alt={map} className={`w-[50px] h-[40px] object-cover rounded ${active ? '' : 'opacity-40 grayscale'}`} />
                  )}
                  <span className={active ? '' : 'line-through'}>{map}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!dist ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Choose Team A, Team B and a pool of 7 maps to see the predicted veto...
        </div>
      ) : (
        <>
          {/* Context */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-bold uppercase tracking-widest text-gray-400">
            <span>Model snapshot: {snap.snapshotDate}</span>
            {([['A', teamA, dist.nSeries.a], ['B', teamB, dist.nSeries.b]] as const).map(([side, team, n]) => (
              <span key={side} className={n === 0 ? 'text-yellow-400' : ''}>
                {team}: {n === 0 ? 'no BO3 history, using average behavior' : `${n} BO3 series`}
              </span>
            ))}
            <Tooltip
              content={
                <div className="flex flex-col gap-2 normal-case tracking-normal font-normal max-w-[380px]">
                  <p className="text-xs text-gray-300">Accuracy on 264 unseen BO3 series (since 2026-07-01):</p>
                  <table className="text-xs">
                    <thead>
                      <tr className="text-gray-500"><th className="text-left pr-3">Metric</th><th className="pr-3">Model</th><th>Random</th></tr>
                    </thead>
                    <tbody>
                      {ACCURACY.map(([m, ours, random]) => (
                        <tr key={m} className="text-gray-300">
                          <td className="pr-3 py-0.5">{m}</td>
                          <td className="pr-3 text-center font-bold">{ours}</td>
                          <td className="text-center text-gray-500">{random}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-gray-400">
                    The map × slot heatmap is more reliable than the single most likely veto (there are 5040 possible vetos).
                    First bans are the most predictable; the decider is the weakest. BO3 only.
                  </p>
                </div>
              }
            >
              <Info className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-help" />
            </Tooltip>
          </div>

          {/* Most likely veto */}
          <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                Most likely veto <span className="text-gray-200">{fmt(dist.mostLikely.p)}</span>
              </h2>
              {locked.length > 0 && (
                <>
                  <button
                    onClick={() => { setLocked(locked.slice(0, -1)); setPicking(false); }}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  >
                    <Undo2 className="w-3 h-3" /> Undo
                  </button>
                  <button
                    onClick={resetVeto}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {dist.mostLikely.maps.map((map, i) => {
                const isLocked = i < locked.length;
                const isNext = i === nextStep && i < 6;
                return (
                  <button
                    key={i}
                    disabled={!isNext}
                    onClick={() => setPicking(p => !p)}
                    className={`w-[110px] flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 bg-[#0f1115] transition-colors ${
                      isNext ? 'cursor-pointer hover:bg-[#252a33]' : 'cursor-default'
                    } ${isNext && picking ? 'ring-2 ring-gray-400' : ''}`}
                    style={{ borderColor: slotColor(i), borderStyle: isNext ? 'dashed' : 'solid' }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: slotColor(i) }}>
                      {slotKind(i)} {nameOf(SLOT_ACTOR[i])}
                    </span>
                    {mapImages[map] && <img src={mapImages[map]} alt={map} className="w-[90px] h-[50px] object-cover rounded" />}
                    <span className="flex items-center gap-1 text-sm font-bold text-gray-200">
                      {isLocked && <Lock className="w-3 h-3 text-gray-400" />}
                      {map}
                    </span>
                    {isNext && <span className="text-[10px] text-gray-500">click to set</span>}
                  </button>
                );
              })}
            </div>

            {nextProbs.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Step {nextStep + 1}: {slotKind(nextStep)} {nameOf(SLOT_ACTOR[nextStep])} — choose the map
                </span>
                <div className="flex flex-wrap gap-2">
                  {nextProbs.map(([map, p]) => (
                    <button
                      key={map}
                      onClick={() => { setLocked([...locked, map]); setPicking(false); }}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-gray-700 hover:border-gray-400 transition-colors"
                    >
                      {mapImages[map] && <img src={mapImages[map]} alt={map} className="w-[50px] h-[40px] object-cover rounded" />}
                      <span className="text-[11px] font-bold uppercase text-gray-300">{map}</span>
                      <span className="text-[11px] font-bold" style={{ color: slotColor(nextStep) }}>{fmt(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map × slot heatmap */}
          <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6 overflow-x-auto">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Probability by map and slot</h2>
            <table className="border-separate" style={{ borderSpacing: '2px' }}>
              <thead>
                <tr>
                  <th />
                  {SLOTS.map((slot, i) => (
                    <th key={slot} className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: slotColor(i) }}>
                      {slotKind(i)} {nameOf(SLOT_ACTOR[i])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activePool.map(map => (
                  <tr key={map}>
                    <td className="pr-3">
                      <div className="flex items-center gap-2">
                        {mapImages[map] && <img src={mapImages[map]} alt={map} className="w-[40px] h-[28px] object-cover rounded" />}
                        <span className="text-sm font-bold text-gray-200">{map}</span>
                      </div>
                    </td>
                    {SLOTS.map(slot => {
                      const pct = dist.marginals[map][slot] * 100;
                      return (
                        <td
                          key={slot}
                          className="w-[88px] h-[36px] text-center text-sm font-bold text-gray-100 rounded"
                          style={{ background: heatmapBg(pct) }}
                        >
                          {pct.toFixed(0)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-6">
            {/* Top sequences */}
            <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6 flex-1 min-w-[420px]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Most likely sequences</h2>
              <div className="flex flex-col gap-2">
                {dist.sequences.map(seq => (
                  <div key={seq.maps.join('|')} className="flex items-center gap-2 text-sm">
                    <span className="w-14 shrink-0 text-right font-bold text-gray-200">{fmt(seq.p)}</span>
                    {seq.maps.map((map, i) => (
                      <span key={i} className="flex items-center gap-2">
                        {i > 0 && <span className="text-gray-600">→</span>}
                        <span className="font-semibold" style={{ color: slotColor(i) }}>{map}</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Maps played */}
            <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6 min-w-[280px]">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Maps played (any order)</h2>
              <div className="flex flex-col gap-2">
                {dist.playedSets.map(set => (
                  <div key={set.maps.join(',')} className="flex items-center gap-2 text-sm">
                    <span className="w-14 shrink-0 text-right font-bold text-gray-200">{fmt(set.p)}</span>
                    <span className="font-semibold text-blue-400">{set.maps.join(' · ')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
