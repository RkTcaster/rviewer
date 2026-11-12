// Data audit after a vlr-scraper upload: node scripts/data-audit.mjs
// Read-only, with the anon key (what rviewer sees: RLS returning 0 rows shows up here too).
// Lines starting with ⚠ are the things to check or report to vlr-scraper.
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local', quiet: true });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const warn = msg => console.log(`⚠ ${msg}`);
const section = title => console.log(`\n=== ${title}`);

// Exact counts on the big tables can hit the statement timeout under load (empty error): retried
// after 1 s and 2 s, like fetchAllPages
async function count(table, filter = q => q) {
  for (let retry = 0; ; retry++) {
    const { count, error } = await filter(sb.from(table).select('*', { count: 'exact', head: true }));
    if (!error) return count;
    if (retry === 2) throw new Error(`${table}: ${error.message || error.code || 'timeout'}`);
    await new Promise(r => setTimeout(r, (retry + 1) * 1000));
  }
}
async function fetchAll(table, cols, filter = q => q) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await filter(sb.from(table).select(cols)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// --- Tournaments: format and filter metadata (year / stage / subregion, Phase 12)
section('Tournaments');
const tours = (await fetchAll('tournament', 'tour_id, reg_id, match_format, year, stage, subregion'))
  .sort((a, b) => a.tour_id.localeCompare(b.tour_id));
const STAGES = ['open_qualifier', 'closed_qualifier', 'kickoff', 'stage_1', 'stage_2', 'masters', 'champions', 'ewc', 'game_changers'];
for (const t of tours) {
  const isQualifier = t.stage?.endsWith('qualifier');
  if (!t.year) warn(`${t.tour_id}: no year`);
  if (!STAGES.includes(t.stage)) warn(`${t.tour_id}: stage '${t.stage}' is not a known value`);
  if (isQualifier && !t.subregion) warn(`${t.tour_id}: qualifier without subregion`);
  if (!['full', 'reduced', 'mixed'].includes(t.match_format)) warn(`${t.tour_id}: match_format '${t.match_format}'`);
}
console.log(`${tours.length} tournaments; reduced: ${tours.filter(t => t.match_format === 'reduced').length}`);

// --- Rows per tournament. round_info is the reference: one row per round
section('Rows per tournament');
console.log('tour | format | series | drafts | maps | rounds | economy | buy | stats | perf');
for (const t of tours) {
  const byTour = q => q.eq('tour_id', t.tour_id);
  const [series, drafts, maps, rounds, economy, buy, stats, perf] = await Promise.all([
    count('match_id', byTour), count('draft', byTour), count('round_info', q => byTour(q).eq('round', 1)),
    count('round_info', byTour), count('team_economy', byTour), count('round_buy', byTour),
    count('player_stats', byTour), count('player_performance', byTour),
  ]);
  console.log([t.tour_id, t.match_format, series, drafts, maps, rounds, economy, buy, stats, perf].join(' | '));
  const id = t.tour_id;
  if (t.match_format === 'full' && drafts !== series) warn(`${id}: ${series} series but ${drafts} drafts`);
  if (t.match_format === 'reduced' && drafts > 0) warn(`${id}: reduced but ${drafts} of ${series} series have draft`);
  if (economy > rounds) warn(`${id}: team_economy ${economy} > ${rounds} rounds (duplicates?)`);
  // Qualifiers: vlr cuts team_economy at round 24 (ROADMAP 11.6), so a few missing rows are expected
  else if (economy < rounds) warn(`${id}: team_economy ${economy} < ${rounds} rounds${t.match_format === 'reduced' ? ' (OT cut, 11.6)' : ''}`);
  if (buy !== rounds) warn(`${id}: round_buy ${buy} vs ${rounds} rounds`);
  if (stats !== maps * 10) warn(`${id}: player_stats ${stats} vs ${maps * 10} (10 per map)`);
  if (perf !== stats) warn(`${id}: player_performance ${perf} vs player_stats ${stats}`);
}

// --- Cache: versioned() keys on the latest round_info date (getLastUpdateDate)
section('Cache version');
const latest = async table => (await sb.from(table).select('date').order('date', { ascending: false }).limit(1)).data?.[0]?.date;
const [lastRound, lastDraft] = await Promise.all([latest('round_info'), latest('draft')]);
console.log(`round_info ${lastRound} (cache key) · draft ${lastDraft}`);

// --- Teams: tricode format and collisions (11.5). Same tricode with no shared player between a
// full and a reduced tournament = two different teams merged in `teams`.
section('Teams');
const teams = await fetchAll('teams', 'team_id, relevant');
console.log(`${teams.length} teams, ${teams.filter(t => t.relevant).length} relevant`);
const notUpper = teams.filter(t => t.team_id !== t.team_id.toUpperCase()).map(t => t.team_id);
if (notUpper.length) warn(`tricodes not in uppercase: ${notUpper.join(', ')}`);

const format = new Map(tours.map(t => [t.tour_id, t.match_format]));
const playersBy = new Map(); // team → { full: Set, reduced: Set, reducedTours: Set }
for (const r of await fetchAll('player_stats', 'team, tour_id, player_id_vlr')) {
  const e = playersBy.get(r.team) ?? playersBy.set(r.team, { full: new Set(), reduced: new Set(), reducedTours: new Set() }).get(r.team);
  if (format.get(r.tour_id) === 'reduced') { e.reduced.add(r.player_id_vlr); e.reducedTours.add(r.tour_id); }
  else e.full.add(r.player_id_vlr);
}
for (const [team, e] of playersBy) {
  if (!e.full.size || !e.reduced.size) continue;
  const shared = [...e.reduced].filter(p => e.full.has(p)).length;
  if (shared < 3) warn(`${team}: league team and a qualifier team share the tricode (${shared} players in common; ${[...e.reducedTours].join(', ')})`);
}
const sameTricode = (await fetchAll('round_info', 'series_id, teamA, teamB', q => q.eq('round', 1)))
  .filter(r => r.teamA?.trim() === r.teamB?.trim());
for (const id of new Set(sameTricode.map(r => r.series_id))) warn(`series ${id}: both teams are ${sameTricode.find(r => r.series_id === id).teamA}`);

// --- Players and agents
section('Players and agents');
const [noVlrStats, noVlrKills] = await Promise.all([
  count('player_stats', q => q.is('player_id_vlr', null)),
  count('round_events', q => q.eq('type', 'kill').is('player_id_vlr', null)),
]);
if (noVlrStats) warn(`player_stats: ${noVlrStats} rows without player_id_vlr`);
if (noVlrKills) warn(`round_events: ${noVlrKills} kills without player_id_vlr`);
const agentInfo = await fetchAll('agent_info', '*');
console.log(`${agentInfo.length} agents in agent_info`);
for (const a of agentInfo) {
  const file = a.agent_path && `public/${a.agent_path}`;
  if (file && !fs.existsSync(file)) warn(`agent image missing: ${file}`);
}
console.log('\nDone.');
