// lib/data-service.ts
import { supabase } from './supabase';

// --- TYPES ---
import { Draft, MapStat, Region, Tournament } from './types';

// --- FILTERS  ---

export async function getRegions(): Promise<Region[]> {
  const { data, error } = await supabase
    .from('regions')
    .select('reg_id, region')
    .order('region');

  if (error) return [];
  return data; 
}

export async function getTeams(regId?: string): Promise<string[]> {
  let query = supabase.from('tournament_played').select('teamA, reg_id');

  if (regId && regId !== "" && regId !== "undefined") {
    query = query.eq('reg_id', regId);
  }
  
  const { data, error } = await query;
  if (error) {
    console.error("Error en getTeams:", error);
    return [];
  }

  const set = new Set(data?.map(item => item.teamA));
  return Array.from(set).sort() as string[];
}

export async function getTours(teamName?: string, regId?: string): Promise<Tournament[]> {
  if (!teamName) return [];

  let query = supabase
    .from('tournament_played')
    .select('tour_id, event, reg_id')
    .eq('teamA', teamName);

  if (regId) query = query.eq('reg_id', regId);

  const { data } = await query;
  
 
  const unique = data?.reduce((acc: Tournament[], current) => {
    if (!acc.find(item => item.tour_id === current.tour_id)) acc.push(current);
    return acc;
  }, []);

  return unique || [];
}

// --- Stats ---

export async function getDraftStats(filters: { team: string; tour?: string; bo?: string; reg?: string }): Promise<MapStat[]> {
  let query = supabase
    .from('draft') // Tu tabla principal
    .select('*')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`);

  if (filters.tour) {
    const tourIds = filters.tour.split(','); // Convertimos "id1,id2" en ["id1", "id2"]
    query = query.in('tour_id', tourIds);   // .in() busca coincidencias con cualquier elemento de la lista
  }

  if (filters.reg) query = query.eq('reg_id', filters.reg);
  if (filters.bo && filters.bo !== "all") query = query.eq('bo', parseInt(filters.bo));

  const { data: matches } = await query;
  return procesarStats(matches as Draft[] || [], filters.team);
}


function procesarStats(matches: Draft[], targetTeam: string): MapStat[] {
  const stats: Record<string, MapStat> = {};
  const initMap = (map: string) => {
    if (map && !stats[map]) {
      stats[map] = { mapName: map, picks: 0, bans: 0, deciders: 0 };
    }
  };

  matches.forEach((m) => {
    const isTeam1 = m.team === targetTeam;
    const boType = Number(m.bo);

    // --- PICKS ---
    // BO3: solo select_2 | BO5: select_2 y select_3
    const pick1 = isTeam1 ? m.team_1_select_2 : m.team_2_select_2;
    if (pick1) { initMap(pick1); stats[pick1].picks++; }

    if (boType === 5) {
      const pick2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (pick2) { initMap(pick2); stats[pick2].picks++; }
    }

    // --- BANS ---
    // BO3: select_1 y select_3 | BO5: solo select_1
    const ban1 = isTeam1 ? m.team_1_select_1 : m.team_2_select_1;
    if (ban1) { initMap(ban1); stats[ban1].bans++; }

    if (boType === 3) {
      const ban2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (ban2) { initMap(ban2); stats[ban2].bans++; }
    }

    // --- DECIDER ---
    if (m.decider) {
      initMap(m.decider);
      stats[m.decider].deciders++;
    }
  });

  // array and order
  return Object.values(stats).sort((a, b) => b.picks - a.picks);
}