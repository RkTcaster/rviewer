// lib/data-service.ts
import { supabase } from './supabase';

// --- TYPES ---
import { AgentPickStat, CompositionStat, DashboardData, MapStat, OverallMapStat, Region, TeamRankStats, Tournament } from './types';

// --- FILTERS  ---

export async function getRegions(): Promise<Region[]> {
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

export async function getTournamentRankings(
  filters: { tour?: string; reg?: string; bo?: string }
): Promise<Record<string, TeamRankStats>> {
  let idQuery = supabase.from('draft').select('series_id');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg) idQuery = idQuery.eq('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return {};

  const seriesIds = [...new Set(idList.map(x => x.series_id))];
  const { data: rounds } = await supabase.from('round_info').select('*').in('series_id', seriesIds);
  if (!rounds) return {};

  const teamStats: Record<string, TeamRankStats> = {};
  const mapLastRound: Record<string, any> = {};

  // Per-map key rounds for antiEco/recovery/PAB calculation
  type MapKeyRounds = {
    teamA: string; teamB: string;
    r1?: boolean; r2?: boolean; r3?: boolean; r3side?: string;
    r13?: boolean; r14?: boolean; r15?: boolean; r15side?: string;
  };
  const mapKeyRounds: Record<string, MapKeyRounds> = {};

  const init = (team: string) => {
    if (!teamStats[team]) teamStats[team] = {
      mapWins: 0, mapPlayed: 0,
      attWins: 0, attTotal: 0,
      defWins: 0, defTotal: 0,
      pistolWins: 0, pistolTotal: 0,
      antiEcoWins: 0, antiEcoTotal: 0,
      recoveryWins: 0, recoveryTotal: 0,
      pabWins: 0, pabTotal: 0,
      pabAtkWins: 0, pabAtkTotal: 0,
      pabDefWins: 0, pabDefTotal: 0,
    };
  };

  // Single pass: atk/def, pistols, key rounds
  rounds.forEach((r) => {
    const id = r.map_id;
    if (!id) return;
    const tA = r.teamA?.trim();
    const tB = r.teamB?.trim();
    if (!tA || !tB) return;
    init(tA); init(tB);

    const roundNum = Number(r.round);
    const wonA = Number(r.rndA) === 1;
    const rawSide = r.side?.trim().toLowerCase();
    const sideB = rawSide === 'atk' ? 'def' : 'atk';

    if (!mapLastRound[id] || roundNum > Number(mapLastRound[id].round)) mapLastRound[id] = r;
    if (!mapKeyRounds[id]) mapKeyRounds[id] = { teamA: tA, teamB: tB };

    // Atk/Def rounds
    if (rawSide === 'atk') { teamStats[tA].attTotal++; if (wonA) teamStats[tA].attWins++; }
    else if (rawSide === 'def') { teamStats[tA].defTotal++; if (wonA) teamStats[tA].defWins++; }
    if (sideB === 'atk') { teamStats[tB].attTotal++; if (!wonA) teamStats[tB].attWins++; }
    else if (sideB === 'def') { teamStats[tB].defTotal++; if (!wonA) teamStats[tB].defWins++; }

    // Pistols
    if (roundNum === 1 || roundNum === 13) {
      teamStats[tA].pistolTotal++;
      teamStats[tB].pistolTotal++;
      if (wonA) teamStats[tA].pistolWins++;
      else teamStats[tB].pistolWins++;
    }

    // Store key rounds for 2nd pass
    const kr = mapKeyRounds[id];
    if (roundNum === 1)  { kr.r1 = wonA; }
    if (roundNum === 2)  { kr.r2 = wonA; }
    if (roundNum === 3)  { kr.r3 = wonA; kr.r3side = rawSide; }
    if (roundNum === 13) { kr.r13 = wonA; }
    if (roundNum === 14) { kr.r14 = wonA; }
    if (roundNum === 15) { kr.r15 = wonA; kr.r15side = rawSide; }
  });

  // Map winners
  Object.values(mapLastRound).forEach((finalRound: any) => {
    const tA = finalRound.teamA?.trim();
    const tB = finalRound.teamB?.trim();
    if (!tA || !tB) return;
    init(tA); init(tB);
    teamStats[tA].mapPlayed++;
    teamStats[tB].mapPlayed++;
    if (Number(finalRound.rndA) === 1) teamStats[tA].mapWins++;
    else teamStats[tB].mapWins++;
  });

  // Second pass: antiEco / recovery / PAB per half
  function processHalf(
    tA: string, tB: string,
    pistolA: boolean | undefined,
    r2A: boolean | undefined,
    r3A: boolean | undefined,
    r3SideA: string | undefined
  ) {
    if (pistolA === undefined) return;

    if (r2A !== undefined) {
      const r2B = !r2A;
      // TeamA
      if (pistolA) { teamStats[tA].antiEcoTotal++; if (r2A) teamStats[tA].antiEcoWins++; }
      else         { teamStats[tA].recoveryTotal++; if (r2A) teamStats[tA].recoveryWins++; }
      // TeamB
      if (!pistolA) { teamStats[tB].antiEcoTotal++; if (r2B) teamStats[tB].antiEcoWins++; }
      else          { teamStats[tB].recoveryTotal++; if (r2B) teamStats[tB].recoveryWins++; }
    }

    if (r2A !== undefined && r3A !== undefined) {
      const r3B = !r3A;
      const r3SideB = r3SideA === 'atk' ? 'def' : r3SideA === 'def' ? 'atk' : undefined;
      // PAB teamA: won pistol AND anti-eco
      if (pistolA && r2A) {
        teamStats[tA].pabTotal++; if (r3A) teamStats[tA].pabWins++;
        if (r3SideA === 'atk') { teamStats[tA].pabAtkTotal++; if (r3A) teamStats[tA].pabAtkWins++; }
        else if (r3SideA === 'def') { teamStats[tA].pabDefTotal++; if (r3A) teamStats[tA].pabDefWins++; }
      }
      // PAB teamB: teamB won pistol (!pistolA) AND anti-eco (!r2A)
      if (!pistolA && !r2A) {
        teamStats[tB].pabTotal++; if (r3B) teamStats[tB].pabWins++;
        if (r3SideB === 'atk') { teamStats[tB].pabAtkTotal++; if (r3B) teamStats[tB].pabAtkWins++; }
        else if (r3SideB === 'def') { teamStats[tB].pabDefTotal++; if (r3B) teamStats[tB].pabDefWins++; }
      }
    }
  }

  Object.values(mapKeyRounds).forEach(({ teamA, teamB, r1, r2, r3, r3side, r13, r14, r15, r15side }) => {
    processHalf(teamA, teamB, r1, r2, r3, r3side);
    processHalf(teamA, teamB, r13, r14, r15, r15side);
  });

  return teamStats;
}

export async function getAllTours(regId?: string): Promise<Tournament[]> {
  let query = supabase.from('tournament_played').select('tour_id, event, reg_id');
  if (regId && regId !== '') query = query.eq('reg_id', regId);
  const { data } = await query;
  const unique = data?.reduce((acc: Tournament[], cur) => {
    if (!acc.find(t => t.tour_id === cur.tour_id)) acc.push(cur);
    return acc;
  }, []);
  return unique || [];
}

export async function getOverallMapPicks(
  filters: { reg?: string; tour?: string; bo?: string }
): Promise<OverallMapStat[]> {
  let query = supabase.from('draft').select('*');
  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg) query = query.eq('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') query = query.eq('bo', parseInt(filters.bo));

  const { data: drafts } = await query;
  if (!drafts) return [];

  const stats: Record<string, OverallMapStat> = {};
  const init = (map: string) => {
    if (map && !stats[map]) stats[map] = { mapName: map, picks: 0, bans: 0, deciders: 0 };
  };

  drafts.forEach((m) => {
    const bo = Number(m.bo);
    if (m.team_1_select_2) { init(m.team_1_select_2); stats[m.team_1_select_2].picks++; }
    if (m.team_2_select_2) { init(m.team_2_select_2); stats[m.team_2_select_2].picks++; }
    if (bo === 5) {
      if (m.team_1_select_3) { init(m.team_1_select_3); stats[m.team_1_select_3].picks++; }
      if (m.team_2_select_3) { init(m.team_2_select_3); stats[m.team_2_select_3].picks++; }
    }
    if (m.team_1_select_1) { init(m.team_1_select_1); stats[m.team_1_select_1].bans++; }
    if (m.team_2_select_1) { init(m.team_2_select_1); stats[m.team_2_select_1].bans++; }
    if (bo === 3) {
      if (m.team_1_select_3) { init(m.team_1_select_3); stats[m.team_1_select_3].bans++; }
      if (m.team_2_select_3) { init(m.team_2_select_3); stats[m.team_2_select_3].bans++; }
    }
    if (m.decider) { init(m.decider); stats[m.decider].deciders++; }
  });

  return Object.values(stats).sort((a, b) => b.picks - a.picks);
}

