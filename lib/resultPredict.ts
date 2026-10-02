// resultPredict.ts — BO3 map and series result predictor (round-level GLM after Adam / EEA TP).
//
// Port of the Python model in map_result_glm.ipynb (section 10). No dependencies.
// The model predicts p = P(team A wins a round) on a map; the final score distribution then
// follows exactly from Valorant's rules (first to 13, overtime won by 2), widened by a map-level
// random effect (sigma, Gauss-Hermite quadrature). Three map probabilities give the series.
//
// The snapshot stores, per model, one strength per team (current lineup, player effects and
// lineup rating already summed) and optional (team, map) effects, so:
//   logit p_round(A, B, map) = s_A − s_B + t_{A,map} − t_{B,map}
// Only differences of strengths are meaningful. Unknown teams use the __prior__ row.
//
// Two models ship in the same snapshot:
//   'base' — the CV-chosen model; no map term, so P(win) is the same on every map and the veto
//            does not change it.
//   'map'  — base + (team, map) effects; P(win) depends on the veto. Measures slightly worse.
//
// Parity with Python is checked by result_parity.test.ts against export/result_reference.json.
//
// Usage (with vetoPredict.ts):
//   const rs = buildResultSnapshot(teamRows, teamMapRows, metaRows);
//   const seqs = enumerateSequences(vetoSnap, 'G2', 'NRG', pool, locked);
//   const pred = seriesPrediction(rs, 'base', 'G2', 'NRG', tripletsFromSequences(seqs));
//   pred.pWin, pred.outcomes['2-1'], pred.maps.get('Lotus')!.mostLikelyScore

export const PRIOR_TEAM = '__prior__';
export const OUTCOMES = ['2-0', '2-1', '1-2', '0-2'] as const; // from team A's side
export type Outcome = (typeof OUTCOMES)[number];
export type ResultModel = 'base' | 'map';

type Num = number | string; // CSV / Supabase rows may come as strings

export type ResultTeamRow = { model: string; team: string; strength: Num; lineup: string; lineup_rating: Num; n_maps: Num };
export type ResultTeamMapRow = { model: string; team: string; map: string; coef: Num };
export type MetaRow = { key: string; value: string };

export interface ModelMetrics { mapLogLoss: number; mapAcc: number; seriesLogLoss: number; seriesAcc: number }

/** Held-out test metrics exported by the notebook (walk-forward, maps / series since `since`). */
export interface ResultTestMetrics {
  since: string;
  nMaps: number;
  nSeries: number;
  base: ModelMetrics;
  map: ModelMetrics;
  elo: ModelMetrics;            // Elo baseline, for context
  coinLogLoss: number;          // ln 2
}

export interface TeamInfo { strength: number; lineup: string[]; lineupRating: number; nMaps: number }

export interface ResultSnapshot {
  models: Record<ResultModel, { teams: Map<string, TeamInfo>; teamMap: Map<string, number> }>; // teamMap key: team|map
  sigma: number;
  defaultModel: ResultModel;
  snapshotDate: string;
  testMetrics: ResultTestMetrics;
}

export function buildResultSnapshot(teams: ResultTeamRow[], teamMap: ResultTeamMapRow[], meta: MetaRow[]): ResultSnapshot {
  const empty = () => ({ teams: new Map<string, TeamInfo>(), teamMap: new Map<string, number>() });
  const models: ResultSnapshot['models'] = { base: empty(), map: empty() };
  for (const r of teams) {
    const m = models[r.model as ResultModel];
    if (!m) continue;
    m.teams.set(r.team, {
      strength: Number(r.strength), lineup: r.lineup ? String(r.lineup).split('|') : [],
      lineupRating: Number(r.lineup_rating), nMaps: Number(r.n_maps),
    });
  }
  for (const r of teamMap) models[r.model as ResultModel]?.teamMap.set(`${r.team}|${r.map}`, Number(r.coef));
  for (const k of ['base', 'map'] as ResultModel[]) {
    if (!models[k].teams.has(PRIOR_TEAM)) throw new Error(`result snapshot is missing the ${PRIOR_TEAM} row of model '${k}'`);
  }
  const m = Object.fromEntries(meta.map(r => [r.key, String(r.value)]));
  const metrics = (p: string): ModelMetrics => ({
    mapLogLoss: Number(m[`${p}_map_log_loss`]), mapAcc: Number(m[`${p}_map_acc`]),
    seriesLogLoss: Number(m[`${p}_series_log_loss`]), seriesAcc: Number(m[`${p}_series_acc`]),
  });
  return {
    models, sigma: Number(m.sigma), defaultModel: (m.default_model as ResultModel) ?? 'base', snapshotDate: m.snapshot_date,
    testMetrics: {
      since: m.test_since, nMaps: Number(m.n_maps_test), nSeries: Number(m.n_series_test),
      base: metrics('base'), map: metrics('map'), elo: metrics('elo'), coinLogLoss: Number(m.coin_map_log_loss),
    },
  };
}

