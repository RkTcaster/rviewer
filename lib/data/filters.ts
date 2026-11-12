// lib/data/filters.ts — opciones de filtros (regiones, equipos, torneos)
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import { versioned, getReducedTourIds, getFirstRounds } from './helpers';
import { Region, TeamOption, Tournament, TournamentNode } from '../types';

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

// Tricodes of the relevant teams that played the given tournaments, for the team lists: the stats
// tables only carry the tricode, so this is what a section can match. Taken from round_info by
// vlr id, so a tricode only shows up when the relevant team itself played the selection.
export async function getRelevantTags(tour?: string): Promise<string[]> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];
  const [ids, rounds] = await Promise.all([getRelevantTeams(), getFirstRounds(tours.sort().join(','))]);
  const relevant = new Set(ids);
  const tags = new Set<string>();
  for (const r of rounds) {
    if (r.teamA && relevant.has(r.team_a_id_vlr ?? '')) tags.add(r.teamA.trim());
    if (r.teamB && relevant.has(r.team_b_id_vlr ?? '')) tags.add(r.teamB.trim());
  }
  return [...tags].sort();
}

// Team select of the team pages on the new main filter: the teams (vlr id) that played the given
// tournaments, relevant only unless `all`, labeled by the tricode they played under, plus the name
// when two options share it. `selected` is the team to show: `teamId` when it still goes with
// `tag` (the other team pages only write the tricode), else the team with that tricode, taken
// from the selection first and a relevant one first. It is listed even when the filter leaves it out.
const getTeamNames = unstable_cache(async () => {
  const { data, error } = await supabase.from('teams').select('team_id_vlr, team_id, name, relevant');
  if (error) throw error;
  return (data ?? []) as { team_id_vlr: string; team_id: string; name: string | null; relevant: boolean | null }[];
}, ['team-names-v2'], { revalidate: 300 });
export async function getTeamOptions(tour: string | undefined, all: boolean, tag?: string, teamId?: string): Promise<{ options: TeamOption[]; selected: TeamOption | null }> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  const [teams, rounds] = await Promise.all([getTeamNames(), tours.length ? getFirstRounds(tours.sort().join(',')) : []]);
  const byId = new Map(teams.map(t => [t.team_id_vlr, t]));
  const played = new Map<string, string>();
  for (const r of rounds) {
    if (r.team_a_id_vlr && r.teamA) played.set(r.team_a_id_vlr, r.teamA.trim());
    if (r.team_b_id_vlr && r.teamB) played.set(r.team_b_id_vlr, r.teamB.trim());
  }
  const tagOf = (id: string) => played.get(id) ?? byId.get(id)?.team_id ?? '';
  const relevantFirst = (ids: string[]) => ids.find(id => byId.get(id)?.relevant) ?? ids[0];
  const selectedId = teamId && (!tag || tagOf(teamId) === tag) && (played.has(teamId) || byId.has(teamId)) ? teamId
    : tag ? relevantFirst([...played].filter(([, t]) => t === tag).map(([id]) => id))
      ?? relevantFirst(teams.filter(t => t.team_id === tag).map(t => t.team_id_vlr))
    : undefined;

  const ids = [...played.keys()].filter(id => all || byId.get(id)?.relevant);
  if (selectedId && !ids.includes(selectedId)) ids.push(selectedId);
  const count: Record<string, number> = {};
  for (const id of ids) count[tagOf(id)] = (count[tagOf(id)] ?? 0) + 1;
  const options = ids
    .map(id => ({ id, tag: tagOf(id), label: count[tagOf(id)] > 1 ? `${tagOf(id)} · ${byId.get(id)?.name ?? id}` : tagOf(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { options, selected: options.find(o => o.id === selectedId) ?? null };
}

// Tricodes of every team that played the given tournaments (Meta Shift team lists on All teams)
export async function getPlayedTags(tour?: string): Promise<string[]> {
  const tours = tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];
  const rounds = await getFirstRounds(tours.sort().join(','));
  const tags = new Set<string>();
  for (const r of rounds) {
    if (r.teamA) tags.add(r.teamA.trim());
    if (r.teamB) tags.add(r.teamB.trim());
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