export async function getAgentPickStats(
  filters: { reg?: string; tour?: string; bo?: string }
): Promise<AgentPickStat[]> {
  // If bo filter is set, pre-fetch valid series_ids from draft
  let seriesIds: string[] | null = null;
  if (filters.bo && filters.bo !== 'all') {
    let draftQuery = supabase.from('draft').select('series_id').eq('bo', parseInt(filters.bo));
    if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)  draftQuery = draftQuery.eq('reg_id', filters.reg);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return [];
    seriesIds = [...new Set(draftData.map((d: any) => d.series_id))];
  }

  function applyFilters(q: any) {
    if (filters.tour) q = q.in('tour_id', filters.tour.split(','));
    if (filters.reg)  q = q.eq('reg_id', filters.reg);
    if (seriesIds)    q = q.in('series_id', seriesIds);
    return q;
  }

  // Two parallel queries: map counts (light) + agent picks (full)
  const [{ data: mapRows }, { data: agentRows }] = await Promise.all([
    applyFilters(supabase.from('player_stats').select('map, map_id').limit(50000)),
    applyFilters(supabase.from('player_stats').select('map, agent').limit(50000)),
  ]);

  if (!mapRows || mapRows.length === 0) return [];

  // Count unique map instances per map name (map_id is globally unique)
  const uniqueMapIds: Record<string, Set<string>> = {};
  for (const row of mapRows) {
    if (!row.map || !row.map_id) continue;
    if (!uniqueMapIds[row.map]) uniqueMapIds[row.map] = new Set();
    uniqueMapIds[row.map].add(row.map_id);
  }

  // Count agent plays per (map, agent)
  const agentCounts: Record<string, number> = {};
  for (const row of agentRows ?? []) {
    if (!row.map || !row.agent) continue;
    const key = `${row.map}__${row.agent}`;
    agentCounts[key] = (agentCounts[key] || 0) + 1;
  }

  const results: AgentPickStat[] = [];
  for (const [key, count] of Object.entries(agentCounts)) {
    const [mapName, agent] = key.split('__');
    const totalMaps = uniqueMapIds[mapName]?.size ?? 0;
    const pickRate = totalMaps > 0 ? Math.round((count / (totalMaps * 2)) * 100) : 0;
    results.push({ agent, map: mapName, timesPlayed: count, pickRate, totalMaps });
  }

  return results.sort((a, b) => {
    const mapCmp = a.map.localeCompare(b.map);
    return mapCmp !== 0 ? mapCmp : b.pickRate - a.pickRate;
  });
}