export function knownResultTeam(snap: ResultSnapshot, team: string): boolean {
  return team !== PRIOR_TEAM && snap.models.base.teams.has(team);
}

/** Team info used for predictions (current lineup etc.); unknown teams get the prior. */
export function teamInfo(snap: ResultSnapshot, model: ResultModel, team: string): TeamInfo {
  const t = snap.models[model].teams;
  return t.get(team) ?? t.get(PRIOR_TEAM)!;
}

// --- Score model -----------------------------------------------------------------------------

const OT_MAX = 40;
/** Every reachable final score [roundsA, roundsB], in the notebook's order. */
export const SCORES: [number, number][] = [
  ...Array.from({ length: 12 }, (_, k) => [13, k] as [number, number]),
  ...Array.from({ length: 12 }, (_, k) => [k, 13] as [number, number]),
  ...Array.from({ length: OT_MAX }, (_, j) => [14 + j, 12 + j] as [number, number]),
  ...Array.from({ length: OT_MAX }, (_, j) => [12 + j, 14 + j] as [number, number]),
];

function comb(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r); // exact for the small n used here
}
const REG = Array.from({ length: 12 }, (_, k) => comb(12 + k, k));
const TIE = comb(24, 12);

/** P(final score) over SCORES for a round-win probability p (rounds independent). */
export function scoreDistribution(p: number): number[] {
  const q = 1 - p;
  const tie = TIE * p ** 12 * q ** 12;
  const out = [
    ...REG.map((c, k) => c * p ** 13 * q ** k),
    ...REG.map((c, k) => c * q ** 13 * p ** k),
    ...Array.from({ length: OT_MAX }, (_, j) => tie * (2 * p * q) ** j * p ** 2),
    ...Array.from({ length: OT_MAX }, (_, j) => tie * (2 * p * q) ** j * q ** 2),
  ];
  const total = out.reduce((s, x) => s + x, 0);
  return out.map(x => x / total);
}

// Gauss-Hermite (probabilists') nodes and normalised weights, 21 points: scipy roots_hermitenorm(21)
const GH_X = [-7.849382895113822, -6.751444718717461, -5.8293820073044715, -4.994963944782025, -4.214343981688422,
  -3.4698466904753764, -2.7505929810523733, -2.049102468257163, -1.3597658232112302, -0.678045692440644, 0.0,
  0.678045692440644, 1.3597658232112302, 2.049102468257163, 2.7505929810523733, 3.4698466904753764, 4.214343981688422,
  4.994963944782025, 5.8293820073044715, 6.751444718717461, 7.849382895113822];
const GH_W = [2.0989912195656533e-14, 4.9753686041216766e-11, 1.4506612844930736e-08, 1.225354836148265e-06,
  4.219234742551706e-05, 0.0007080477954815327, 0.006439697051408775, 0.03395272978654282, 0.10839228562641944,
  0.21533371569505977, 0.2702601835728771, 0.21533371569505977, 0.10839228562641944, 0.03395272978654282,
  0.006439697051408775, 0.0007080477954815327, 4.219234742551706e-05, 1.225354836148265e-06, 1.4506612844930736e-08,
  4.9753686041216766e-11, 2.0989912195656533e-14];

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Score distribution with a N(0, sigma²) map-level effect on logit(p). */
export function predictiveScores(p: number, sigma: number): number[] {
  if (sigma === 0) return scoreDistribution(p);
  const eta = Math.log(p / (1 - p));
  const acc = new Array(SCORES.length).fill(0);
  GH_X.forEach((x, i) => {
    const d = scoreDistribution(sigmoid(eta + sigma * x));
    for (let k = 0; k < acc.length; k++) acc[k] += GH_W[i] * d[k];
  });
  return acc;
}

export function mapWinProb(dist: number[]): number {
  return SCORES.reduce((s, [a, b], i) => s + (a > b ? dist[i] : 0), 0);
}

// --- Predictions ----------------------------------------------------------------------------

