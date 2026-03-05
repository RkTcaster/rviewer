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

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string }): Promise<MapStat[]> {
  // 1. Query a la tabla de DRAFTS (Picks/Bans)
  let draftQuery = supabase.from('draft').select('*')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`);
  
  // 2. Query a la tabla de ROUNDS (Resultados)
  // Nota: Si en Supabase la columna tiene guión (vlr_id-map), 
  // a veces hay que usar comillas dobles o verificar cómo la nombró Supabase (ej: vlr_id_map)
  let roundsQuery = supabase.from('round_info').select('teamA, teamB, rndA, rndB, round, map, "vlr_id-map"')
    .or(`teamA.eq."${filters.team}",teamB.eq."${filters.team}"`);

  // Aplicar filtros de URL a ambas
  if (filters.tour) {
    const tours = filters.tour.split(',');
    draftQuery = draftQuery.in('tour_id', tours);
    roundsQuery = roundsQuery.in('tour_id', tours);
  }
  if (filters.reg) {
    draftQuery = draftQuery.eq('reg_id', filters.reg);
    roundsQuery = roundsQuery.eq('reg_id', filters.reg);
  }
  if (filters.bo && filters.bo !== 'all') {
    draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
    roundsQuery = roundsQuery.eq('bo', parseInt(filters.bo));
  }

  // Ejecutamos ambas al mismo tiempo para ganar velocidad
  const [{ data: drafts }, { data: rounds }] = await Promise.all([draftQuery, roundsQuery]);

  // Llamamos a la función procesadora
  return procesarTodo(drafts || [], rounds || [], filters.team);
}

function procesarTodo(drafts: any[], rounds: any[], targetTeam: string): MapStat[] {
  const stats: Record<string, MapStat> = {};

  const initMap = (map: string) => {
    if (map && !stats[map]) {
      stats[map] = { 
        mapName: map, picks: 0, bans: 0, deciders: 0, 
        rivalPicks: 0, rivalBans: 0, wins: 0, played: 0 
      };
    }
  };

  // --- PARTE 1: PICKS Y BANS (Lógica que ya teníamos) ---
  drafts.forEach((m) => {
    const isTeam1 = m.team === targetTeam;
    const boType = Number(m.bo);

    // Picks Equipo
    const p1 = isTeam1 ? m.team_1_select_2 : m.team_2_select_2;
    if (p1) { initMap(p1); stats[p1].picks++; }
    if (boType === 5) {
      const p2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (p2) { initMap(p2); stats[p2].picks++; }
    }

    // Bans Equipo
    const b1 = isTeam1 ? m.team_1_select_1 : m.team_2_select_1;
    if (b1) { initMap(b1); stats[b1].bans++; }
    if (boType === 3) {
      const b2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (b2) { initMap(b2); stats[b2].bans++; }
    }

    // Picks Rival
    const rp1 = isTeam1 ? m.team_2_select_2 : m.team_1_select_2;
    if (rp1) { initMap(rp1); stats[rp1].rivalPicks++; }
    if (boType === 5) {
      const rp2 = isTeam1 ? m.team_2_select_3 : m.team_1_select_3;
      if (rp2) { initMap(rp2); stats[rp2].rivalPicks++; }
    }

    // Bans Rival
    const rb1 = isTeam1 ? m.team_2_select_1 : m.team_1_select_1;
    if (rb1) { initMap(rb1); stats[rb1].rivalBans++; }
    if (boType === 3) {
      const rb2 = isTeam1 ? m.team_2_select_3 : m.team_1_select_3;
      if (rb2) { initMap(rb2); stats[rb2].rivalBans++; }
    }

    // Decider
    if (m.decider) { initMap(m.decider); stats[m.decider].deciders++; }
  });

  // --- PARTE 2: VICTORIAS (Nueva lógica de round_info) ---
  const mapResults: Record<string, any> = {};
  rounds.forEach(r => {
    const id = r["vlr_id-map"];
    if (!mapResults[id] || r.round > mapResults[id].round) {
      mapResults[id] = r;
    }
  });

  Object.values(mapResults).forEach(finalRound => {
    const mapName = finalRound.map;
    initMap(mapName);
    stats[mapName].played++;
    const isTeamA = finalRound.teamA === targetTeam;
    const won = isTeamA ? finalRound.rndA === 1 : finalRound.rndB === 1;
    if (won) stats[mapName].wins++;
  });

  return Object.values(stats).sort((a, b) => b.picks - a.picks);
}