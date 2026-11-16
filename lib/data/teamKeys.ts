// lib/data/teamKeys.ts — vlr team id → the key the page uses for that team.
// Every row stores the tag the team had in that match (a team can change it mid-tournament:
// XXXM → MPMT), and different teams share tags (FUR, NOVA…), so the stats group by
// team_id_vlr and turn the id into a key: the team's current tag (teams.team_id), unique per team.
// When several teams have the same tag, the main one (relevant, else the one with more
// tournaments) keeps the bare tag and the others get `TAG~<id>`; teamLabel() shows only the tag.
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import { fetchAllPages } from './helpers';

// `teams` is edited by hand (relevant), which doesn't bust `versioned`: cached 5 minutes.
// Errors throw inside the cached function so a failed query isn't cached.
const getTeamKeysCached = unstable_cache(getTeamKeys_impl, ['team-keys-v1'], { revalidate: 300 });
export async function getTeamKeys(): Promise<Record<string, string>> {
  return getTeamKeysCached();
}
async function getTeamKeys_impl(): Promise<Record<string, string>> {
  const [teams, played] = await Promise.all([
    fetchAllPages<{ team_id_vlr: string; team_id: string; relevant: boolean | null }>((from, to) =>
      supabase.from('teams').select('team_id_vlr, team_id, relevant').order('team_id_vlr').range(from, to), 1000, true),
    fetchAllPages<{ team_id_vlr: string }>((from, to) =>
      supabase.from('tournament_played').select('team_id_vlr').order('tour_id').order('team_id_vlr').range(from, to), 1000, true),
  ]);
  const tours: Record<string, number> = {};
  for (const p of played) tours[p.team_id_vlr] = (tours[p.team_id_vlr] ?? 0) + 1;

  const byTag: Record<string, typeof teams> = {};
  for (const t of teams) (byTag[t.team_id.trim()] ??= []).push(t);
  const keys: Record<string, string> = {};
  for (const [tag, rows] of Object.entries(byTag)) {
    rows.sort((a, b) => Number(!!b.relevant) - Number(!!a.relevant)
      || (tours[b.team_id_vlr] ?? 0) - (tours[a.team_id_vlr] ?? 0)
      || Number(a.team_id_vlr) - Number(b.team_id_vlr));
    rows.forEach((t, i) => { keys[t.team_id_vlr] = i === 0 ? tag : `${tag}~${t.team_id_vlr}`; });
  }
  return keys;
}

// Key of a row's team id; an id missing from `teams` keeps its id so it never merges with another
export const keyOf = (keys: Record<string, string>, id: string | number | null | undefined) =>
  id == null || id === '' ? undefined : keys[String(id)] ?? `?~${id}`;

// vlr id of a team key (the reverse of keyOf), for queries that filter one team
export const idOf = (keys: Record<string, string>, key: string) =>
  Object.keys(keys).find(id => keys[id] === key) ?? key.split('~')[1];

// Rows keep the tag the team had in that match. Sections that group by the tag columns read the
// ids too and get the tag columns overwritten with the team key right after the query.
export function keyTeamRows<T extends { team?: string | null; team_id_vlr?: string | null }>(rows: T[], keys: Record<string, string>): T[] {
  for (const r of rows) r.team = keyOf(keys, r.team_id_vlr) ?? null;
  return rows;
}
export function keyRoundRows<T extends { teamA?: string | null; teamB?: string | null; team_a_id_vlr?: string | null; team_b_id_vlr?: string | null }>(rows: T[], keys: Record<string, string>): T[] {
  for (const r of rows) {
    r.teamA = keyOf(keys, r.team_a_id_vlr) ?? null;
    r.teamB = keyOf(keys, r.team_b_id_vlr) ?? null;
  }
  return rows;
}
