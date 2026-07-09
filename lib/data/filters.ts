// lib/data/filters.ts — opciones de filtros (regiones, equipos, torneos)
import { supabase } from '../supabase';
import { versioned } from './helpers';
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
  let query = supabase.from('tournament_played').select('teamA, reg_id');

  if (regId && regId.length > 0) {
    query = query.in('reg_id', regId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error en getTeams:", error);
    return [];
  }

  const set = new Set(data?.map(item => item.teamA));
  return Array.from(set).sort() as string[];
}

export async function getTours(teamName?: string, regId?: string[]): Promise<Tournament[]> {
  if (!teamName) return [];

  let query = supabase
    .from('tournament_played')
    .select('tour_id, event, reg_id')
    .eq('teamA', teamName);

  if (regId && regId.length > 0) query = query.in('reg_id', regId);

  const { data } = await query;


  const unique = data?.reduce((acc: Tournament[], current) => {
    if (!acc.find(item => item.tour_id === current.tour_id)) acc.push(current);
    return acc;
  }, []);

  return (unique || []).sort((a, b) => a.event.localeCompare(b.event));
}

export const getAllTours = versioned('all-tours', getAllTours_impl);
async function getAllTours_impl(regId?: string[]): Promise<Tournament[]> {
  let query = supabase.from('tournament_played').select('tour_id, event, reg_id');
  if (regId && regId.length > 0) query = query.in('reg_id', regId);
  const { data } = await query;
  const unique = data?.reduce((acc: Tournament[], cur) => {
    if (!acc.find(t => t.tour_id === cur.tour_id)) acc.push(cur);
    return acc;
  }, []);
  return (unique || []).sort((a, b) => a.event.localeCompare(b.event));
}
