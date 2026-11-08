// lib/data/filters.ts — opciones de filtros (regiones, equipos, torneos)
import { supabase } from '../supabase';
import { versioned, getReducedTourIds } from './helpers';
import { Region, Tournament, TournamentNode } from '../types';

// Every tournament with its hierarchy columns, reduced ones included (Stats Rank v2 reads their
// series from round_info, not draft). A row the scraper uploads before year is filled by hand
// falls back to the season in its tour_id, so new events don't vanish from the filter.
// Errors throw inside the cached function so a failed query isn't cached as [] (see ROADMAP 7.3).
const getTournamentTreeCached = versioned('tournament-tree-v1', getTournamentTree_impl);
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

// Teams marked `relevant` in Supabase (ROADMAP 11.3), shown by default in Stats Rank v2
const getRelevantTeamsCached = versioned('relevant-teams', getRelevantTeams_impl);
export async function getRelevantTeams(): Promise<string[]> {
  try { return await getRelevantTeamsCached(); } catch (error) {
    console.error('[getRelevantTeams] Supabase error:', error);
    return [];
  }
}
async function getRelevantTeams_impl(): Promise<string[]> {
  const { data, error } = await supabase.from('teams').select('team_id').eq('relevant', true);
  if (error) throw error;
  return (data ?? []).map(t => t.team_id);
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
