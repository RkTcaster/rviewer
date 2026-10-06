// lib/data/players.ts — stats individuales de jugadores
import { supabase } from '../supabase';
import { fetchAllPages } from './helpers';
import { PlayerMatchPoint, PlayerStat, PlayerTimelineData, TopPlayerPerformance, TournamentPlayerAvg } from '../types';
import { PlayerStatsCoreStats, PlayerStatsRow, RoundInfoRow } from './rows';

export async function getPlayerStats(
  filters: { team: string; reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string }
): Promise<PlayerStat[]> {
  // Pre-fetch series_ids from draft when bo or date filters are active
  let seriesIds: string[] | null = null;
  if ((filters.bo && filters.bo !== 'all') || filters.dateFrom || filters.dateTo) {
    let draftQuery = supabase.from('draft').select('series_id');
    if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
    const draftData = await fetchAllPages<{ series_id: string }>((from, to) => draftQuery.range(from, to));
    if (!draftData.length) return [];
    seriesIds = [...new Set(draftData.map(d => d.series_id))];
  }

  let query = supabase
    .from('player_stats')
    .select('player, agent, killsBoth, deadBoth, killsT, deadT, killsCT, deadCT, ratingBoth, ratingT, "rating-ct", acsBoth, acsT, acsCT, assistsBoth, assistsT, assistsCT, adrBoth, adrT, adrCT, hsBoth, hsT, hsCT, fkBoth, fkT, fkCT, fdBoth, fdT, fdCT, kastBoth, kastT, kastCT')
    .eq('team', filters.team);

  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg)  query = query.in('reg_id', filters.reg!);
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const rows = await fetchAllPages<Pick<PlayerStatsRow, 'player' | 'agent' | 'assistsBoth' | 'assistsT' | 'assistsCT'> & PlayerStatsCoreStats>((from, to) => query.range(from, to));
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
    sKast: number; sKastT: number; sKastCT: number;
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
    sKast: 0, sKastT: 0, sKastCT: 0,
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
    a.sKast     += Number(row.kastBoth)      || 0;
    a.sKastT    += Number(row.kastT)         || 0;
    a.sKastCT   += Number(row.kastCT)        || 0;
    a.maps++;
    if (row.agent) a.agentCounts[row.agent] = (a.agentCounts[row.agent] || 0) + 1;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const teamFk   = Object.values(playerMap).reduce((s, a) => s + a.sFk,   0);
  const teamFd   = Object.values(playerMap).reduce((s, a) => s + a.sFd,   0);
  const teamFkT  = Object.values(playerMap).reduce((s, a) => s + a.sFkT,  0);
  const teamFdT  = Object.values(playerMap).reduce((s, a) => s + a.sFdT,  0);
  const teamFkCT = Object.values(playerMap).reduce((s, a) => s + a.sFkCT, 0);
  const teamFdCT = Object.values(playerMap).reduce((s, a) => s + a.sFdCT, 0);
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
      kast:    r2(a.sKast  / maps),
      kastAtk: r2(a.sKastT / maps),
      kastDef: r2(a.sKastCT/ maps),
      entry:    r2((a.sFk  + a.sFd)  / (teamFk  + teamFd  || 1) * 100),
      entryAtk: r2((a.sFkT + a.sFdT) / (teamFkT + teamFdT || 1) * 100),
      entryDef: r2((a.sFkCT+ a.sFdCT)/ (teamFkCT+ teamFdCT|| 1) * 100),
    };
  }).sort((a, b) => b.kd - a.kd);
}

