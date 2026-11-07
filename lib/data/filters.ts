// lib/data/filters.ts — opciones de filtros (regiones, equipos, torneos)
import { supabase } from '../supabase';
import { versioned, getReducedTourIds } from './helpers';
import { Region, Tournament } from '../types';

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
