// vetoPredict.ts — BO3 map veto predictor (conditional logit, "logit_turno_v1").
//
// Port of the Python model in map_veto_lightgbm.ipynb (section 9). No dependencies.
// The snapshot (team×map stats, global map stats, coefficients) is exported by the notebook;
// this module rebuilds the per-step features, applies the logit and enumerates every
// possible veto exactly (7! = 5040 sequences, 120 distinct states), optionally conditioned
// on steps that already happened.
//
// Parity with Python is checked by parity.test.ts against export/veto_referencia.json.
// If the notebook's features change, regenerate the export and re-run that test.
//
// Usage:
//   const snap = buildSnapshot(teamMapRows, mapRows, coefRows, metaRows);
//   const dist = vetoDistribution(snap, 'G2', 'NRG', snap.defaultPool);            // G2 starts
//   const live = vetoDistribution(snap, 'G2', 'NRG', snap.defaultPool, ['Abyss']); // G2 banned Abyss

// Veto order: A = team that starts the veto (team_1), B = the other one.
export const SLOTS = ['banA1', 'banB1', 'pickA', 'pickB', 'banA2', 'banB2', 'decider'] as const;
export type Slot = (typeof SLOTS)[number];

const STEPS: { actor: 'A' | 'B'; isBan: boolean; secondBan: boolean }[] = [
  { actor: 'A', isBan: true, secondBan: false },
  { actor: 'B', isBan: true, secondBan: false },
  { actor: 'A', isBan: false, secondBan: false },
  { actor: 'B', isBan: false, secondBan: false },
  { actor: 'A', isBan: true, secondBan: true },
  { actor: 'B', isBan: true, secondBan: true },
];

export const PRIOR_TEAM = '__prior__';

const TEAM_STATS = ['ban_rate', 'pick_rate', 'fb_rate', 'winrate', 'played', 'rd_mean',
  'es_permaban', 'wr_vs_propio', 'wr_vs_esperado'] as const;
const MAP_STATS = ['ban_rate', 'pick_rate', 'ban_rate_60d', 'pick_rate_60d', 'series_en_pool'] as const;

type Num = number | string; // CSV / Supabase rows may come as strings

export type TeamMapRow = { team: string; map: string; n_series: Num } & Record<(typeof TEAM_STATS)[number], Num>;
export type MapRow = { map: string } & Record<(typeof MAP_STATS)[number], Num>;
export type CoefRow = { feature: string; mu: Num; sg: Num; b_pick: Num; b_ban: Num; b_ban2: Num };
export type MetaRow = { key: string; value: string };

export interface VetoSnapshot {
  teamStats: Map<string, Map<string, Record<string, number>>>; // team -> map -> stat
  nSeries: Map<string, number>;
  mapStats: Map<string, Record<string, number>>;
  features: { name: string; mu: number; sg: number; bPick: number; bBan: number; bBan2: number }[];
  snapshotDate: string;
  defaultPool: string[];
  model: string;
}

export function buildSnapshot(teamMap: TeamMapRow[], maps: MapRow[], coef: CoefRow[], meta: MetaRow[]): VetoSnapshot {
  const teamStats = new Map<string, Map<string, Record<string, number>>>();
  const nSeries = new Map<string, number>();
  for (const r of teamMap) {
    if (!teamStats.has(r.team)) teamStats.set(r.team, new Map());
    const rec: Record<string, number> = {};
    for (const s of TEAM_STATS) rec[s] = Number(r[s]);
    teamStats.get(r.team)!.set(r.map, rec);
    nSeries.set(r.team, Number(r.n_series));
  }
  if (!teamStats.has(PRIOR_TEAM)) throw new Error(`snapshot is missing the ${PRIOR_TEAM} rows`);

  const mapStats = new Map<string, Record<string, number>>();
  for (const r of maps) {
    const rec: Record<string, number> = {};
    for (const s of MAP_STATS) rec[s] = Number(r[s]);
    mapStats.set(r.map, rec);
  }

  const features = coef.map(c => ({
    name: c.feature, mu: Number(c.mu), sg: Number(c.sg),
    bPick: Number(c.b_pick), bBan: Number(c.b_ban), bBan2: Number(c.b_ban2),
  }));
  const m = Object.fromEntries(meta.map(r => [r.key, String(r.value)]));
  return {
    teamStats, nSeries, mapStats, features,
    snapshotDate: m.snapshot_date, model: m.model,
    defaultPool: m.default_pool ? m.default_pool.split(',') : [],
  };
}

export function knownTeam(snap: VetoSnapshot, team: string): boolean {
  return snap.teamStats.has(team) && team !== PRIOR_TEAM;
}

// Unknown teams (no BO3 history in the snapshot) fall back to the prior rows.
function statsOf(snap: VetoSnapshot, team: string): Map<string, Record<string, number>> {
  return snap.teamStats.get(team) ?? snap.teamStats.get(PRIOR_TEAM)!;
}

// Raw value of a non-rank feature for one candidate map.
function rawFeature(name: string, actor: Record<string, number>, rival: Record<string, number>,
                    global: Record<string, number>): number {
  if (name.startsWith('actor_')) return actor[name.slice(6)];
  if (name.startsWith('rival_')) return rival[name.slice(6)];
  if (name.startsWith('diff_')) return actor[name.slice(5)] - rival[name.slice(5)];
  if (name.startsWith('global_')) return global[name.slice(7)];
  throw new Error(`unsupported feature: ${name}`);
}

// pandas Series.rank(pct=True): average rank of ties, divided by n.
function pctRank(values: number[]): number[] {
  const n = values.length;
  return values.map(v => {
    let less = 0, equal = 0;
    for (const w of values) { if (w < v) less++; else if (w === v) equal++; }
    return (less + (equal + 1) / 2) / n;
  });
}

