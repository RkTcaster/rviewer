// parity.test.ts — checks vetoPredict.ts against the Python reference (export/veto_reference.json).
// Run: node --experimental-strip-types scripts/veto-parity.test.ts [exportDir]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSnapshot, enumerateSequences, stepProbabilities, vetoDistribution, SLOTS, SLOT_ACTOR, PRIOR_TEAM } from '../lib/vetoPredict.ts';

const DIR = process.argv[2] ?? 'export';
const TOL = 1e-9;

// Minimal RFC 4180 parser (quoted fields, commas inside quotes)
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
const snap = buildSnapshot(csv('veto_team_map') as never, csv('veto_map') as never,
  csv('veto_coef') as never, csv('veto_meta') as never);
const ref = JSON.parse(readFileSync(join(DIR, 'veto_reference.json'), 'utf8'));

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log(`  FAIL ${msg}`); } };

console.log(`snapshot ${snap.snapshotDate} | model ${snap.model} | ${snap.features.length} features | ` +
  `${snap.teamStats.size - 1} teams | reference ${ref.snapshot_date}`);
check(snap.snapshotDate === ref.snapshot_date, 'snapshot date differs from reference');

for (const c of ref.cases) {
  const t0 = performance.now();
  const seqs = enumerateSequences(snap, c.a, c.b, c.pool, c.locked);
  const ms = performance.now() - t0;

  // 1. Every sequence probability
  const pyKeys = Object.keys(c.sequences);
  let maxSeq = 0;
  check(seqs.length === pyKeys.length, `${c.name}: ${seqs.length} sequences vs ${pyKeys.length} in Python`);
  for (const s of seqs) {
    const py = c.sequences[s.maps.join('|')];
    if (py === undefined) { check(false, `${c.name}: unexpected sequence ${s.maps.join('|')}`); continue; }
    maxSeq = Math.max(maxSeq, Math.abs(py - s.p));
  }

  // 2. Every step state
  let maxStep = 0;
  for (const [key, probs] of Object.entries(c.states as Record<string, Record<string, number>>)) {
    const ts = stepProbabilities(snap, c.a, c.b, c.pool, key === '' ? [] : key.split(','));
    check(Object.keys(ts).length === Object.keys(probs).length, `${c.name}: state [${key}] size`);
    for (const [m, p] of Object.entries(probs)) maxStep = Math.max(maxStep, Math.abs(p - (ts[m] ?? NaN)));
  }
  check(maxSeq < TOL, `${c.name}: max sequence diff ${maxSeq}`);
  check(maxStep < TOL, `${c.name}: max step diff ${maxStep}`);

  // 3. Internal consistency of the summary
  const dist = vetoDistribution(snap, c.a, c.b, c.pool, c.locked);
  const total = seqs.reduce((s, x) => s + x.p, 0);
  check(Math.abs(total - 1) < TOL, `${c.name}: sequences sum to ${total}`);
  for (const m of c.pool) {
    const row = SLOTS.reduce((s, sl) => s + dist.marginals[m][sl], 0);
    check(Math.abs(row - 1) < TOL, `${c.name}: marginal row ${m} sums to ${row}`);
  }
  for (const sl of SLOTS) {
    const col = c.pool.reduce((s: number, m: string) => s + dist.marginals[m][sl], 0);
    check(Math.abs(col - 1) < TOL, `${c.name}: marginal slot ${sl} sums to ${col}`);
  }
  check(seqs.every(s => c.locked.every((m: string, i: number) => s.maps[i] === m)), `${c.name}: locked prefix`);
  check(dist.mostLikely.maps.join('|') === seqs[0].maps.join('|'), `${c.name}: mostLikely`);

  console.log(`  ${c.name.padEnd(20)} ${`${c.a} vs ${c.b}`.padEnd(32)} seqs ${String(seqs.length).padStart(4)} | ` +
    `max|Δ| seq ${maxSeq.toExponential(1)} step ${maxStep.toExponential(1)} | ${ms.toFixed(1)} ms | ` +
    `most likely ${(dist.mostLikely.p * 100).toFixed(1)}% ${dist.mostLikely.maps.join(' ')}`);
}

// 4. Unknown team == explicit prior
const pool = snap.defaultPool;
const unknown = enumerateSequences(snap, '__nope__', 'G2', pool);
const prior = enumerateSequences(snap, PRIOR_TEAM, 'G2', pool);
check(unknown.every((s, i) => s.maps.join() === prior[i].maps.join() && s.p === prior[i].p), 'unknown team != prior');

// 5. Test metrics and veto order exported for the UI
const tm = snap.testMetrics;
check(tm !== null, 'veto_meta has no test metrics');
if (tm) {
  const metrics = [tm.top1Step, tm.played, tm.decider, tm.categories, tm.sequence];
  check(metrics.every(x => x.model > x.chance && x.model <= 1 && x.chance > 0), 'test metrics out of range');
  check(tm.nSeries > 0 && /^\d{4}-\d{2}-\d{2}$/.test(tm.since), 'test period');
  console.log(`test metrics (${tm.nSeries} series since ${tm.since}): ` +
    Object.entries({ top1Step: tm.top1Step, played: tm.played, decider: tm.decider, categories: tm.categories, sequence: tm.sequence })
      .map(([k, x]) => `${k} ${(x.model * 100).toFixed(1)}% vs ${(x.chance * 100).toFixed(2)}%`).join(' | '));
}
check(SLOTS.map(s => SLOT_ACTOR[s] ?? '-').join('') === 'ABABAB-', 'SLOT_ACTOR order');

// 6. Errors on bad input
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', pool.slice(0, 6))), 'pool of 6 should throw');
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', pool, ['Icebox'])), 'locked map outside pool should throw');
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', [...pool.slice(0, 6), 'Map_X'])), 'unknown map should throw');

console.log(failures === 0 ? '\nPARITY OK' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
