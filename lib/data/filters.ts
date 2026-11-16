// lib/data/filters.ts — opciones de filtros (regiones, equipos, torneos)
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import { versioned, getReducedTourIds, getFirstRounds } from './helpers';
import { Region, TeamOption, Tournament, TournamentNode } from '../types';
import { getTeamKeys, keyOf } from './teamKeys';
import { teamLabel } from '../teamKey';

// Every tournament with its hierarchy columns, reduced ones included (Stats Rank v2 reads their
// series from round_info, not draft). A row the scraper uploads before year is filled by hand
// falls back to the season in its tour_id, so new events don't vanish from the filter.
// Errors throw inside the cached function so a failed query isn't cached as [] (see ROADMAP 7.3).
// `tournament` and `teams` are also edited by hand in Supabase, which doesn't move the last
// round_info date `versioned` keys on: cached 5 minutes instead, so an edit shows up soon.
const getTournamentTreeCached = unstable_cache(getTournamentTree_impl, ['tournament-tree-v2'], { revalidate: 300 });
export async function getTournamentTree(): Promise<TournamentNode[]> {
  try { return await getTournamentTreeCached(); } catch (error) {
    console.error('[getTournamentTree] Supabase error:', error);
    return [];
  }
}
async function getTournamentTree_impl(): Promise<TournamentNode[]> {
  const { data, error } = await supabase
    .from('tournament')
    .select('tour_id, event, reg_id, year, subregion, stage');
  if (error) throw error;
  return (data ?? []).map(t => ({
    ...t,
    year: t.year != null ? Number(t.year) : Number(t.tour_id.match(/20\d{2}/)?.[0]) || null,
  }));
}

// Teams marked `relevant` in Supabase (ROADMAP 11.3), shown by default on the new main filter.
// v2: vlr team ids (team_id_vlr) instead of tricodes, which different teams share
const getRelevantTeamsCached = unstable_cache(getRelevantTeams_impl, ['relevant-teams-v3'], { revalidate: 300 });
export async function getRelevantTeams(): Promise<string[]> {
  try { return await getRelevantTeamsCached(); } catch (error) {
    console.error('[getRelevantTeams] Supabase error:', error);
    return [];
  }
}
async function getRelevantTeams_impl(): Promise<string[]> {
  const { data, error } = await supabase.from('teams').select('team_id_vlr').eq('relevant', true);
  if (error) throw error;
  return (data ?? []).map(t => t.team_id_vlr);
}

// Keys (getTeamKeys) of the relevant teams that played the given tournaments, for the team lists:
// the stats are keyed the same way. Taken from round_info by vlr id, so a team only shows up when
// the relevant team itself played the selection.
// `extra`: vlr ids the visitor added to Relevant from the filter (URL `addTeams`).
export async function getRelevantTags(tour?: string, extra: string[] = []): Promise<string[]> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];
  const [ids, rounds, keys] = await Promise.all([getRelevantTeams(), getFirstRounds(tours.sort().join(',')), getTeamKeys()]);
  const relevant = new Set([...ids, ...extra]);
  const tags = new Set<string>();
  for (const r of rounds) {
    for (const id of [r.team_a_id_vlr, r.team_b_id_vlr]) if (id && relevant.has(id)) tags.add(keyOf(keys, id)!);
  }
  return [...tags].sort();
}

