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
      stats[map] = { 
        mapName: map, 
        picks: 0, 
        bans: 0, 
        deciders: 0, 
        rivalPicks: 0, 
        rivalBans: 0 
      };
    }
  };

  matches.forEach((m) => {
    const isTeam1 = m.team === targetTeam;
    const boType = Number(m.bo);

    // --- 1. PICKS Y BANS DEL EQUIPO SELECCIONADO (Ya lo tenías) ---
    const teamPick1 = isTeam1 ? m.team_1_select_2 : m.team_2_select_2;
    if (teamPick1) { initMap(teamPick1); stats[teamPick1].picks++; }

    const teamBan1 = isTeam1 ? m.team_1_select_1 : m.team_2_select_1;
    if (teamBan1) { initMap(teamBan1); stats[teamBan1].bans++; }

    if (boType === 5) {
      const teamPick2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (teamPick2) { initMap(teamPick2); stats[teamPick2].picks++; }
    } else if (boType === 3) {
      const teamBan2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (teamBan2) { initMap(teamBan2); stats[teamBan2].bans++; }
    }

    // --- 2. PICKS Y BANS DEL RIVAL (NUEVA LÓGICA) ---
    
    // BANS RIVAL
    const rivalBan1 = isTeam1 ? m.team_2_select_1 : m.team_1_select_1;
    if (rivalBan1) { initMap(rivalBan1); stats[rivalBan1].rivalBans++; }

    if (boType === 3) {
      const rivalBan2 = isTeam1 ? m.team_2_select_3 : m.team_1_select_3;
      if (rivalBan2) { initMap(rivalBan2); stats[rivalBan2].rivalBans++; }
    }

    // PICKS RIVAL
    const rivalPick1 = isTeam1 ? m.team_2_select_2 : m.team_1_select_2;
    if (rivalPick1) { initMap(rivalPick1); stats[rivalPick1].rivalPicks++; }

    if (boType === 5) {
      const rivalPick2 = isTeam1 ? m.team_2_select_3 : m.team_1_select_3;
      if (rivalPick2) { initMap(rivalPick2); stats[rivalPick2].rivalPicks++; }
    }

    // --- 3. DECIDER ---
    if (m.decider) {
      initMap(m.decider);
      stats[m.decider].deciders++;
    }
  });

  return Object.values(stats).sort((a, b) => b.picks - a.picks);
}