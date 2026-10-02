// result_parity.test.ts — checks resultPredict.ts against the Python reference (export/result_reference.json).
// Run: node --experimental-strip-types scripts/result-parity.test.ts [exportDir]
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildResultSnapshot, mapPrediction, predictiveScores, roundWinProb, scoreDistribution, seriesPrediction,
  tripletsFromSequences, mapWinProb, SCORES, OUTCOMES, PRIOR_TEAM, type ResultModel,
} from '../lib/resultPredict.ts';
import { buildSnapshot, enumerateSequences } from '../lib/vetoPredict.ts';

const DIR = process.argv[2] ?? 'export';
const TOL = 1e-9;

// Minimal RFC 4180 parser (quoted fields, commas inside quotes) — same as parity.test.ts
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.length > 1 || r[0] !== '');
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const csv = (name: string) => parseCsv(readFileSync(join(DIR, `${name}.csv`), 'utf8'));
const snap = buildResultSnapshot(csv('result_team') as never, csv('result_team_map') as never, csv('result_meta') as never);
const ref = JSON.parse(readFileSync(join(DIR, 'result_reference.json'), 'utf8'));
const MODELS: ResultModel[] = ['base', 'map'];

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log(`  FAIL ${msg}`); } };
const maxDiff = (a: number[], b: number[]) => a.reduce((m, x, i) => Math.max(m, Math.abs(x - b[i])), 0);

console.log(`snapshot ${snap.snapshotDate} | sigma ${snap.sigma} | default model ${snap.defaultModel} | ` +
  `${snap.models.base.teams.size - 1} teams | ${snap.models.map.teamMap.size} team-map effects | reference ${ref.snapshot_date}`);
check(snap.snapshotDate === ref.snapshot_date, 'snapshot date differs from reference');
check(Number.isFinite(snap.sigma) && snap.sigma >= 0, `sigma is not a valid number: ${snap.sigma}`);
check(snap.defaultModel === 'base' || snap.defaultModel === 'map', `invalid default model: ${snap.defaultModel}`);
check(JSON.stringify(ref.scores) === JSON.stringify(SCORES), 'SCORES order differs from Python');

// 1. Score model on its own
for (const p of [0.3, 0.45, 0.5, 0.62]) {
  const d = scoreDistribution(p), d2 = scoreDistribution(1 - p);
  check(Math.abs(d.reduce((s, x) => s + x, 0) - 1) < TOL, `scoreDistribution(${p}) sums to 1`);
  check(Math.abs(mapWinProb(d) + mapWinProb(d2) - 1) < TOL, `symmetry at p=${p}`);
  check(Math.abs(mapWinProb(predictiveScores(p, snap.sigma)) + mapWinProb(predictiveScores(1 - p, snap.sigma)) - 1) < TOL,
    `symmetry with sigma at p=${p}`);
}
check(Math.abs(mapWinProb(scoreDistribution(0.5)) - 0.5) < 1e-12, 'fair at p = 0.5');

// 2. Every reference case, both models
for (const c of ref.cases) {
  for (const model of MODELS) {
    const r = c.models[model];
    let dRound = 0, dMap = 0, dScore = 0;
    for (const m of c.pool) {
      dRound = Math.max(dRound, Math.abs(roundWinProb(snap, model, c.a, c.b, m) - r.p_round[m]));
      const mp = mapPrediction(snap, model, c.a, c.b, m);
      dMap = Math.max(dMap, Math.abs(mp.pWin - r.p_map[m]));
      dScore = Math.max(dScore, maxDiff(mp.scores, r.score_dist[m]));
      // swapping the teams gives the complement
      check(Math.abs(mapPrediction(snap, model, c.b, c.a, m).pWin + mp.pWin - 1) < TOL, `${c.a}/${c.b} ${model} ${m}: swap`);
    }
    const sp = seriesPrediction(snap, model, c.a, c.b, c.triplets);
    const dSeries = maxDiff(OUTCOMES.map(o => sp.outcomes[o]), OUTCOMES.map(o => r.series[o]));
    const sum = OUTCOMES.reduce((s, o) => s + sp.outcomes[o], 0);
    check(Math.abs(sum - 1) < TOL, `${c.a}/${c.b} ${model}: outcomes sum to ${sum}`);
    for (const [name, d] of [['round', dRound], ['map', dMap], ['score', dScore], ['series', dSeries]] as const) {
      check(d < TOL, `${c.a} vs ${c.b} [${model}]: max ${name} diff ${d}`);
    }
    console.log(`  [${model.padEnd(4)}] ${`${c.a} vs ${c.b}`.padEnd(30)} max|Δ| round ${dRound.toExponential(1)} ` +
      `map ${dMap.toExponential(1)} score ${dScore.toExponential(1)} series ${dSeries.toExponential(1)} | ` +
      `P(win series) ${(sp.pWin * 100).toFixed(1)}%`);
  }
}