/** P(A wins a round) on `map` (the base model ignores the map). */
export function roundWinProb(snap: ResultSnapshot, model: ResultModel, teamA: string, teamB: string, map: string): number {
  const tm = snap.models[model].teamMap;
  const t = (team: string) => tm.get(`${team}|${map}`) ?? 0;
  const logit = teamInfo(snap, model, teamA).strength - teamInfo(snap, model, teamB).strength + t(teamA) - t(teamB);
  return sigmoid(logit);
}

export interface MapPrediction {
  map: string;
  pRound: number;                    // P(A wins a round)
  pWin: number;                      // P(A wins the map)
  pOvertime: number;
  mostLikelyScore: [number, number]; // [roundsA, roundsB]
  expectedRoundDiff: number;         // E[roundsA − roundsB]
  scores: number[];                  // full distribution over SCORES
}

export function mapPrediction(snap: ResultSnapshot, model: ResultModel, teamA: string, teamB: string, map: string): MapPrediction {
  const pRound = roundWinProb(snap, model, teamA, teamB, map);
  const scores = predictiveScores(pRound, snap.sigma);
  let best = 0;
  scores.forEach((p, i) => { if (p > scores[best]) best = i; });
  return {
    map, pRound, pWin: mapWinProb(scores), scores,
    pOvertime: SCORES.reduce((s, [a, b], i) => s + (Math.max(a, b) > 13 ? scores[i] : 0), 0),
    mostLikelyScore: SCORES[best],
    expectedRoundDiff: SCORES.reduce((s, [a, b], i) => s + (a - b) * scores[i], 0),
  };
}

/** P(2-0, 2-1, 1-2, 0-2) for A given its map-win probabilities on A's pick, B's pick and the decider. */
export function seriesOutcomes(p1: number, p2: number, p3: number): Record<Outcome, number> {
  return {
    '2-0': p1 * p2,
    '2-1': p1 * (1 - p2) * p3 + (1 - p1) * p2 * p3,
    '1-2': p1 * (1 - p2) * (1 - p3) + (1 - p1) * p2 * (1 - p3),
    '0-2': (1 - p1) * (1 - p2),
  };
}

/** Played maps of a veto: A's pick, B's pick, decider; with probability p. */
export interface Triplet { map1: string; map2: string; decider: string; p: number }

/** Collapses complete vetos (vetoPredict's Sequence: 7 maps in veto order) into played-map triplets. */
export function tripletsFromSequences(seqs: { maps: string[]; p: number }[]): Triplet[] {
  const acc = new Map<string, number>();
  for (const s of seqs) {
    const k = `${s.maps[2]}|${s.maps[3]}|${s.maps[6]}`;
    acc.set(k, (acc.get(k) ?? 0) + s.p);
  }
  return [...acc.entries()].map(([k, p]) => { const [map1, map2, decider] = k.split('|'); return { map1, map2, decider, p }; })
    .sort((x, y) => y.p - x.p);
}

export interface SeriesPrediction {
  model: ResultModel;
  pWin: number;                        // P(A wins the series) = P(2-0) + P(2-1)
  outcomes: Record<Outcome, number>;
  maps: Map<string, MapPrediction>;    // every map that appears in the triplets
  teamA: TeamInfo;
  teamB: TeamInfo;
  known: { a: boolean; b: boolean };   // false = not in the snapshot, prior used
}

/** Series prediction for A (team that starts the veto) vs B, marginalised over the veto triplets. */
export function seriesPrediction(snap: ResultSnapshot, model: ResultModel, teamA: string, teamB: string,
                                 triplets: Triplet[]): SeriesPrediction {
  if (!triplets.length) throw new Error('need at least one triplet');
  const total = triplets.reduce((s, t) => s + t.p, 0);
  if (Math.abs(total - 1) > 1e-6) throw new Error(`triplet probabilities sum to ${total}, not 1`);
  const maps = new Map<string, MapPrediction>();
  const pred = (m: string) => {
    if (!maps.has(m)) maps.set(m, mapPrediction(snap, model, teamA, teamB, m));
    return maps.get(m)!.pWin;
  };
  const outcomes = { '2-0': 0, '2-1': 0, '1-2': 0, '0-2': 0 } as Record<Outcome, number>;
  for (const t of triplets) {
    const o = seriesOutcomes(pred(t.map1), pred(t.map2), pred(t.decider));
    for (const k of OUTCOMES) outcomes[k] += t.p * o[k];
  }
  return {
    model, pWin: outcomes['2-0'] + outcomes['2-1'], outcomes, maps,
    teamA: teamInfo(snap, model, teamA), teamB: teamInfo(snap, model, teamB),
    known: { a: knownResultTeam(snap, teamA), b: knownResultTeam(snap, teamB) },
  };
}
