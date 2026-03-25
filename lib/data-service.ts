// lib/data-service.ts
import { supabase } from './supabase';

// --- TYPES ---
import { AgentPickStat, CompositionStat, DashboardData, EconomyBin, MapStat, OverallMapFullStat, OverallMapStat, PlayerStat, Region, TeamRankStats, Tournament, TournamentPlayerAvg } from './types';

// --- HELPERS ---

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data } = await buildQuery(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

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
  const rounds = await fetchAllPages<any>((from, to) =>
    supabase.from('round_info').select('*').in('series_id', seriesIds).range(from, to)
  );
  if (!rounds || rounds.length === 0) return {};

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
      timeoutLosses: 0,
      retakeDe: 0,
      retakePl: 0,
      postPlantPl: 0,
      postPlantDe: 0,
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

    // Timeout losses: winCon = 'tim' → attacking side lost
    if (r.winCon?.trim().toLowerCase() === 'tim') {
      if (rawSide === 'atk') teamStats[tA].timeoutLosses++;
      if (sideB === 'atk')   teamStats[tB].timeoutLosses++;
    }

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

  // Retake efficiency from player_performance
  const perfRows = await fetchAllPages<any>((from, to) =>
    supabase.from('player_performance')
      .select('map_id, team, DE, PL')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const perfByMapTeam: Record<string, { de: number; pl: number }> = {};
  for (const p of perfRows) {
    const k = `${p.map_id}__${p.team?.trim()}`;
    if (!perfByMapTeam[k]) perfByMapTeam[k] = { de: 0, pl: 0 };
    perfByMapTeam[k].de += Number(p.DE) || 0;
    perfByMapTeam[k].pl += Number(p.PL) || 0;
  }

  Object.entries(mapLastRound).forEach(([map_id, r]: [string, any]) => {
    const tA = r.teamA?.trim();
    const tB = r.teamB?.trim();
    if (!tA || !tB) return;
    init(tA); init(tB);
    const perfA = perfByMapTeam[`${map_id}__${tA}`];
    const perfB = perfByMapTeam[`${map_id}__${tB}`];
    if (perfA) teamStats[tA].retakeDe += perfA.de;
    if (perfB) teamStats[tA].retakePl += perfB.pl;
    if (perfB) teamStats[tB].retakeDe += perfB.de;
    if (perfA) teamStats[tB].retakePl += perfA.pl;

    if (perfA) teamStats[tA].postPlantPl += perfA.pl;
    if (perfB) teamStats[tA].postPlantDe += perfB.de;
    if (perfB) teamStats[tB].postPlantPl += perfB.pl;
    if (perfA) teamStats[tB].postPlantDe += perfA.de;
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
  filters: { reg?: string; tour?: string; team?: string; dateFrom?: string; dateTo?: string }
): Promise<AgentPickStat[]> {
  // Pre-fetch series_ids from draft when date filters are active
  let seriesIds: string[] | null = null;
  if (filters.dateFrom || filters.dateTo) {
    let draftQuery = supabase.from('draft').select('series_id');
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.eq('reg_id', filters.reg);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
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

  // Team branch: single query from player_stats, totalMaps from map_id (denominator = totalMaps, not *2)
  if (filters.team) {
    const rows = await fetchAllPages<{ map: string; map_id: string; agent: string }>((from, to) =>
      applyFilters(supabase.from('player_stats').select('map, map_id, agent')).eq('team', filters.team!).range(from, to)
    );
    if (!rows || rows.length === 0) return [];

    const uniqueMapIds: Record<string, Set<string>> = {};
    const agentCounts: Record<string, number> = {};
    for (const row of rows) {
      if (!row.map || !row.map_id) continue;
      if (!uniqueMapIds[row.map]) uniqueMapIds[row.map] = new Set();
      uniqueMapIds[row.map].add(row.map_id);
      if (row.agent) {
        const key = `${row.map}__${row.agent}`;
        agentCounts[key] = (agentCounts[key] || 0) + 1;
      }
    }

    const results: AgentPickStat[] = [];
    for (const [key, count] of Object.entries(agentCounts)) {
      const [mapName, agent] = key.split('__');
      const totalMaps = uniqueMapIds[mapName]?.size ?? 0;
      const pickRate = totalMaps > 0 ? Math.round((count / totalMaps) * 100) : 0;
      results.push({ agent, map: mapName, timesPlayed: count, pickRate, totalMaps });
    }
    return results.sort((a, b) => {
      const mapCmp = a.map.localeCompare(b.map);
      return mapCmp !== 0 ? mapCmp : b.pickRate - a.pickRate;
    });
  }

  // Two parallel queries: map counts from maps_id table + agent picks
  const [mapRows, agentRows] = await Promise.all([
    fetchAllPages<{ map_id: string; map: string }>((from, to) =>
      applyFilters(supabase.from('maps_id').select('map_id, map')).range(from, to)
    ),
    fetchAllPages<{ map: string; agent: string }>((from, to) =>
      applyFilters(supabase.from('player_stats').select('map, agent')).range(from, to)
    ),
  ]);

  if (!mapRows || mapRows.length === 0) return [];

  // Count unique map instances per map name from maps_id table
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
  const rows = await fetchAllPages<any>((from, to) => {
    let q = supabase
      .from('player_stats')
      .select('team, map, series_id, map_id, agent, reg_id, tour_id');
    if (filters.team) q = q.eq('team', filters.team);
    if (filters.tour) q = q.in('tour_id', filters.tour.split(','));
    if (filters.reg)  q = q.eq('reg_id', filters.reg);
    return q.range(from, to);
  });
  if (!rows || rows.length === 0) return [];

  // Group rows by (team, map, series_id, map_id) → collect agents
  const grouped: Record<string, string[]> = {};
  for (const row of rows) {
    const key = `${row.team}__${row.map}__${row.series_id}__${row.map_id}`;
    if (!grouped[key]) grouped[key] = [];
    if (row.agent) grouped[key].push(row.agent);
  }

  // Build compoByInstance: for each (series_id, map_id) → which team played which composition
  const compoByInstance: Record<string, Record<string, string>> = {};
  for (const [key, agents] of Object.entries(grouped)) {
    if (agents.length === 0) continue;
    const parts = key.split('__');
    const team = parts[0];
    const series_id = parts[2];
    const map_id = parts[3];
    const instKey = `${series_id}__${map_id}`;
    if (!compoByInstance[instKey]) compoByInstance[instKey] = {};
    compoByInstance[instKey][team] = agents.slice().sort().join(', ');
  }

  // Fetch round_info to determine map winners
  const allSeriesIds = [...new Set(Object.keys(grouped).map(k => k.split('__')[2]))];
  const roundRows = await fetchAllPages<any>((from, to) =>
    supabase.from('round_info')
      .select('series_id, map_id, round, teamA, teamB, rndA, rndB')
      .in('series_id', allSeriesIds)
      .range(from, to)
  );

  // Find the final round (max round number) per map_id → determine winner
  const finalRoundByMapId: Record<string, any> = {};
  for (const r of roundRows) {
    const prev = finalRoundByMapId[r.map_id];
    if (!prev || Number(r.round) > Number(prev.round)) {
      finalRoundByMapId[r.map_id] = r;
    }
  }
  // winner[map_id] = winning team name
  const winnerByMapId: Record<string, string> = {};
  for (const [map_id, r] of Object.entries(finalRoundByMapId)) {
    winnerByMapId[map_id] = Number(r.rndA) === 1 ? r.teamA?.trim() : r.teamB?.trim();
  }

  // Build (map, composition) counts + teams + win rate (excluding mirror matches)
  const countMap: Record<string, CompositionStat & { teamCounts: Record<string, number>; nonMirrorWins: number }> = {};
  for (const [key, agents] of Object.entries(grouped)) {
    if (agents.length === 0) continue;
    const parts = key.split('__');
    const team = parts[0];
    const mapName = parts[1];
    const map_id = parts[3];
    const instKey = `${parts[2]}__${map_id}`;
    const composition = agents.slice().sort().join(', ');
    const countKey = `${mapName}__${composition}`;
    if (!countMap[countKey]) countMap[countKey] = { map: mapName, composition, played: 0, nonMirrorPlayed: 0, nonMirrorWins: 0, teamCounts: {} };

    countMap[countKey].played++;
    countMap[countKey].teamCounts[team] = (countMap[countKey].teamCounts[team] || 0) + 1;

    // Check mirror: does the opponent have the exact same composition?
    const instance = compoByInstance[instKey] ?? {};
    const opponentComps = Object.entries(instance).filter(([t]) => t !== team).map(([, c]) => c);
    const isMirror = opponentComps.length > 0 && opponentComps.every(c => c === composition);
    if (!isMirror) {
      countMap[countKey].nonMirrorPlayed = (countMap[countKey].nonMirrorPlayed ?? 0) + 1;
      const winner = winnerByMapId[map_id];
      if (winner && winner.toLowerCase() === team.toLowerCase()) {
        countMap[countKey].nonMirrorWins++;
      }
    }
  }

  return Object.values(countMap).map(({ teamCounts, nonMirrorWins, nonMirrorPlayed, ...rest }) => ({
    ...rest,
    nonMirrorPlayed,
    nonMirrorWins,
    winRate: nonMirrorPlayed && nonMirrorPlayed > 0
      ? Math.round(nonMirrorWins / nonMirrorPlayed * 100)
      : undefined,
    teams: Object.entries(teamCounts)
      .map(([team, played]) => ({ team, played }))
      .sort((a, b) => b.played - a.played),
  })).sort((a, b) => {
    const mapCmp = a.map.localeCompare(b.map);
    return mapCmp !== 0 ? mapCmp : b.played - a.played;
  });
}

export async function getPlayerStats(
  filters: { team: string; reg?: string; tour?: string; bo?: string }
): Promise<PlayerStat[]> {
  // If bo filter, pre-fetch valid series_ids from draft
  let seriesIds: string[] | null = null;
  if (filters.bo && filters.bo !== 'all') {
    let draftQuery = supabase.from('draft').select('series_id').eq('bo', parseInt(filters.bo));
    if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)  draftQuery = draftQuery.eq('reg_id', filters.reg);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return [];
    seriesIds = [...new Set(draftData.map((d: any) => d.series_id))];
  }

  let query = supabase
    .from('player_stats')
    .select('player, agent, killsBoth, deadBoth, killsT, deadT, killsCT, deadCT, ratingBoth, ratingT, "rating-ct", acsBoth, acsT, acsCT, assistsBoth, assistsT, assistsCT, adrBoth, adrT, adrCT, hsBoth, hsT, hsCT, fkBoth, fkT, fkCT, fdBoth, fdT, fdCT')
    .eq('team', filters.team);

  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg)  query = query.eq('reg_id', filters.reg);
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const rows = await fetchAllPages((from, to) => query.range(from, to));
  if (!rows || rows.length === 0) return [];

  type Acc = {
    kills: number; deaths: number; killsT: number; deadT: number; killsCT: number; deadCT: number;
    sRating: number; sRatingT: number; sRatingCT: number;
    sAcs: number; sAcsT: number; sAcsCT: number;
    sAssists: number; sAssistsT: number; sAssistsCT: number;
    sAdr: number; sAdrT: number; sAdrCT: number;
    sHs: number; sHsT: number; sHsCT: number;
    sFk: number; sFkT: number; sFkCT: number;
    sFd: number; sFdT: number; sFdCT: number;
    agentCounts: Record<string, number>; maps: number;
  };
  const zero = (): Acc => ({
    kills: 0, deaths: 0, killsT: 0, deadT: 0, killsCT: 0, deadCT: 0,
    sRating: 0, sRatingT: 0, sRatingCT: 0,
    sAcs: 0, sAcsT: 0, sAcsCT: 0,
    sAssists: 0, sAssistsT: 0, sAssistsCT: 0,
    sAdr: 0, sAdrT: 0, sAdrCT: 0,
    sHs: 0, sHsT: 0, sHsCT: 0,
    sFk: 0, sFkT: 0, sFkCT: 0,
    sFd: 0, sFdT: 0, sFdCT: 0,
    agentCounts: {}, maps: 0,
  });
  const playerMap: Record<string, Acc> = {};

  for (const row of rows) {
    const p = row.player;
    if (!p) continue;
    if (!playerMap[p]) playerMap[p] = zero();
    const a = playerMap[p];
    a.kills     += Number(row.killsBoth)     || 0;
    a.deaths    += Number(row.deadBoth)      || 0;
    a.killsT    += Number(row.killsT)        || 0;
    a.deadT     += Number(row.deadT)         || 0;
    a.killsCT   += Number(row.killsCT)       || 0;
    a.deadCT    += Number(row.deadCT)        || 0;
    a.sRating   += Number(row.ratingBoth)    || 0;
    a.sRatingT  += Number(row.ratingT)       || 0;
    a.sRatingCT += Number(row['rating-ct'])  || 0;
    a.sAcs      += Number(row.acsBoth)       || 0;
    a.sAcsT     += Number(row.acsT)          || 0;
    a.sAcsCT    += Number(row.acsCT)         || 0;
    a.sAssists  += Number(row.assistsBoth)   || 0;
    a.sAssistsT += Number(row.assistsT)      || 0;
    a.sAssistsCT+= Number(row.assistsCT)     || 0;
    a.sAdr      += Number(row.adrBoth)       || 0;
    a.sAdrT     += Number(row.adrT)          || 0;
    a.sAdrCT    += Number(row.adrCT)         || 0;
    a.sHs       += Number(row.hsBoth)        || 0;
    a.sHsT      += Number(row.hsT)           || 0;
    a.sHsCT     += Number(row.hsCT)          || 0;
    a.sFk       += Number(row.fkBoth)        || 0;
    a.sFkT      += Number(row.fkT)           || 0;
    a.sFkCT     += Number(row.fkCT)          || 0;
    a.sFd       += Number(row.fdBoth)        || 0;
    a.sFdT      += Number(row.fdT)           || 0;
    a.sFdCT     += Number(row.fdCT)          || 0;
    a.maps++;
    if (row.agent) a.agentCounts[row.agent] = (a.agentCounts[row.agent] || 0) + 1;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return Object.entries(playerMap).map(([player, a]) => {
    const { kills, deaths, killsT, deadT, killsCT, deadCT, maps } = a;
    const kd    = deaths === 0 ? kills   : r2(kills   / deaths);
    const kdAtk = deadT  === 0 ? killsT  : r2(killsT  / deadT);
    const kdDef = deadCT === 0 ? killsCT : r2(killsCT / deadCT);
    const agent = Object.entries(a.agentCounts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
    return {
      player, agent, maps, kills, deaths, kd, kdAtk, kdDef,
      rating: r2(a.sRating / maps),    ratingAtk: r2(a.sRatingT / maps),   ratingDef: r2(a.sRatingCT / maps),
      acs:    r2(a.sAcs    / maps),    acsAtk:    r2(a.sAcsT    / maps),   acsDef:    r2(a.sAcsCT   / maps),
      avgKills:    r2(kills  / maps),  avgKillsAtk:  r2(killsT  / maps),   avgKillsDef:  r2(killsCT / maps),
      avgDeaths:   r2(deaths / maps),  avgDeathsAtk: r2(deadT   / maps),   avgDeathsDef: r2(deadCT  / maps),
      assists: r2(a.sAssists / maps),  assistsAtk: r2(a.sAssistsT / maps), assistsDef: r2(a.sAssistsCT / maps),
      adr:    r2(a.sAdr    / maps),    adrAtk:    r2(a.sAdrT    / maps),   adrDef:    r2(a.sAdrCT   / maps),
      hs:     r2(a.sHs     / maps),    hsAtk:     r2(a.sHsT     / maps),   hsDef:     r2(a.sHsCT    / maps),
      fk:     r2(a.sFk     / maps),    fkAtk:     r2(a.sFkT     / maps),   fkDef:     r2(a.sFkCT    / maps),
      fd:     r2(a.sFd     / maps),    fdAtk:     r2(a.sFdT     / maps),   fdDef:     r2(a.sFdCT    / maps),
      fkfd:   r2((a.sFk - a.sFd)   / maps),
      fkfdAtk: r2((a.sFkT - a.sFdT) / maps),
      fkfdDef: r2((a.sFkCT - a.sFdCT) / maps),
    };
  }).sort((a, b) => b.kd - a.kd);
}

export async function getTournamentPlayerAvg(
  filters: { reg?: string; tour?: string; bo?: string }
): Promise<TournamentPlayerAvg | null> {
  let seriesIds: string[] | null = null;
  if (filters.bo && filters.bo !== 'all') {
    let draftQuery = supabase.from('draft').select('series_id').eq('bo', parseInt(filters.bo));
    if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)  draftQuery = draftQuery.eq('reg_id', filters.reg);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return null;
    seriesIds = [...new Set(draftData.map((d: any) => d.series_id))];
  }

  let query = supabase
    .from('player_stats')
    .select('player, killsBoth, deadBoth, killsT, deadT, killsCT, deadCT, ratingBoth, ratingT, "rating-ct", acsBoth, acsT, acsCT, adrBoth, adrT, adrCT, hsBoth, hsT, hsCT');

  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg)  query = query.eq('reg_id', filters.reg);
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const { data: rows } = await query.limit(200000);
  if (!rows || rows.length === 0) return null;

  type Acc2 = {
    kills: number; deaths: number; killsT: number; deadT: number; killsCT: number; deadCT: number;
    sRating: number; sRatingT: number; sRatingCT: number;
    sAcs: number; sAcsT: number; sAcsCT: number;
    sAdr: number; sAdrT: number; sAdrCT: number;
    sHs: number; sHsT: number; sHsCT: number;
    maps: number;
  };
  const pm: Record<string, Acc2> = {};
  const z2 = (): Acc2 => ({
    kills: 0, deaths: 0, killsT: 0, deadT: 0, killsCT: 0, deadCT: 0,
    sRating: 0, sRatingT: 0, sRatingCT: 0,
    sAcs: 0, sAcsT: 0, sAcsCT: 0,
    sAdr: 0, sAdrT: 0, sAdrCT: 0,
    sHs: 0, sHsT: 0, sHsCT: 0,
    maps: 0,
  });

  for (const row of rows) {
    if (!row.player) continue;
    if (!pm[row.player]) pm[row.player] = z2();
    const a = pm[row.player];
    a.kills     += Number(row.killsBoth)    || 0;
    a.deaths    += Number(row.deadBoth)     || 0;
    a.killsT    += Number(row.killsT)       || 0;
    a.deadT     += Number(row.deadT)        || 0;
    a.killsCT   += Number(row.killsCT)      || 0;
    a.deadCT    += Number(row.deadCT)       || 0;
    a.sRating   += Number(row.ratingBoth)   || 0;
    a.sRatingT  += Number(row.ratingT)      || 0;
    a.sRatingCT += Number(row['rating-ct']) || 0;
    a.sAcs      += Number(row.acsBoth)      || 0;
    a.sAcsT     += Number(row.acsT)         || 0;
    a.sAcsCT    += Number(row.acsCT)        || 0;
    a.sAdr      += Number(row.adrBoth)      || 0;
    a.sAdrT     += Number(row.adrT)         || 0;
    a.sAdrCT    += Number(row.adrCT)        || 0;
    a.sHs       += Number(row.hsBoth)       || 0;
    a.sHsT      += Number(row.hsT)          || 0;
    a.sHsCT     += Number(row.hsCT)         || 0;
    a.maps++;
  }

  const players = Object.values(pm);
  if (players.length === 0) return null;

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const mean = (vals: number[]) => r2(vals.reduce((a, b) => a + b, 0) / vals.length);

  return {
    kd:        mean(players.map(a => a.deaths === 0 ? a.kills   : a.kills   / a.deaths)),
    kdAtk:     mean(players.map(a => a.deadT  === 0 ? a.killsT  : a.killsT  / a.deadT)),
    kdDef:     mean(players.map(a => a.deadCT === 0 ? a.killsCT : a.killsCT / a.deadCT)),
    rating:    mean(players.map(a => a.sRating   / a.maps)),
    ratingAtk: mean(players.map(a => a.sRatingT  / a.maps)),
    ratingDef: mean(players.map(a => a.sRatingCT / a.maps)),
    acs:       mean(players.map(a => a.sAcs    / a.maps)),
    acsAtk:    mean(players.map(a => a.sAcsT   / a.maps)),
    acsDef:    mean(players.map(a => a.sAcsCT  / a.maps)),
    adr:       mean(players.map(a => a.sAdr    / a.maps)),
    adrAtk:    mean(players.map(a => a.sAdrT   / a.maps)),
    adrDef:    mean(players.map(a => a.sAdrCT  / a.maps)),
    hs:        mean(players.map(a => a.sHs     / a.maps)),
    hsAtk:     mean(players.map(a => a.sHsT    / a.maps)),
    hsDef:     mean(players.map(a => a.sHsCT   / a.maps)),
  };
}

export async function getOverallMapFullStats(
  filters: { reg?: string; tour?: string; bo?: string }
): Promise<Record<string, OverallMapFullStat>> {
  let draftQuery = supabase.from('draft').select('*');
  if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)  draftQuery = draftQuery.eq('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));

  const { data: drafts } = await draftQuery;
  if (!drafts || drafts.length === 0) return {};

  const seriesIds = [...new Set(drafts.map((d: any) => d.series_id).filter(Boolean))] as string[];

  // map_id → map name
  const mapIdRows = await fetchAllPages<{ map_id: string; map: string }>((from, to) =>
    supabase.from('maps_id').select('map_id, map').in('series_id', seriesIds).range(from, to)
  );
  const mapIdToName: Record<string, string> = {};
  for (const r of mapIdRows) { if (r.map_id && r.map) mapIdToName[r.map_id] = r.map; }

  // rounds for atk/def WR
  const rounds = await fetchAllPages<any>((from, to) =>
    supabase.from('round_info').select('map_id, rndA, side').in('series_id', seriesIds).range(from, to)
  );

  const stats: Record<string, OverallMapFullStat> = {};
  const init = (map: string) => {
    if (!stats[map]) stats[map] = { mapName: map, picks: 0, bans: 0, attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 };
  };

  // picks/bans
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

export async function getAgentImages(): Promise<Record<string, string>> {
  const { data } = await supabase.from('agent_info').select('agent_name, agent_path');
  if (!data) return {};
  return Object.fromEntries(
    data.filter((r: any) => r.agent_path).map((r: any) => [r.agent_name, r.agent_path])
  );
}

export async function getLastUpdateDate(): Promise<string | null> {
  const { data } = await supabase.from('draft').select('date').order('date', { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}

export async function getMapImages(): Promise<Record<string, string>> {
  const { data } = await supabase.from('maps_name_ids').select('map, image_path');
  if (!data) return {};
  return Object.fromEntries(
    data.filter((r: { map: string; image_path: string | null }) => r.image_path).map((r: { map: string; image_path: string }) => [r.map, r.image_path])
  );
}

// --- Stats ---

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string; last?: string; dateFrom?: string; dateTo?: string }): Promise<DashboardData> {
  let idQuery = supabase
    .from('draft')
    .select('series_id, date')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  // Aplicar filtros de torneo/región/bo a la búsqueda de IDs también
  if (filters.tour)     idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)      idQuery = idQuery.eq('reg_id', filters.reg);
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

export async function getEconomyDistribution(filters: {
  reg?: string; tour?: string; team?: string;
}): Promise<EconomyBin[]> {
  const { reg, tour, team } = filters;
  const BIN_COUNT = 50;
  const BIN_SIZE = 600; // 30000 / 50

  const emptyBins = (): EconomyBin[] =>
    Array.from({ length: BIN_COUNT }, (_, i) => ({ label: String(i * BIN_SIZE), count: 0, wins: 0 }));

  let draftQuery = supabase.from('draft').select('series_id');
  if (reg) draftQuery = draftQuery.eq('reg_id', reg);
  if (tour) {
    const tourIds = tour.split(',').filter(Boolean);
    draftQuery = tourIds.length === 1
      ? draftQuery.eq('tour_id', tourIds[0])
      : draftQuery.in('tour_id', tourIds);
  }
  const { data: drafts } = await draftQuery;
  if (!drafts?.length) return emptyBins();
  const seriesIds = [...new Set(drafts.map((d: any) => d.series_id))];

  // Query 1: counts — no win_A, always succeeds
  const rows = await fetchAllPages<{ team_a: string; team_b: string; team_a_economy: number; team_b_economy: number; round: number }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const bins = emptyBins();
  for (const row of rows) {
    if (row.round === 1 || row.round === 13) continue;
    for (const { val, rowTeam } of [
      { val: row.team_a_economy, rowTeam: row.team_a },
      { val: row.team_b_economy, rowTeam: row.team_b },
    ]) {
      if (val == null || val < 0) continue;
      if (team && rowTeam !== team) continue;
      bins[Math.min(Math.floor(val / BIN_SIZE), BIN_COUNT - 1)].count++;
    }
  }

  // Query 2: wins — includes win_A; if column doesn't exist fetchAllPages returns [] gracefully
  const winRows = await fetchAllPages<{ team_a: string; team_b: string; team_a_economy: number; team_b_economy: number; win_A: number; round: number }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,win_A,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );
  for (const row of winRows) {
    if (row.round === 1 || row.round === 13) continue;
    for (const { val, rowTeam, won } of [
      { val: row.team_a_economy, rowTeam: row.team_a, won: row.win_A === 1 },
      { val: row.team_b_economy, rowTeam: row.team_b, won: row.win_A === 0 },
    ]) {
      if (val == null || val < 0) continue;
      if (team && rowTeam !== team) continue;
      if (won) bins[Math.min(Math.floor(val / BIN_SIZE), BIN_COUNT - 1)].wins++;
    }
  }

  return bins;
}