// Team select of the team pages on the new main filter: the teams (vlr id) that played the given
// tournaments, relevant only unless `all`. `tag` is the team's key (getTeamKeys), what the stats
// are keyed by; the label is its tag, plus the name when two options show the same tag.
// `selected` is the team to show: `teamId` when it still goes with `tag` (the other team pages
// only write the key), else the team with that key. It is listed even when the filter leaves it out.
const getTeamNames = unstable_cache(async () => {
  const { data, error } = await supabase.from('teams').select('team_id_vlr, team_id, name, relevant');
  if (error) throw error;
  return (data ?? []) as { team_id_vlr: string; team_id: string; name: string | null; relevant: boolean | null }[];
}, ['team-names-v2'], { revalidate: 300 });
export async function getTeamOptions(tour: string | undefined, all: boolean, tag?: string, teamId?: string, extra: string[] = []): Promise<{ options: TeamOption[]; selected: TeamOption | null }> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  const [teams, rounds, keys] = await Promise.all([getTeamNames(), tours.length ? getFirstRounds(tours.sort().join(',')) : [], getTeamKeys()]);
  const byId = new Map(teams.map(t => [t.team_id_vlr, t]));
  const played = new Set<string>();
  for (const r of rounds) {
    if (r.team_a_id_vlr) played.add(r.team_a_id_vlr);
    if (r.team_b_id_vlr) played.add(r.team_b_id_vlr);
  }
  const keyById = (id: string) => keyOf(keys, id)!;
  const idByKey = new Map(Object.entries(keys).map(([id, key]) => [key, id]));
  const selectedId = teamId && (!tag || keyById(teamId) === tag) && byId.has(teamId) ? teamId
    : tag ? idByKey.get(tag)
    : undefined;

  const ids = [...played].filter(id => all || byId.get(id)?.relevant || extra.includes(id));
  if (selectedId && !ids.includes(selectedId)) ids.push(selectedId);
  const count: Record<string, number> = {};
  for (const id of ids) count[teamLabel(keyById(id))] = (count[teamLabel(keyById(id))] ?? 0) + 1;
  const options = ids
    .map(id => {
      const key = keyById(id), shown = teamLabel(key);
      return { id, tag: key, label: count[shown] > 1 ? `${shown} · ${byId.get(id)?.name ?? id}` : shown };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return { options, selected: options.find(o => o.id === selectedId) ?? null };
}

// Teams a visitor can add to Relevant from the filter: the ones that played the given tournaments
// and are not marked relevant, labeled "TAG · name" so the search finds either
export async function getAddableTeams(tour?: string): Promise<TeamOption[]> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];
  const [teams, rounds, keys] = await Promise.all([getTeamNames(), getFirstRounds(tours.sort().join(',')), getTeamKeys()]);
  const byId = new Map(teams.map(t => [t.team_id_vlr, t]));
  const played = new Set<string>();
  for (const r of rounds) {
    if (r.team_a_id_vlr) played.add(r.team_a_id_vlr);
    if (r.team_b_id_vlr) played.add(r.team_b_id_vlr);
  }
  return [...played]
    .filter(id => !byId.get(id)?.relevant)
    .map(id => {
      const tag = keyOf(keys, id)!, shown = teamLabel(tag);
      return { id, tag, label: byId.get(id)?.name ? `${shown} · ${byId.get(id)!.name}` : shown };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Keys of every team that played the given tournaments (Meta Shift team lists on All teams)
export async function getPlayedTags(tour?: string): Promise<string[]> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];
  const [rounds, keys] = await Promise.all([getFirstRounds(tours.sort().join(',')), getTeamKeys()]);
  const tags = new Set<string>();
  for (const r of rounds) {
    for (const id of [r.team_a_id_vlr, r.team_b_id_vlr]) if (id) tags.add(keyOf(keys, id)!);
  }
  return [...tags].sort();
}

export const getRegions = versioned('regions', getRegions_impl);
async function getRegions_impl(): Promise<Region[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('reg_id, region')
    .order('region');

  if (error) {
    console.error('[getRegions] Supabase error:', error);
    return [];
  }
  return data ?? [];
}

export async function getTeams(regId?: string[]): Promise<string[]> {
  let query = supabase.from('tournament_played').select('teamA, reg_id, tour_id');

  if (regId && regId.length > 0) {
    query = query.in('reg_id', regId);
  }

  const [{ data, error }, reduced] = await Promise.all([query, getReducedTourIds()]);
  if (error) {
    console.error("Error en getTeams:", error);
    return [];
  }

  const set = new Set(data?.filter(item => !reduced.has(item.tour_id)).map(item => item.teamA));
  return Array.from(set).sort() as string[];
}

export async function getTours(teamName?: string, regId?: string[]): Promise<Tournament[]> {
  if (!teamName) return [];

  let query = supabase
    .from('tournament_played')
    .select('tour_id, event, reg_id')
    .eq('teamA', teamName);

  if (regId && regId.length > 0) query = query.in('reg_id', regId);

  const [{ data }, reduced] = await Promise.all([query, getReducedTourIds()]);


  const unique = data?.reduce((acc: Tournament[], current) => {
    if (!reduced.has(current.tour_id) && !acc.find(item => item.tour_id === current.tour_id)) acc.push(current);
    return acc;
  }, []);

  return (unique || []).sort((a, b) => a.event.localeCompare(b.event));
}

export const getAllTours = versioned('all-tours', getAllTours_impl);
async function getAllTours_impl(regId?: string[]): Promise<Tournament[]> {
  let query = supabase.from('tournament_played').select('tour_id, event, reg_id');
  if (regId && regId.length > 0) query = query.in('reg_id', regId);
  const [{ data }, reduced] = await Promise.all([query, getReducedTourIds()]);
  const unique = data?.reduce((acc: Tournament[], cur) => {
    if (!reduced.has(cur.tour_id) && !acc.find(t => t.tour_id === cur.tour_id)) acc.push(cur);
    return acc;
  }, []);
  return (unique || []).sort((a, b) => a.event.localeCompare(b.event));
}
