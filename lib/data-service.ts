import { supabase } from './supabase';
import { Match, MapStat } from './types';

export async function getMapStats(filters: { team: string; region?: string; tour?: string }) {
  // 1. Construir la base de la query
  let query = supabase
    .from('draft')
    .select('*')
    .eq('bo', 3);

  // 2. Filtrar por equipo (debe estar en columna 'team' O en 'rival')
  query = query.or(`team.eq."${filters.team}",rival.eq."${filters.team}"`);

  // 3. Filtros opcionales
  if (filters.region) query = query.eq('reg_id', filters.region);
  if (filters.tour) query = query.eq('tour_id', filters.tour);

  const { data: matches, error } = await query;
  
  if (error) throw error;
  if (!matches) return [];

  // 4. Lógica de agregación por mapa
  const stats: Record<string, MapStat> = {};

  const initMap = (map: string) => {
    if (!map) return;
    if (!stats[map]) {
      stats[map] = { mapName: map, picks: 0, bans: 0, deciders: 0 };
    }
  };

  (matches as Match[]).forEach((m) => {
    const isTeam1 = m.team === filters.team;

    // --- PICKS ---
    // Si nuestro equipo es Team 1, su pick es select_2. 
    // Si es Team 2, su pick es el select_2 del Team 2.
    const pick = isTeam1 ? m.team_1_select_2 : m.team_2_select_2;
    if (pick) { initMap(pick); stats[pick].picks++; }

    // --- BANS ---
    // Según tu lógica: select_1 y select_3 de nuestro equipo
    const ban1 = isTeam1 ? m.team_1_select_1 : m.team_2_select_1;
    const ban2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
    
    [ban1, ban2].forEach(b => {
      if (b) { initMap(b); stats[b].bans++; }
    });

    // --- DECIDER ---
    if (m.decider) {
      initMap(m.decider);
      stats[m.decider].deciders++;
    }
  });

  return Object.values(stats).sort((a, b) => b.picks - a.picks);
}

// Para llenar los Selects de los filtros
export async function getFilterOptions() {
  const { data, error } = await supabase
    .from('draft') // <--- Asegúrate que sea el nombre real
    .select('team, rival, tour_id'); // Solo traemos lo necesario

  if (error) return { teams: [], tours: [] };

  const teamsSet = new Set<string>();
  const toursSet = new Set<string>();

  data.forEach(item => {
    if (item.team) teamsSet.add(item.team);
    if (item.rival) teamsSet.add(item.rival);
    if (item.tour_id) toursSet.add(item.tour_id);
  });

  return {
    teams: Array.from(teamsSet).sort(),
    tours: Array.from(toursSet).sort(),
  };
}