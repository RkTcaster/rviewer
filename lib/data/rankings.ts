// lib/data/rankings.ts — stats por torneo: ranking de equipos, maps masters, timeline de forma
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { FormMapPoint, MapsMastersData, MapWL, TeamRankStats } from '../types';
import { DraftRow, PlayerPerformanceRow, RoundInfoRow } from './rows';

export const getTournamentRankings = versioned('tournament-rankings', getTournamentRankings_impl);
async function getTournamentRankings_impl(
  filters: { tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string }
): Promise<Record<string, TeamRankStats>> {
  let idQuery = supabase.from('draft').select('series_id');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return {};

  const seriesIds = [...new Set(idList.map(x => x.series_id))];
  const rounds = await fetchAllPages<RoundInfoRow>((from, to) =>
    supabase.from('round_info').select('*').in('series_id', seriesIds).range(from, to)
  );
  if (!rounds || rounds.length === 0) return {};

  const teamStats: Record<string, TeamRankStats> = {};
  const mapLastRound: Record<string, RoundInfoRow> = {};

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
      first3Lost: 0,
      first3Total: 0,
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
  Object.values(mapLastRound).forEach((finalRound) => {
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

  // First-3-lost: among halves where a team lost the pistol AND R2, count how
  // many also lost R3 (full L-L-L sweep). Denominator = pistol+R2 losses.
  Object.values(mapKeyRounds).forEach(({ teamA, teamB, r1, r2, r3, r13, r14, r15 }) => {
    if (r1 !== undefined && r2 !== undefined && r3 !== undefined) {
      // teamA lost pistol (!r1) and R2 (!r2)
      if (!r1 && !r2) { teamStats[teamA].first3Total++; if (!r3) teamStats[teamA].first3Lost++; }
      // teamB lost pistol (r1) and R2 (r2)
      if (r1 && r2)   { teamStats[teamB].first3Total++; if (r3)  teamStats[teamB].first3Lost++; }
    }
    if (r13 !== undefined && r14 !== undefined && r15 !== undefined) {
      if (!r13 && !r14) { teamStats[teamA].first3Total++; if (!r15) teamStats[teamA].first3Lost++; }
      if (r13 && r14)   { teamStats[teamB].first3Total++; if (r15)  teamStats[teamB].first3Lost++; }
    }
  });

  // Retake efficiency from player_performance
  const perfRows = await fetchAllPages<PlayerPerformanceRow>((from, to) =>
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

  Object.entries(mapLastRound).forEach(([map_id, r]) => {
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

// Maps Masters: usa la misma lógica de filtro que Stats Rank (draft → series → round_info)
// y devuelve, por equipo y por mapa, victorias/jugados.
export const getMapsMastersStats = versioned('maps-masters-stats', getMapsMastersStats_impl);
async function getMapsMastersStats_impl(
  filters: { tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string }
): Promise<MapsMastersData> {
  let idQuery = supabase.from('draft').select('series_id, team, rival, bo, team_1_select_1, team_1_select_3, team_2_select_1, team_2_select_3');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return { stats: {}, maps: [] };

  const seriesIds = [...new Set(idList.map(x => x.series_id))];
  type MastersRound = Pick<RoundInfoRow, 'map_id' | 'map' | 'teamA' | 'teamB' | 'rndA' | 'round'>;
  const rounds = await fetchAllPages<MastersRound>((from, to) =>
    supabase.from('round_info').select('map_id, map, teamA, teamB, rndA, round').in('series_id', seriesIds).range(from, to)
  );
  if (!rounds || rounds.length === 0) return { stats: {}, maps: [] };

  // Última ronda por map_id → define al ganador del mapa
  const mapLastRound: Record<string, MastersRound> = {};
  rounds.forEach((r) => {
    const id = r.map_id;
    if (!id) return;
    if (!mapLastRound[id] || Number(r.round) > Number(mapLastRound[id].round)) mapLastRound[id] = r;
  });

  const stats: Record<string, Record<string, MapWL>> = {};
  const mapTotals: Record<string, number> = {};
  const ensure = (team: string, map: string) => {
    if (!stats[team]) stats[team] = {};
    if (!stats[team][map]) stats[team][map] = { wins: 0, played: 0, bans: 0 };
  };

  Object.values(mapLastRound).forEach((r) => {
    const tA = r.teamA?.trim();
    const tB = r.teamB?.trim();
    const map = r.map?.trim();
    if (!tA || !tB || !map) return;
    ensure(tA, map); ensure(tB, map);
    stats[tA][map].played++;
    stats[tB][map].played++;
    if (Number(r.rndA) === 1) stats[tA][map].wins++;
    else stats[tB][map].wins++;
    mapTotals[map] = (mapTotals[map] || 0) + 1;
  });

  // Bans por equipo y mapa (desde el draft).
  // select_1 siempre es un ban; en BO3 select_3 también es ban.
  idList.forEach((d: Pick<DraftRow, 'team' | 'rival' | 'bo' | 'team_1_select_1' | 'team_1_select_3' | 'team_2_select_1' | 'team_2_select_3'>) => {
    const t1 = d.team?.trim();
    const t2 = d.rival?.trim();
    const isBo3 = Number(d.bo) === 3;
    const addBan = (team: string | undefined, map: string | null | undefined) => {
      const m = map?.trim();
      if (!team || !m) return;
      ensure(team, m);
      stats[team][m].bans++;
    };
    addBan(t1, d.team_1_select_1);
    addBan(t2, d.team_2_select_1);
    if (isBo3) {
      addBan(t1, d.team_1_select_3);
      addBan(t2, d.team_2_select_3);
    }
  });

  // Mapas ordenados por cantidad de partidas jugadas (desc)
  const maps = Object.keys(mapTotals).sort((a, b) => mapTotals[b] - mapTotals[a] || a.localeCompare(b));
  return { stats, maps };
}

// Mapas jugados por el equipo en orden cronológico, con rondas ganadas/perdidas y
// resultado del mapa (ganador de la última ronda), para la timeline de forma.
export async function getTeamFormTimeline(filters: { team: string; tour?: string; bo?: string; reg?: string[]; last?: string; dateFrom?: string; dateTo?: string }): Promise<FormMapPoint[]> {
  let idQuery = supabase
    .from('draft')
    .select('series_id, date, team, rival, event')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  if (filters.tour)     idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.limit(parseInt(filters.last));

  const { data: seriesList, error } = await idQuery;
  if (error || !seriesList || seriesList.length === 0) return [];

  const seriesInfo: Record<string, { date: string; rival: string; event: string }> = {};
  for (const s of seriesList) {
    seriesInfo[s.series_id] = {
      date: s.date,
      rival: s.team === filters.team ? s.rival : s.team,
      event: s.event ?? '',
    };
  }
  const seriesIds = Object.keys(seriesInfo);

  const rounds = await fetchAllPages<Pick<RoundInfoRow, 'series_id' | 'map_id' | 'map' | 'round' | 'teamA' | 'teamB' | 'rndA' | 'rndB'>>((from, to) =>
    supabase
      .from('round_info')
      .select('series_id, map_id, map, round, teamA, teamB, rndA, rndB')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const target = filters.team.trim().toLowerCase();
  type MapAgg = { seriesId: string; mapId: string; map: string; roundsWon: number; roundsLost: number; lastRound: number; wonLast: boolean };
  const perMap: Record<string, MapAgg> = {};

  for (const r of rounds) {
    const id = r.map_id;
    if (!id) continue;
    const isTeamA = r.teamA?.trim().toLowerCase() === target;
    const isTeamB = r.teamB?.trim().toLowerCase() === target;
    if (!isTeamA && !isTeamB) continue;

    const wonRound = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    if (!perMap[id]) {
      perMap[id] = { seriesId: r.series_id, mapId: String(id), map: r.map, roundsWon: 0, roundsLost: 0, lastRound: 0, wonLast: false };
    }
    const agg = perMap[id];
    if (wonRound) agg.roundsWon++; else agg.roundsLost++;
    if (Number(r.round) > agg.lastRound) {
      agg.lastRound = Number(r.round);
      agg.wonLast = wonRound;
    }
  }

  return Object.values(perMap)
    .sort((a, b) => {
      const da = seriesInfo[a.seriesId]?.date ?? '';
      const db = seriesInfo[b.seriesId]?.date ?? '';
      if (da !== db) return da.localeCompare(db);
      if (a.seriesId !== b.seriesId) return a.seriesId.localeCompare(b.seriesId);
      return a.mapId.localeCompare(b.mapId, undefined, { numeric: true });
    })
    .map(a => {
      const info = seriesInfo[a.seriesId] ?? { date: '', rival: '', event: '' };
      return {
        date: info.date,
        rival: info.rival,
        event: info.event,
        map: a.map,
        roundsWon: a.roundsWon,
        roundsLost: a.roundsLost,
        won: a.wonLast,
      };
    });
}
