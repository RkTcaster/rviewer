'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Lock, RotateCcw, Undo2 } from 'lucide-react';
import { buildSnapshot, stepProbabilities, vetoDistribution, SLOTS, SLOT_ACTOR } from '@/lib/vetoPredict';
import type { VetoDistribution, VetoSnapshot } from '@/lib/vetoPredict';
import type { VetoModelRows } from '@/lib/data-service';

// Only the veto tables; the result_* tables of the model are not used in Compare Maps
export type VetoModelCore = Pick<VetoModelRows, 'teamMap' | 'maps' | 'coef' | 'meta'>;

// Same colors and slot names as VetoPredictorSection
export const BAN_COLOR = '#f87171';
export const PICK_COLOR = '#60a5fa';
export const DECIDER_COLOR = '#9ca3af';
const slotKind = (i: number) => (i === 6 ? 'Decider' : i === 2 || i === 3 ? 'Pick' : 'Ban');
export const slotColor = (i: number) => (i === 6 ? DECIDER_COLOR : i === 2 || i === 3 ? PICK_COLOR : BAN_COLOR);
// Per-team label for the table: each team has Ban 1, Pick and Ban 2
export const slotLabel = (i: number) => (i === 6 ? 'Decider' : i === 2 || i === 3 ? 'Pick' : i < 2 ? 'Ban 1' : 'Ban 2');

const fmt = (p: number) => `${(p * 100).toFixed(1)}%`;
// Stable empty value, so a pair without stored state doesn't recompute the distribution every render
const NO_LOCKS: string[] = [];

export interface CompareVeto {
  snap: VetoSnapshot;
  dist: VetoDistribution;
  teamA: string;            // team that opens the veto
  teamB: string;
  leftStarts: boolean;
  swap: () => void;
  locked: string[];
  setLocked: (l: string[]) => void;
  picking: boolean;
  setPicking: (p: boolean) => void;
  /** Column of the team acting in slot i ('left' | 'right'), null for the decider */
  sideOf: (i: number) => 'left' | 'right' | null;
}

/**
 * Most likely veto between Team Left and Team Right. Left opens the veto unless swapped.
 * The swap and the locked steps belong to one pair of teams: they are stored with the pair's key,
 * so picking other teams starts over without an effect.
 */
export function useCompareVeto(model: VetoModelCore | null | undefined, left: string, right: string): CompareVeto | null {
  const snap = useMemo(
    () => (model && model.teamMap.length > 0 ? buildSnapshot(model.teamMap, model.maps, model.coef, model.meta) : null),
    [model]
  );
  const pairKey = `${left}|${right}`;
  const fresh = { key: pairKey, leftStarts: true, locked: NO_LOCKS, picking: false };
  const [stored, setStored] = useState(fresh);
  const state = stored.key === pairKey ? stored : fresh;
  const update = (patch: Partial<typeof fresh>) => setStored({ ...state, ...patch });

  const teamA = state.leftStarts ? left : right;
  const teamB = state.leftStarts ? right : left;
  const pool = useMemo(() => snap?.defaultPool ?? [], [snap]);
  const ready = !!snap && !!left && !!right && left !== right && pool.length === 7;
  const dist = useMemo(
    () => (ready ? vetoDistribution(snap!, teamA, teamB, pool, state.locked) : null),
    [ready, snap, teamA, teamB, pool, state.locked]
  );
  if (!ready || !dist) return null;

  return {
    snap: snap!, dist, teamA, teamB,
    leftStarts: state.leftStarts,
    swap: () => update({ leftStarts: !state.leftStarts, locked: [], picking: false }),
    locked: state.locked,
    setLocked: locked => update({ locked, picking: false }),
    picking: state.picking,
    setPicking: picking => update({ picking }),
    sideOf: i => {
      const actor = SLOT_ACTOR[SLOTS[i]];
      if (!actor) return null;
      return (actor === 'A') === state.leftStarts ? 'left' : 'right';
    },
  };
}

export function CompareVetoPanel({ veto, teamLogos = {}, mapImages = {} }: {
  veto: CompareVeto;
  teamLogos?: Record<string, string>;
  mapImages?: Record<string, string>;
}) {
  const { snap, dist, teamA, teamB, locked, setLocked, picking, setPicking } = veto;
  const nameOf = (i: number) => {
    const actor = SLOT_ACTOR[SLOTS[i]];
    return actor === 'A' ? teamA : actor === 'B' ? teamB : '';
  };
  const nextStep = locked.length;
  const nextProbs = picking && nextStep < 6
    ? Object.entries(stepProbabilities(snap, teamA, teamB, dist.pool, locked)).sort((x, y) => y[1] - x[1])
    : [];
  const unknown = ([[teamA, dist.nSeries.a], [teamB, dist.nSeries.b]] as const).filter(([, n]) => n === 0);

  return (
    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">
          Most likely veto <span className="text-gray-200">{fmt(dist.mostLikely.p)}</span>
        </h2>
        <button
          onClick={veto.swap}
          title="Swap which team opens the veto (the teams stay in their columns)"
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
        >
          <ArrowLeftRight className="w-3 h-3" />
          {teamLogos[teamA] && <img src={teamLogos[teamA]} alt={teamA} className="w-4 h-4 object-contain" />}
          {teamA} starts
        </button>
        {locked.length > 0 && (
          <>
            <button
              onClick={() => setLocked(locked.slice(0, -1))}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
            >
              <Undo2 className="w-3 h-3" /> Undo
            </button>
            <button
              onClick={() => setLocked([])}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </>
        )}
        <span className="text-[10px] text-gray-500">
          Veto model snapshot {snap.snapshotDate} · does not follow the tournament filters
        </span>
      </div>

      {unknown.length > 0 && (
        <span className="text-[11px] font-bold uppercase tracking-widest text-yellow-400">
          {unknown.map(([t]) => t).join(', ')}: no BO3 history in the model, using average behavior
        </span>
      )}

      <div className="flex flex-wrap gap-3">
        {dist.mostLikely.maps.map((map, i) => {
          const isLocked = i < locked.length;
          const isNext = i === nextStep && i < 6;
          return (
            <button
              key={i}
              disabled={!isNext}
              onClick={() => setPicking(!picking)}
              className={`w-[110px] flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 bg-[#0f1115] transition-colors ${
                isNext ? 'cursor-pointer hover:bg-[#252a33]' : 'cursor-default'
              } ${isNext && picking ? 'ring-2 ring-gray-400' : ''}`}
              style={{ borderColor: slotColor(i), borderStyle: isNext ? 'dashed' : 'solid' }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: slotColor(i) }}>
                {slotKind(i)} {nameOf(i)}
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
            Step {nextStep + 1}: {slotKind(nextStep)} {nameOf(nextStep)} — choose the map
          </span>
          <div className="flex flex-wrap gap-2">
            {nextProbs.map(([map, p]) => (
              <button
                key={map}
                onClick={() => setLocked([...locked, map])}
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
  );
}