// 3. Unknown team == explicit prior; base model ignores the map
const known = ref.cases[0].a as string, pool = ref.cases[0].pool as string[];
for (const model of MODELS) {
  check(roundWinProb(snap, model, '__nope__', known, pool[0]) === roundWinProb(snap, model, PRIOR_TEAM, known, pool[0]),
    `${model}: unknown team != prior`);
}
const pBase = pool.map(m => roundWinProb(snap, 'base', ref.cases[1].a, ref.cases[1].b, m));
check(pBase.every(p => p === pBase[0]), 'base model should not depend on the map');

// 4. Integration with vetoPredict: triplets from the exact veto distribution
if (existsSync(join(DIR, 'veto_meta.csv'))) {
  const vsnap = buildSnapshot(csv('veto_team_map') as never, csv('veto_map') as never, csv('veto_coef') as never,
    csv('veto_meta') as never);
  const [a, b] = [ref.cases[0].a, ref.cases[0].b];
  const seqs = enumerateSequences(vsnap, a, b, vsnap.defaultPool);
  const trips = tripletsFromSequences(seqs);
  check(Math.abs(trips.reduce((s, t) => s + t.p, 0) - 1) < TOL, 'triplets from sequences sum to 1');
  check(trips.length === 7 * 6 * 5, `expected 210 triplets, got ${trips.length}`);
  const locked = enumerateSequences(vsnap, a, b, vsnap.defaultPool, seqs[0].maps.slice(0, 6));
  const one = tripletsFromSequences(locked);
  check(one.length === 1 && Math.abs(one[0].p - 1) < TOL, 'fully locked veto gives one triplet');
  for (const model of MODELS) {
    const ex = seriesPrediction(snap, model, a, b, trips);
    console.log(`  veto-integrated [${model}] ${a} vs ${b}: P(win series) ${(ex.pWin * 100).toFixed(1)}% | ` +
      OUTCOMES.map(o => `${o} ${(ex.outcomes[o] * 100).toFixed(1)}%`).join(' ') +
      ` | most likely veto ${seqs[0].maps.join(' ')}`);
  }
}

// 5. Test metrics exported for the UI
const tm = snap.testMetrics;
check(tm.nMaps > 0 && tm.nSeries > 0 && /^\d{4}-\d{2}-\d{2}$/.test(tm.since), 'test period');
check([tm.base, tm.map, tm.elo].every(x => x.mapLogLoss > 0.5 && x.mapLogLoss < 1 && x.seriesAcc > 0 && x.seriesAcc <= 1),
  'test metrics out of range');
console.log(`test metrics (${tm.nMaps} maps / ${tm.nSeries} series since ${tm.since}), log loss map | series: ` +
  `base ${tm.base.mapLogLoss.toFixed(4)} | ${tm.base.seriesLogLoss.toFixed(4)}, map ${tm.map.mapLogLoss.toFixed(4)} | ` +
  `${tm.map.seriesLogLoss.toFixed(4)}, Elo ${tm.elo.mapLogLoss.toFixed(4)} | ${tm.elo.seriesLogLoss.toFixed(4)}, ` +
  `coin ${tm.coinLogLoss.toFixed(4)}`);

// 6. Errors on bad input
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check(throws(() => seriesPrediction(snap, 'base', 'G2', 'NRG', [])), 'empty triplets should throw');
check(throws(() => seriesPrediction(snap, 'base', 'G2', 'NRG', [{ map1: pool[0], map2: pool[1], decider: pool[2], p: 0.5 }])),
  'triplets not summing to 1 should throw');

console.log(failures === 0 ? '\nPARITY OK' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