export async function getTournamentPlayerAvg(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string }
): Promise<TournamentPlayerAvg | null> {
  let seriesIds: string[] | null = null;
  if ((filters.bo && filters.bo !== 'all') || filters.dateFrom || filters.dateTo) {
    let draftQuery = supabase.from('draft').select('series_id');
    if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return null;
    seriesIds = [...new Set(draftData.map((d: { series_id: string }) => d.series_id))];
  }

  let query = supabase
    .from('player_stats')
    .select('player, killsBoth, deadBoth, killsT, deadT, killsCT, deadCT, ratingBoth, ratingT, "rating-ct", acsBoth, acsT, acsCT, adrBoth, adrT, adrCT, hsBoth, hsT, hsCT, fkBoth, fkT, fkCT, fdBoth, fdT, fdCT, kastBoth, kastT, kastCT');

  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (filters.reg)  query = query.in('reg_id', filters.reg!);
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const rows = await fetchAllPages<Pick<PlayerStatsRow, 'player'> & PlayerStatsCoreStats>((from, to) => query.range(from, to));
  if (!rows || rows.length === 0) return null;

  type Acc2 = {
    kills: number; deaths: number; killsT: number; deadT: number; killsCT: number; deadCT: number;
    sRating: number; sRatingT: number; sRatingCT: number;
    sAcs: number; sAcsT: number; sAcsCT: number;
    sAdr: number; sAdrT: number; sAdrCT: number;
    sHs: number; sHsT: number; sHsCT: number;
    sFk: number; sFkT: number; sFkCT: number;
    sFd: number; sFdT: number; sFdCT: number;
    sKast: number; sKastT: number; sKastCT: number;
    maps: number;
  };
  const pm: Record<string, Acc2> = {};
  const z2 = (): Acc2 => ({
    kills: 0, deaths: 0, killsT: 0, deadT: 0, killsCT: 0, deadCT: 0,
    sRating: 0, sRatingT: 0, sRatingCT: 0,
    sAcs: 0, sAcsT: 0, sAcsCT: 0,
    sAdr: 0, sAdrT: 0, sAdrCT: 0,
    sHs: 0, sHsT: 0, sHsCT: 0,
    sFk: 0, sFkT: 0, sFkCT: 0,
    sFd: 0, sFdT: 0, sFdCT: 0,
    sKast: 0, sKastT: 0, sKastCT: 0,
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
    a.sFk       += Number(row.fkBoth)       || 0;
    a.sFkT      += Number(row.fkT)          || 0;
    a.sFkCT     += Number(row.fkCT)         || 0;
    a.sFd       += Number(row.fdBoth)       || 0;
    a.sFdT      += Number(row.fdT)          || 0;
    a.sFdCT     += Number(row.fdCT)         || 0;
    a.sKast     += Number(row.kastBoth)     || 0;
    a.sKastT    += Number(row.kastT)        || 0;
    a.sKastCT   += Number(row.kastCT)       || 0;
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
    fkfd:      mean(players.map(a => (a.sFk  - a.sFd)  / a.maps)),
    fkfdAtk:   mean(players.map(a => (a.sFkT - a.sFdT) / a.maps)),
    fkfdDef:   mean(players.map(a => (a.sFkCT- a.sFdCT)/ a.maps)),
    kast:      mean(players.map(a => a.sKast   / a.maps)),
    kastAtk:   mean(players.map(a => a.sKastT  / a.maps)),
    kastDef:   mean(players.map(a => a.sKastCT / a.maps)),
  };
}

export async function getPlayerTimeline(
  filters: { team: string; reg?: string[]; tour?: string; bo?: string; last?: string; dateFrom?: string; dateTo?: string }
): Promise<PlayerTimelineData> {
  const limitN = filters.last && filters.last !== 'all' ? parseInt(filters.last) : 10;

  let draftQuery = supabase
    .from('draft')
    .select('series_id, date, team, rival')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });

  if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
  if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);

  const { data: draftRows } = await draftQuery.limit(limitN * 10);
  if (!draftRows?.length) return [];

  const seriesMap = new Map<string, { date: string; rival: string }>();
  for (const row of draftRows) {
    if (!seriesMap.has(row.series_id)) {
      const rival = row.team === filters.team ? row.rival : row.team;
      seriesMap.set(row.series_id, { date: row.date, rival });
    }
    if (seriesMap.size >= limitN) break;
  }
  const seriesIds = [...seriesMap.keys()];
  if (seriesIds.length === 0) return [];

  const [psRows, riRows] = await Promise.all([
    fetchAllPages<Pick<PlayerStatsRow, 'series_id' | 'player' | 'agent'> & PlayerStatsCoreStats>((from, to) =>
      supabase
        .from('player_stats')
        .select('series_id, player, agent, killsBoth, deadBoth, killsT, deadT, killsCT, deadCT, ratingBoth, ratingT, "rating-ct", acsBoth, acsT, acsCT, adrBoth, adrT, adrCT, hsBoth, hsT, hsCT, fkBoth, fkT, fkCT, fdBoth, fdT, fdCT, kastBoth, kastT, kastCT')
        .eq('team', filters.team)
        .in('series_id', seriesIds)
        .range(from, to)
    ),
    fetchAllPages<Pick<RoundInfoRow, 'series_id' | 'map_id' | 'round' | 'teamA' | 'rndA'>>((from, to) =>
      supabase
        .from('round_info')
        .select('series_id, map_id, round, teamA, rndA')
        .in('series_id', seriesIds)
        .range(from, to)
    ),
  ]);
  if (!psRows?.length) return [];

  // Determine series winner: for each map find max round → rndA=1 means teamA won
  const mapMaxRound: Record<string, Record<string, number>> = {};
  const mapFinalRow: Record<string, Record<string, { teamA: string | undefined; rndA: number }>> = {};
  for (const r of riRows ?? []) {
    const sid = r.series_id; const mid = r.map_id; const rnd = Number(r.round);
    if (!mapMaxRound[sid]) { mapMaxRound[sid] = {}; mapFinalRow[sid] = {}; }
    if (mapMaxRound[sid][mid] == null || rnd > mapMaxRound[sid][mid]) {
      mapMaxRound[sid][mid] = rnd;
      mapFinalRow[sid][mid] = { teamA: r.teamA?.trim(), rndA: Number(r.rndA) };
    }
  }
  const seriesWon: Record<string, boolean> = {};
  for (const [sid, maps] of Object.entries(mapFinalRow)) {
    let teamWins = 0, rivalWins = 0;
    for (const { teamA, rndA } of Object.values(maps)) {
      const teamAWon = rndA === 1;
      const isTeamA = teamA === filters.team;
      if ((isTeamA && teamAWon) || (!isTeamA && !teamAWon)) teamWins++;
      else rivalWins++;
    }
    seriesWon[sid] = teamWins > rivalWins;
  }

  type SeriesAcc = {
    kills: number; deaths: number; killsT: number; deadT: number; killsCT: number; deadCT: number;
    sRating: number; sRatingT: number; sRatingCT: number;
    sAcs: number; sAcsT: number; sAcsCT: number;
    sAdr: number; sAdrT: number; sAdrCT: number;
    sHs: number; sHsT: number; sHsCT: number;
    sFk: number; sFkT: number; sFkCT: number;
    sFd: number; sFdT: number; sFdCT: number;
    sKast: number; sKastT: number; sKastCT: number;
    agentCounts: Record<string, number>;
    maps: number;
  };
  const zeroAcc = (): SeriesAcc => ({
    kills: 0, deaths: 0, killsT: 0, deadT: 0, killsCT: 0, deadCT: 0,
    sRating: 0, sRatingT: 0, sRatingCT: 0,
    sAcs: 0, sAcsT: 0, sAcsCT: 0,
    sAdr: 0, sAdrT: 0, sAdrCT: 0,
    sHs: 0, sHsT: 0, sHsCT: 0,
    sFk: 0, sFkT: 0, sFkCT: 0,
    sFd: 0, sFdT: 0, sFdCT: 0,
    sKast: 0, sKastT: 0, sKastCT: 0,
    agentCounts: {}, maps: 0,
  });

  const playerSeriesAcc: Record<string, Record<string, SeriesAcc>> = {};

  for (const row of psRows) {
    if (!row.player || !row.series_id) continue;
    if (!playerSeriesAcc[row.player]) playerSeriesAcc[row.player] = {};
    if (!playerSeriesAcc[row.player][row.series_id]) {
      playerSeriesAcc[row.player][row.series_id] = zeroAcc();
    }
    const a = playerSeriesAcc[row.player][row.series_id];
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
    a.sFk       += Number(row.fkBoth)       || 0;
    a.sFkT      += Number(row.fkT)          || 0;
    a.sFkCT     += Number(row.fkCT)         || 0;
    a.sFd       += Number(row.fdBoth)       || 0;
    a.sFdT      += Number(row.fdT)          || 0;
    a.sFdCT     += Number(row.fdCT)         || 0;
    a.sKast     += Number(row.kastBoth)     || 0;
    a.sKastT    += Number(row.kastT)        || 0;
    a.sKastCT   += Number(row.kastCT)       || 0;
    a.maps++;
    if (row.agent) a.agentCounts[row.agent] = (a.agentCounts[row.agent] || 0) + 1;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const teamSeriesTotals: Record<string, { fk: number; fd: number; fkT: number; fdT: number; fkCT: number; fdCT: number }> = {};
  for (const bySeriesId of Object.values(playerSeriesAcc)) {
    for (const [sid, a] of Object.entries(bySeriesId)) {
      if (!teamSeriesTotals[sid]) teamSeriesTotals[sid] = { fk: 0, fd: 0, fkT: 0, fdT: 0, fkCT: 0, fdCT: 0 };
      const t = teamSeriesTotals[sid];
      t.fk   += a.sFk;   t.fd   += a.sFd;
      t.fkT  += a.sFkT;  t.fdT  += a.sFdT;
      t.fkCT += a.sFkCT; t.fdCT += a.sFdCT;
    }
  }

  const chronologicalIds = [...seriesIds].reverse();

  const result: PlayerTimelineData = Object.entries(playerSeriesAcc).map(([player, bySeriesId]) => {
    const allAgentCounts = Object.values(bySeriesId).reduce((acc, a) => {
      for (const [ag, cnt] of Object.entries(a.agentCounts)) {
        acc[ag] = (acc[ag] || 0) + cnt;
      }
      return acc;
    }, {} as Record<string, number>);
    const agent = Object.entries(allAgentCounts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';

    const matches: PlayerMatchPoint[] = chronologicalIds.flatMap(sid => {
      const meta = seriesMap.get(sid)!;
      const a = bySeriesId[sid];
      if (!a) return [];
      const { kills, deaths, killsT, deadT, killsCT, deadCT, maps } = a;
      return [{
        seriesId: sid,
        date: meta.date,
        rival: meta.rival,
        kd:        deaths === 0 ? kills   : r2(kills   / deaths),
        kdAtk:     deadT  === 0 ? killsT  : r2(killsT  / deadT),
        kdDef:     deadCT === 0 ? killsCT : r2(killsCT / deadCT),
        rating:    r2(a.sRating   / maps),
        ratingAtk: r2(a.sRatingT  / maps),
        ratingDef: r2(a.sRatingCT / maps),
        acs:       r2(a.sAcs    / maps),
        acsAtk:    r2(a.sAcsT   / maps),
        acsDef:    r2(a.sAcsCT  / maps),
        adr:       r2(a.sAdr    / maps),
        adrAtk:    r2(a.sAdrT   / maps),
        adrDef:    r2(a.sAdrCT  / maps),
        hs:        r2(a.sHs  / maps),
        hsAtk:     r2(a.sHsT / maps),
        hsDef:     r2(a.sHsCT/ maps),
        fkfd:      r2((a.sFk  - a.sFd)  / maps),
        fkfdAtk:   r2((a.sFkT - a.sFdT) / maps),
        fkfdDef:   r2((a.sFkCT- a.sFdCT)/ maps),
        kast:      r2(a.sKast  / maps),
        kastAtk:   r2(a.sKastT / maps),
        kastDef:   r2(a.sKastCT/ maps),
        entry:     r2((a.sFk  + a.sFd)  / (teamSeriesTotals[sid].fk  + teamSeriesTotals[sid].fd  || 1) * 100),
        entryAtk:  r2((a.sFkT + a.sFdT) / (teamSeriesTotals[sid].fkT + teamSeriesTotals[sid].fdT || 1) * 100),
        entryDef:  r2((a.sFkCT+ a.sFdCT)/ (teamSeriesTotals[sid].fkCT+ teamSeriesTotals[sid].fdCT|| 1) * 100),
        won:       seriesWon[sid] ?? false,
      }];
    });

    return { player, agent, matches };
  });

  return result;
}

export async function getTopPlayerPerformances(filters: {
  reg?: string[];
  tour?: string;
  team?: string;
  bo?: string;
  last?: string;
}): Promise<TopPlayerPerformance[]> {
  let seriesIds: string[] | null = null;

  if (filters.bo && filters.bo !== 'all') {
    let draftQuery = supabase.from('draft').select('series_id').eq('bo', parseInt(filters.bo));
    if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)  draftQuery = draftQuery.in('reg_id', filters.reg!);
    const draftData = await fetchAllPages<{ series_id: string }>((from, to) => draftQuery.range(from, to));
    if (!draftData.length) return [];
    seriesIds = [...new Set(draftData.map(d => d.series_id))];
  }

  if (filters.last && filters.last !== 'all' && filters.team) {
    const limit = parseInt(filters.last);
    let lastQuery = supabase
      .from('draft')
      .select('series_id, date')
      .or(`team.eq.${filters.team},rival.eq.${filters.team}`)
      .order('date', { ascending: false });
    if (filters.reg)  lastQuery = lastQuery.in('reg_id', filters.reg!);
    if (filters.tour) lastQuery = lastQuery.in('tour_id', filters.tour.split(','));
    if (seriesIds)    lastQuery = lastQuery.in('series_id', seriesIds);
    const lastData = await fetchAllPages<{ series_id: string; date: string }>((from, to) => lastQuery.range(from, to));
    const seen = new Set<string>();
    const limitedIds: string[] = [];
    for (const row of lastData) {
      if (!seen.has(row.series_id)) {
        seen.add(row.series_id);
        limitedIds.push(row.series_id);
        if (seen.size >= limit) break;
      }
    }
    if (!limitedIds.length) return [];
    seriesIds = limitedIds;
  }

  let query = supabase
    .from('player_stats')
    .select('player, team, acsBoth, killsBoth, deadBoth, assistsBoth, kastBoth, adrBoth, hsBoth, fkBoth, fdBoth, map, series_id, source_url');
  if (filters.team) query = query.eq('team', filters.team);
  if (filters.reg)  query = query.in('reg_id', filters.reg!);
  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const rows = await fetchAllPages<{
    player: string; team: string;
    acsBoth: string; killsBoth: string; deadBoth: string; assistsBoth: string;
    kastBoth: string; adrBoth: string; hsBoth: string; fkBoth: string; fdBoth: string;
    map: string; series_id: string; source_url: string;
  }>((from, to) => query.range(from, to));
  if (!rows.length) return [];

  const r2 = (n: number) => Math.round(n * 100) / 100;

  const performances: TopPlayerPerformance[] = rows
    .filter(r => r.player && r.acsBoth)
    .map(r => {
      const kills   = Number(r.killsBoth)   || 0;
      const deaths  = Number(r.deadBoth)    || 0;
      const fk      = Number(r.fkBoth)      || 0;
      const fd      = Number(r.fdBoth)      || 0;
      return {
        player:   r.player,
        team:     r.team ?? '',
        acs:      Number(r.acsBoth)      || 0,
        kills,
        deaths,
        assists:  Number(r.assistsBoth)  || 0,
        kd:       r2(deaths === 0 ? kills : kills / deaths),
        kast:     Number(r.kastBoth)     || 0,
        adr:      Number(r.adrBoth)      || 0,
        hs:       Number(r.hsBoth)       || 0,
        fk,
        fd,
        fkfd:     fk - fd,
        map:      r.map ?? '',
        event:    '',
        date:     '',
        sourceUrl: r.source_url ?? '',
      };
    });

  // Enrich dates + event — collect unique series_ids from rows
  const uniqueSeriesIds = [...new Set(rows.map(r => r.series_id).filter(Boolean))];
  if (uniqueSeriesIds.length) {
    const { data: draftRows } = await supabase
      .from('draft')
      .select('series_id, date, event')
      .in('series_id', uniqueSeriesIds);
    const metaMap = new Map<string, { date: string; event: string }>();
    for (const d of draftRows ?? []) {
      if (!metaMap.has(d.series_id)) metaMap.set(d.series_id, { date: d.date ?? '', event: d.event ?? '' });
    }
    for (let i = 0; i < performances.length; i++) {
      const sid = rows[i]?.series_id;
      if (sid) {
        const meta = metaMap.get(sid);
        if (meta) { performances[i].date = meta.date; performances[i].event = meta.event; }
      }
    }
  }

  return performances;
}
