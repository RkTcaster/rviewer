// lib/data/draft.ts — picks/bans del draft y stats de mapas por equipo
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { DashboardData, MapStat, OverallMapFullStat, OverallMapStat, VetoFlow } from '../types';
import { DraftRow, RoundInfoRow } from './rows';

export async function getOverallMapPicks(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<OverallMapStat[]> {
  let query = supabase.from('draft').select('*');
  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg) query = query.in('reg_id', filters.reg!);
  if (filters.bo && filters.bo !== 'all') query = query.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('date', filters.dateTo);
  if (filters.excludeTeams && filters.excludeTeams.length > 0) {
    query = query.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
    query = query.not('rival', 'in', `(${filters.excludeTeams.join(',')})`);
  }

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

export const getOverallMapFullStats = versioned('overall-map-full-stats', getOverallMapFullStats_impl);
async function getOverallMapFullStats_impl(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<Record<string, OverallMapFullStat>> {
  let draftQuery = supabase.from('draft').select('*');
  if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)  draftQuery = draftQuery.in('reg_id', filters.reg!);
  if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
  if (filters.excludeTeams && filters.excludeTeams.length > 0) {
    draftQuery = draftQuery.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
    draftQuery = draftQuery.not('rival', 'in', `(${filters.excludeTeams.join(',')})`);
  }

  const { data: drafts } = await draftQuery;
  if (!drafts || drafts.length === 0) return {};

  const seriesIds = [...new Set(drafts.map((d: DraftRow) => d.series_id).filter(Boolean))] as string[];

  // map_id → map name
  const mapIdRows = await fetchAllPages<{ map_id: string; map: string }>((from, to) =>
    supabase.from('maps_id').select('map_id, map').in('series_id', seriesIds).range(from, to)
  );
  const mapIdToName: Record<string, string> = {};
  for (const r of mapIdRows) { if (r.map_id && r.map) mapIdToName[r.map_id] = r.map; }

  // rounds for atk/def WR
  const rounds = await fetchAllPages<Pick<RoundInfoRow, 'map_id' | 'rndA' | 'side'>>((from, to) =>
    supabase.from('round_info').select('map_id, rndA, side').in('series_id', seriesIds).range(from, to)
  );

  const stats: Record<string, OverallMapFullStat> = {};
  const init = (map: string) => {
    if (!stats[map]) stats[map] = { mapName: map, picks: 0, bans: 0, deciders: 0, attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 };
  };

  // picks/bans/deciders
  for (const m of drafts) {
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
  }

  // atk/def WR per round
  for (const r of rounds) {
    const mapName = mapIdToName[r.map_id];
    if (!mapName) continue;
    init(mapName);
    const wonA = Number(r.rndA) === 1;
    const side = r.side?.trim().toLowerCase();
    stats[mapName].attTotal++;
    stats[mapName].defTotal++;
    if (side === 'atk') {
      if (wonA) stats[mapName].attWins++; else stats[mapName].defWins++;
    } else if (side === 'def') {
      if (wonA) stats[mapName].defWins++; else stats[mapName].attWins++;
    }
  }

  return stats;
}

// --- Stats ---

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string[]; last?: string; dateFrom?: string; dateTo?: string }): Promise<DashboardData> {
  let idQuery = supabase
    .from('draft')
    .select('series_id, date')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  // Aplicar filtros de torneo/región/bo a la búsqueda de IDs también
  if (filters.tour)     idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)      idQuery = idQuery.in('reg_id', filters.reg!);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);

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

  const recentIds = idList.map(item => item.series_id);

  // 2. Fetch drafts, rounds and the team's true last match date (unfiltered) in parallel
  const latestMatchQuery = supabase
    .from('draft')
    .select('date')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  let draftQuery = supabase.from('draft').select('*').in('series_id', recentIds);
  // round_info supera fácil las 1000 filas (límite por request de Supabase): paginar siempre
  const roundsQuery = fetchAllPages<RoundInfoRow>((from, to) =>
    supabase.from('round_info').select('*').in('series_id', recentIds).range(from, to)
  );

  const [{ data: drafts }, rounds, { data: latestMatch }] = await Promise.all([draftQuery, roundsQuery, latestMatchQuery]);

  return {
    ...procesarTodo(drafts || [], rounds || [], filters.team),
    lastMatchData: latestMatch?.date ?? null,
  };
}



function procesarTodo(drafts: DraftRow[], rounds: RoundInfoRow[], targetTeam: string): Omit<DashboardData, 'lastMatchDate'> {
  const stats: Record<string, MapStat> = {};
  let orderA = 0, orderB = 0;
  let pistolWinsAtk = 0, pistolsWinsDef = 0, pistolWins = 0, pistolTotal = 0;
  let antiEcoWins = 0, antiEcoTotal = 0;
  let recoveryWins = 0, recoveryTotal = 0;
  let pabWinsAtk = 0, pabWinsDef = 0, pabAtkTotal = 0, pabDefTotal = 0, pabTotal = 0;
  let lastDate = drafts[0].date
  const pistolResults: Record<string, { r1: boolean | null; r13: boolean | null }> = {};
  const antiEcoResults: Record<string, { r2: boolean | null; r14: boolean | null }> = {};
  const mapResults: Record<string, RoundInfoRow> = {};

  const target = targetTeam.trim().toLowerCase();

  const initMap = (map: string) => {
    if (map && !stats[map]) {
      stats[map] = {
        mapName: map, picks: 0, pick1: 0, pick2: 0, bans: 0, ban1: 0, ban2: 0, deciders: 0,
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
    if (p1) { initMap(p1); stats[p1].picks++; stats[p1].pick1++; }
    if (boType === 5) {
      const p2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (p2) { initMap(p2); stats[p2].picks++; stats[p2].pick2++; }
    }

    // Bans Equipo
    const b1 = isTeam1 ? m.team_1_select_1 : m.team_2_select_1;
    if (b1) { initMap(b1); stats[b1].bans++; stats[b1].ban1++; }
    if (boType === 3) {
      const b2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (b2) { initMap(b2); stats[b2].bans++; stats[b2].ban2++; }
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
  Object.values(mapResults).forEach((finalRound) => {
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

// Secuencias de veto del equipo (una por serie). En Bo3 select_1=ban, select_2=pick,
// select_3=segundo ban; en Bo5 select_3 es pick, así que ban2 queda null.
export async function getVetoFlows(filters: { team: string; tour?: string; bo?: string; reg?: string[]; last?: string; dateFrom?: string; dateTo?: string }): Promise<VetoFlow[]> {
  let query = supabase
    .from('draft')
    .select('team, rival, bo, date, team_1_select_1, team_1_select_2, team_1_select_3, team_2_select_1, team_2_select_2, team_2_select_3')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  if (filters.tour)     query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) query = query.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') query = query.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters.dateTo)   query = query.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') query = query.limit(parseInt(filters.last));

  const { data, error } = await query;
  if (error) {
    console.error('[getVetoFlows] Supabase error:', error);
    return [];
  }

  return (data ?? [])
    .map(d => {
      const isTeam1 = d.team === filters.team;
      const ban1 = isTeam1 ? d.team_1_select_1 : d.team_2_select_1;
      const pick = isTeam1 ? d.team_1_select_2 : d.team_2_select_2;
      const ban2 = Number(d.bo) === 3 ? (isTeam1 ? d.team_1_select_3 : d.team_2_select_3) : null;
      return { ban1: ban1 || '', pick: pick || '', ban2: ban2 || null, bo: Number(d.bo) };
    })
    .filter(f => f.ban1 && f.pick);
}