export async function getOverallCompositions(
  filters: { team?: string; reg?: string; tour?: string; bo?: string; last?: string }
): Promise<CompositionStat[]> {
  let query = supabase
    .from('player_stats')
    .select('team, map, series_id, map_id, agent, reg_id, tour_id');

  if (filters.team) query = query.eq('team', filters.team);
  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg)  query = query.eq('reg_id', filters.reg);

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return [];

  // Group rows by (team, map, series_id, map_id) → collect agents
  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    const key = `${row.team}__${row.map}__${row.series_id}__${row.map_id}`;
    if (!grouped[key]) grouped[key] = [];
    if (row.agent) grouped[key].push(row.agent);
  }

  // Build (map, composition) counts
  const countMap: Record<string, CompositionStat> = {};
  for (const [key, agents] of Object.entries(grouped)) {
    if (agents.length === 0) continue;
    const mapName = key.split('__')[1];
    const composition = agents.slice().sort().join(', ');
    const countKey = `${mapName}__${composition}`;
    if (!countMap[countKey]) countMap[countKey] = { map: mapName, composition, played: 0 };
    countMap[countKey].played++;
  }

  return Object.values(countMap).sort((a, b) => {
    const mapCmp = a.map.localeCompare(b.map);
    return mapCmp !== 0 ? mapCmp : b.played - a.played;
  });
}

