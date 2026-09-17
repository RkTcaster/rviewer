// parity.test.ts — checks vetoPredict.ts against the Python reference (export/veto_referencia.json).
// Run: node --experimental-strip-types scripts/veto-parity.test.ts data
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSnapshot, enumerateSequences, stepProbabilities, vetoDistribution, SLOTS, PRIOR_TEAM } from '../lib/vetoPredict.ts';

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
const ref = JSON.parse(readFileSync(join(DIR, 'veto_referencia.json'), 'utf8'));

let failures = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { failures++; console.log(`  FAIL ${msg}`); } };

console.log(`snapshot ${snap.snapshotDate} | model ${snap.model} | ${snap.features.length} features | ` +
  `${snap.teamStats.size - 1} teams | reference ${ref.snapshot_date}`);
check(snap.snapshotDate === ref.snapshot_date, 'snapshot date differs from reference');

for (const c of ref.casos) {
  const t0 = performance.now();
  const seqs = enumerateSequences(snap, c.a, c.b, c.pool, c.locked);
  const ms = performance.now() - t0;

  // 1. Every sequence probability
  const pyKeys = Object.keys(c.sequences);
  let maxSeq = 0;
  check(seqs.length === pyKeys.length, `${c.nombre}: ${seqs.length} sequences vs ${pyKeys.length} in Python`);
  for (const s of seqs) {
    const py = c.sequences[s.maps.join('|')];
    if (py === undefined) { check(false, `${c.nombre}: unexpected sequence ${s.maps.join('|')}`); continue; }
    maxSeq = Math.max(maxSeq, Math.abs(py - s.p));
  }

  // 2. Every step state
  let maxStep = 0;
  for (const [key, probs] of Object.entries(c.states as Record<string, Record<string, number>>)) {
    const ts = stepProbabilities(snap, c.a, c.b, c.pool, key === '' ? [] : key.split(','));
    check(Object.keys(ts).length === Object.keys(probs).length, `${c.nombre}: state [${key}] size`);
    for (const [m, p] of Object.entries(probs)) maxStep = Math.max(maxStep, Math.abs(p - (ts[m] ?? NaN)));
  }
  check(maxSeq < TOL, `${c.nombre}: max sequence diff ${maxSeq}`);
  check(maxStep < TOL, `${c.nombre}: max step diff ${maxStep}`);

  // 3. Internal consistency of the summary
  const dist = vetoDistribution(snap, c.a, c.b, c.pool, c.locked);
  const total = seqs.reduce((s, x) => s + x.p, 0);
  check(Math.abs(total - 1) < TOL, `${c.nombre}: sequences sum to ${total}`);
  for (const m of c.pool) {
    const row = SLOTS.reduce((s, sl) => s + dist.marginals[m][sl], 0);
    check(Math.abs(row - 1) < TOL, `${c.nombre}: marginal row ${m} sums to ${row}`);
  }
  for (const sl of SLOTS) {
    const col = c.pool.reduce((s: number, m: string) => s + dist.marginals[m][sl], 0);
    check(Math.abs(col - 1) < TOL, `${c.nombre}: marginal slot ${sl} sums to ${col}`);
  }
  check(seqs.every(s => c.locked.every((m: string, i: number) => s.maps[i] === m)), `${c.nombre}: locked prefix`);
  check(dist.mostLikely.maps.join('|') === seqs[0].maps.join('|'), `${c.nombre}: mostLikely`);

  console.log(`  ${c.nombre.padEnd(20)} ${`${c.a} vs ${c.b}`.padEnd(32)} seqs ${String(seqs.length).padStart(4)} | ` +
    `max|Δ| seq ${maxSeq.toExponential(1)} step ${maxStep.toExponential(1)} | ${ms.toFixed(1)} ms | ` +
    `most likely ${(dist.mostLikely.p * 100).toFixed(1)}% ${dist.mostLikely.maps.join(' ')}`);
}

// 4. Unknown team == explicit prior
const pool = snap.defaultPool;
const unknown = enumerateSequences(snap, '__nope__', 'G2', pool);
const prior = enumerateSequences(snap, PRIOR_TEAM, 'G2', pool);
check(unknown.every((s, i) => s.maps.join() === prior[i].maps.join() && s.p === prior[i].p), 'unknown team != prior');

// 5. Errors on bad input
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', pool.slice(0, 6))), 'pool of 6 should throw');
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', pool, ['Icebox'])), 'locked map outside pool should throw');
check(throws(() => enumerateSequences(snap, 'G2', 'NRG', [...pool.slice(0, 6), 'Mapa_X'])), 'unknown map should throw');

console.log(failures === 0 ? '\nPARITY OK' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
