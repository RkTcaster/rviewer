// lib/data-service.ts
import { supabase } from './supabase';

// --- TYPES ---
import { DashboardData, Draft, MapStat, Region, Tournament } from './types';

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

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string }): Promise<DashboardData> {
  // 1. Query a la tabla de DRAFTS (Picks/Bans)
  let draftQuery = supabase.from('draft').select('*')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`);

  // 2. Query a la tabla de ROUNDS (Resultados)
  // Nota: Si en Supabase la columna tiene guión (vlr_id-map), 
  // a veces hay que usar comillas dobles o verificar cómo la nombró Supabase (ej: vlr_id_map)
  let roundsQuery = supabase.from('round_info').select('teamA, teamB, rndA, rndB, round, map, "vlr_id-map","side"')
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

function procesarTodo(drafts: any[], rounds: any[], targetTeam: string): DashboardData {
  const stats: Record<string, MapStat> = {};
  let orderA = 0, orderB = 0;
  let pistolWins = 0, pistolTotal = 0;
  let antiEcoWins = 0, antiEcoTotal = 0;
  let recoveryWins = 0, recoveryTotal = 0;
  let pabWins = 0, pabTotal = 0;

  const pistolResults: Record<string, { r1: boolean | null; r13: boolean | null }> = {};
  const antiEcoResults: Record<string, { r2: boolean | null; r14: boolean | null }> = {};
  const mapResults: Record<string, any> = {};

  const target = targetTeam.trim().toLowerCase();

  const initMap = (map: string) => {
    if (map && !stats[map]) {
      stats[map] = {
        mapName: map, picks: 0, bans: 0, deciders: 0,
        rivalPicks: 0, rivalBans: 0, wins: 0, played: 0,
        attWins: 0, attTotal: 0, defWins: 0, defTotal: 0,
      };
    }
  };

  // --- PARTE 1: PICKS Y BANS (Lógica que ya teníamos) ---
  drafts.forEach((m) => {
    const isTeam1 = m.team === targetTeam;
    const boType = Number(m.bo);
    if (m.team === targetTeam) orderA++;
    else if (m.rival === targetTeam) orderB++;
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

  // --- 2. PASO 1 RONDAS: Identificar resultados de Pistols (R1 y R13) ---
  // Hacemos este recorrido primero para que el Paso 2 tenga toda la info de pistols
  rounds.forEach((r) => {
    const id = r["vlr_id-map"];
    if (!id) return;
    if (!pistolResults[id]) pistolResults[id] = { r1: null, r13: null };
    if (!antiEcoResults[id]) antiEcoResults[id] = { r2: null, r14: null };

    const tA = r.teamA?.trim().toLowerCase();
    const tB = r.teamB?.trim().toLowerCase();
    const isTeamA = tA === target;
    const isTeamB = tB === target;

    if (!isTeamA && !isTeamB) return;

    const wonRound = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    const roundNum = Number(r.round);

    if (roundNum === 1) pistolResults[id].r1 = wonRound;
    if (roundNum === 13) pistolResults[id].r13 = wonRound;

    // Identificar Anti-Ecos (R2 y R14)
    if (roundNum === 2) antiEcoResults[id].r2 = wonRound;
    if (roundNum === 14) antiEcoResults[id].r14 = wonRound;

    // if (roundNum === 1 || roundNum === 13) {
    //   pistolTotal++;
    //   if (wonRound) {
    //     pistolWins++;
    //     if (roundNum === 1) pistolResults[id].r1 = true;
    //     if (roundNum === 13) pistolResults[id].r13 = true;

    //   } else {
    //     if (roundNum === 1) pistolResults[id].r1 = false;
    //     if (roundNum === 13) pistolResults[id].r13 = false;
    //   }
    // }
  });

    rounds.forEach((r) => {
    const id = r["vlr_id-map"];
    const mapName = r.map;
    if (!id) return;
    initMap(mapName);

    const tA = r.teamA?.trim().toLowerCase();
    const isTeamA = tA === target;
    const wonRound = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    const roundNum = Number(r.round);

    // A. Lógica de Pistols (KPI)
    if (roundNum === 1 || roundNum === 13) {
      pistolTotal++;
      if (wonRound) pistolWins++;
    }

    // B. Lógica Anti-Eco y Recovery
    if (roundNum === 2) {
      const p1Win = pistolResults[id].r1;
      if (p1Win === true) {
        antiEcoTotal++;
        if (wonRound) antiEcoWins++;
      } else if (p1Win === false) {
        recoveryTotal++;
        if (wonRound) recoveryWins++;
      }
    }
    if (roundNum === 14) {
      const p13Win = pistolResults[id].r13;
      if (p13Win === true) {
        antiEcoTotal++;
        if (wonRound) antiEcoWins++;
      } else if (p13Win === false) {
        recoveryTotal++;
        if (wonRound) recoveryWins++;
      }
    }

    // C. Lógica PAB (Ganar Bonus tras ganar R1 y R2)
    if (roundNum === 3) {
      const p1Win = pistolResults[id].r1;
      const r2Win = antiEcoResults[id].r2;
      if (p1Win === true && r2Win === true) {
        pabTotal++;
        if (wonRound) pabWins++;
      }
    }
    if (roundNum === 15) {
      const p13Win = pistolResults[id].r13;
      const r14Win = antiEcoResults[id].r14;
      if (p13Win === true && r14Win === true) {
        pabTotal++;
        if (wonRound) pabWins++;
      }
    }

    // D. Lógica de Bandos Atk/Def
    const rawSide = r.side?.trim().toLowerCase();
    let mySide = isTeamA ? rawSide : (rawSide === 'atk' ? 'def' : 'atk');

    if (mySide === 'atk') {
      stats[mapName].attTotal++;
      if (wonRound) stats[mapName].attWins++;
    } else if (mySide === 'def') {
      stats[mapName].defTotal++;
      if (wonRound) stats[mapName].defWins++;
    }

    // E. Guardar última ronda para Winrate
    if (!mapResults[id] || Number(r.round) > Number(mapResults[id].round)) {
      mapResults[id] = r;
    }
  });

  // --- 4. CALCULAR WINRATE DE MAPAS ---
  Object.values(mapResults).forEach((finalRound: any) => {
    const mapName = finalRound.map;
    const isTeamA = finalRound.teamA?.trim().toLowerCase() === target;
    const wonMap = isTeamA ? Number(finalRound.rndA) === 1 : Number(finalRound.rndB) === 1;
    if (stats[mapName]) {
      stats[mapName].played++;
      if (wonMap) stats[mapName].wins++;
    }
  });

  return {
    mapStats: Object.values(stats).sort((a, b) => b.picks - a.picks),
    draftOrder: { a: orderA, b: orderB },
    pistols: { wins: pistolWins, total: pistolTotal },
    antiEco: { wins: antiEcoWins, total: antiEcoTotal },
    recovery: { wins: recoveryWins, total: recoveryTotal },
    pab: { wins: pabWins, total: pabTotal }
  };
}