// --- Stats ---

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string; last?: string }): Promise<DashboardData> {
  let idQuery = supabase
    .from('draft')
    .select('series_id, date')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  // Aplicar filtros de torneo/región/bo a la búsqueda de IDs también
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg) idQuery = idQuery.eq('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));

  // Aplicar el LÍMITE (Last X)
  if (filters.last && filters.last !== 'all') {
    idQuery = idQuery.limit(parseInt(filters.last));
  }
  const { data: idList, error: idError } = await idQuery;
  if (idError || !idList || idList.length === 0) return {
    mapStats: [],
    draftOrder: { a: 0, b: 0 },
    pistols: { wins: 0, total: 0 },
    antiEco: { wins: 0, total: 0 },
    recovery: { wins: 0, total: 0 },
    pab: { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 },
    lastMatchData: null
  };

  const lastDate = idList[0].date
  const recentIds = idList.map(item => item.series_id);


  // 2. Ahora traemos los Drafts y Rondas filtrados por esos IDs específicos
  let draftQuery = supabase.from('draft').select('*').in('series_id', recentIds);
  let roundsQuery = supabase.from('round_info').select('*').in('series_id', recentIds);

  const [{ data: drafts }, { data: rounds }] = await Promise.all([draftQuery, roundsQuery]);

  return procesarTodo(drafts || [], rounds || [], filters.team);
}



function procesarTodo(drafts: any[], rounds: any[], targetTeam: string): Omit<DashboardData, 'lastMatchDate'> {
  const stats: Record<string, MapStat> = {};
  let orderA = 0, orderB = 0;
  let pistolWinsAtk = 0, pistolsWinsDef = 0, pistolWins = 0, pistolTotal = 0;
  let antiEcoWins = 0, antiEcoTotal = 0;
  let recoveryWins = 0, recoveryTotal = 0;
  let pabWinsAtk = 0, pabWinsDef = 0, pabAtkTotal = 0, pabDefTotal = 0, pabTotal = 0;
  let lastDate = drafts[0].date
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
    const id = r["map_id"];
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

  });

  rounds.forEach((r) => {
    const id = r["map_id"];
    const mapName = r.map;
    if (!id) return;
    initMap(mapName);

    const tA = r.teamA?.trim().toLowerCase();
    const isTeamA = tA === target;
    const wonRound = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    const roundNum = Number(r.round);

    // Test para contar por lado 

    const rawSide = r.side?.trim().toLowerCase();
    let mySide = isTeamA ? rawSide : (rawSide === 'atk' ? 'def' : 'atk');

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
    if (mySide === 'atk') {
      if (roundNum === 3) {
        const p1Win = pistolResults[id].r1;
        const r2Win = antiEcoResults[id].r2;
        if (p1Win === true && r2Win === true) {
          pabAtkTotal++;
          if (wonRound) pabWinsAtk++;
        }
      }
      if (roundNum === 15) {
        const p13Win = pistolResults[id].r13;
        const r14Win = antiEcoResults[id].r14;
        if (p13Win === true && r14Win === true) {
          pabAtkTotal++;
          if (wonRound) pabWinsAtk++;
        }
      }
    } else if (mySide === 'def') {
      if (roundNum === 3) {
        const p1Win = pistolResults[id].r1;
        const r2Win = antiEcoResults[id].r2;
        if (p1Win === true && r2Win === true) {
          pabDefTotal++;
          if (wonRound) pabWinsDef++;
        }
      }
      if (roundNum === 15) {
        const p13Win = pistolResults[id].r13;
        const r14Win = antiEcoResults[id].r14;
        if (p13Win === true && r14Win === true) {
          pabDefTotal++;
          if (wonRound) pabWinsDef++;
        }
      }
    }

    // D. Lógica de Bandos Atk/Def SAQUE ESTO DE ACA Y LO PUSE ARRIBA 
    // const rawSide = r.side?.trim().toLowerCase();
    // let mySide = isTeamA ? rawSide : (rawSide === 'atk' ? 'def' : 'atk');

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
    pab: { atkWins: pabWinsAtk, defWins: pabWinsDef, wins: pabWinsAtk + pabWinsDef, atkTotal: pabAtkTotal, defTotal: pabDefTotal, total: pabAtkTotal + pabDefTotal },
    lastMatchData: lastDate
  };
}