/** Probability of each available map at step taken.length + 1 (A starts the veto). */
export function stepProbabilities(snap: VetoSnapshot, teamA: string, teamB: string, pool: string[],
                                  taken: string[]): Record<string, number> {
  const step = STEPS[taken.length];
  if (!step) throw new Error('the veto has only 6 steps');
  const [actorName, rivalName] = step.actor === 'A' ? [teamA, teamB] : [teamB, teamA];
  const actor = statsOf(snap, actorName), rival = statsOf(snap, rivalName);
  const available = pool.filter(m => !taken.includes(m));

  const rows = available.map(m => {
    const a = actor.get(m), r = rival.get(m), g = snap.mapStats.get(m);
    if (!a || !r || !g) throw new Error(`map not in snapshot: ${m}`);
    return { a, r, g };
  });

  // One column per feature, over the available maps
  const cols = snap.features.map(f => {
    if (f.name.startsWith('rank_')) {
      const base = f.name.slice(5);
      return pctRank(rows.map(x => rawFeature(base, x.a, x.r, x.g)));
    }
    return rows.map(x => rawFeature(f.name, x.a, x.r, x.g));
  });

  const utility = available.map((_, i) => {
    let u = 0;
    snap.features.forEach((f, j) => {
      const z = (cols[j][i] - f.mu) / f.sg;
      u += z * f.bPick;
      if (step.isBan) u += z * f.bBan;
      if (step.secondBan) u += z * f.bBan2;
    });
    return u;
  });

  const max = Math.max(...utility);
  const e = utility.map(u => Math.exp(u - max));
  const total = e.reduce((s, x) => s + x, 0);
  return Object.fromEntries(available.map((m, i) => [m, e[i] / total]));
}

export interface Sequence { maps: string[]; p: number } // 7 maps in veto order (last = decider)

/** Every complete veto with its probability, conditioned on the locked first steps. Sums to 1. */
export function enumerateSequences(snap: VetoSnapshot, teamA: string, teamB: string, pool: string[],
                                   locked: string[] = []): Sequence[] {
  if (new Set(pool).size !== 7) throw new Error('a BO3 pool needs 7 distinct maps');
  if (locked.length > 6) throw new Error('at most 6 steps can be locked');
  const memo = new Map<string, Record<string, number>>(); // key: sorted taken maps
  const out: Sequence[] = [];

  const rec = (taken: string[], p: number) => {
    if (taken.length === 6) {
      out.push({ maps: [...taken, pool.find(m => !taken.includes(m))!], p });
      return;
    }
    if (taken.length < locked.length) {
      const m = locked[taken.length];
      if (!pool.includes(m) || taken.includes(m)) throw new Error(`invalid locked map: ${m}`);
      rec([...taken, m], p);
      return;
    }
    const key = [...taken].sort().join(',');
    let probs = memo.get(key);
    if (!probs) {
      probs = stepProbabilities(snap, teamA, teamB, pool, taken);
      memo.set(key, probs);
    }
    for (const [m, q] of Object.entries(probs)) rec([...taken, m], p * q);
  };

  rec([], 1);
  return out.sort((x, y) => y.p - x.p);
}

export interface VetoDistribution {
  teamA: string;
  teamB: string;
  pool: string[];
  locked: string[];
  mostLikely: Sequence;                               // mode of the full distribution
  sequences: Sequence[];                              // top N complete vetos
  marginals: Record<string, Record<Slot, number>>;    // map -> slot -> probability (each row sums to 1)
  playedSets: { maps: string[]; p: number }[];        // picks + decider, order ignored, top N
  categories: { bans: string[]; picks: string[]; decider: string; p: number }[]; // bans/picks as sets, top N
  nSeries: { a: number; b: number };                  // 0 = unknown team, prior used
}

function topGroups<T>(seqs: Sequence[], keyOf: (maps: string[]) => string, build: (key: string, p: number) => T,
                      topN: number): T[] {
  const acc = new Map<string, number>();
  for (const s of seqs) { const k = keyOf(s.maps); acc.set(k, (acc.get(k) ?? 0) + s.p); }
  return [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, topN).map(([k, p]) => build(k, p));
}

export function vetoDistribution(snap: VetoSnapshot, teamA: string, teamB: string, pool: string[],
                                 locked: string[] = [], topN = 10): VetoDistribution {
  const seqs = enumerateSequences(snap, teamA, teamB, pool, locked);

  const marginals: Record<string, Record<Slot, number>> = {};
  for (const m of pool) marginals[m] = Object.fromEntries(SLOTS.map(s => [s, 0])) as Record<Slot, number>;
  for (const s of seqs) s.maps.forEach((m, i) => { marginals[m][SLOTS[i]] += s.p; });

  const sorted = (xs: string[]) => [...xs].sort();
  const playedSets = topGroups(seqs, x => sorted([x[2], x[3], x[6]]).join(','),
    (k, p) => ({ maps: k.split(','), p }), topN);
  const categories = topGroups(seqs,
    x => `${sorted([x[0], x[1], x[4], x[5]]).join(',')}|${sorted([x[2], x[3]]).join(',')}|${x[6]}`,
    (k, p) => { const [b, pk, d] = k.split('|'); return { bans: b.split(','), picks: pk.split(','), decider: d, p }; },
    topN);

  return {
    teamA, teamB, pool, locked,
    mostLikely: seqs[0],
    sequences: seqs.slice(0, topN),
    marginals, playedSets, categories,
    nSeries: { a: snap.nSeries.get(teamA) ?? 0, b: snap.nSeries.get(teamB) ?? 0 },
  };
}
