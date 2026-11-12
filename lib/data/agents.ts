// lib/data/agents.ts — picks de agentes y composiciones
import { supabase } from '../supabase';
import { versioned, fetchAllPages, fetchAllBySeries, getAllSeriesIds, getFirstRounds, getReducedTourList } from './helpers';
import { AgentMatchDetail, AgentPickStat, CompMatch, CompositionStat, DuoMapStat, DuoStatsData, MapsMastersData, MapWL } from '../types';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { PlayerStatsRow, RoundInfoRow } from './rows';

// Subconjunto de round_info usado para determinar el ganador de cada mapa
type RoundWinnerRow = Pick<RoundInfoRow, 'series_id' | 'map_id' | 'round' | 'teamA' | 'teamB' | 'rndA' | 'rndB'>;

// New main filter (ROADMAP Phase 12, `allSeries`): the rows of the selected series, read in
// chunks (fetchAllBySeries) and in a stable order so the pages don't overlap
const bySeries = <T,>(seriesIds: (string | number)[], build: () => PostgrestFilterBuilder<any, any, any, any[]>, ...order: string[]) =>
  fetchAllBySeries<T>(seriesIds, (ids, from, to) =>
    order.reduce((q, col) => q.order(col), build().in('series_id', ids)).range(from, to)
  );

// Neon + Phoenix: same filter logic as Maps Masters (draft → series_ids), but per team and map
// it returns on how many map instances the team fielded Neon AND Phoenix at the same time
// (duo) out of how many times it played that map (played), plus how many of those it won (duoWins).
// v3: new main filter (ROADMAP Phase 12): series from round_info (getAllSeriesIds), so qualifiers
// count; `teams` (Relevant) keeps only series those teams played. Queries by series in chunks.
// v4: getAllSeriesIds strict (v3 could cache an empty result after a timeout)
export const getNeonDependencyStats = versioned('neon-phoenix-duo-stats-v4', getNeonDependencyStats_impl);
async function getNeonDependencyStats_impl(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[] }
): Promise<DuoStatsData> {
  const seriesIds = await getAllSeriesIds(filters);
  if (seriesIds.length === 0) return { stats: {}, maps: [] };

  const rows = await fetchAllBySeries<{ team: string; map: string; map_id: string; agent: string }>(seriesIds, (ids, from, to) =>
    supabase.from('player_stats').select('team, map, map_id, agent').in('series_id', ids)
      .order('map_id').order('player_id_vlr').range(from, to)
  );
  if (!rows || rows.length === 0) return { stats: {}, maps: [] };

  // Winner per map_id from round_info (same pattern as getAgentPickStats)
  const winnerByMapId: Record<string, string | undefined> = {};
  const roundRows = await fetchAllBySeries<RoundWinnerRow>(seriesIds, (ids, from, to) =>
    supabase.from('round_info')
      .select('series_id, map_id, round, teamA, teamB, rndA, rndB')
      .in('series_id', ids)
      .order('team_map_round_id')
      .range(from, to)
  );
  const finalRoundByMapId: Record<string, RoundWinnerRow> = {};
  for (const r of roundRows) {
    const prev = finalRoundByMapId[r.map_id];
    if (!prev || Number(r.round) > Number(prev.round)) finalRoundByMapId[r.map_id] = r;
  }
  for (const [map_id, r] of Object.entries(finalRoundByMapId)) {
    winnerByMapId[map_id] = Number(r.rndA) === 1 ? r.teamA?.trim() : r.teamB?.trim();
  }

  // Per team+map: set of map_id played, plus one set per agent of the duo. A map counts for the
  // duo only if its map_id is in both agent sets, i.e. the team fielded them together.
  const playedSets: Record<string, Set<string>> = {};
  const neonSets: Record<string, Set<string>> = {};
  const phoenixSets: Record<string, Set<string>> = {};
  const mapTotals: Record<string, Set<string>> = {};
  for (const r of rows) {
    const team = r.team?.trim();
    const map = r.map?.trim();
    const mapId = r.map_id;
    if (!team || !map || !mapId) continue;
    const key = `${team}__${map}`;
    (playedSets[key] ??= new Set()).add(mapId);
    (mapTotals[map] ??= new Set()).add(mapId);
    if (r.agent === 'Neon') (neonSets[key] ??= new Set()).add(mapId);
    else if (r.agent === 'Phoenix') (phoenixSets[key] ??= new Set()).add(mapId);
  }

  const stats: Record<string, Record<string, DuoMapStat>> = {};
  for (const key of Object.keys(playedSets)) {
    const sep = key.indexOf('__');
    const team = key.slice(0, sep);
    const map = key.slice(sep + 2);
    const neon = neonSets[key];
    const phoenix = phoenixSets[key];
    let duo = 0, duoWins = 0;
    if (neon && phoenix) {
      for (const mapId of neon) {
        if (!phoenix.has(mapId)) continue;
        duo++;
        if (winnerByMapId[mapId] === team) duoWins++;
      }
    }
    if (!stats[team]) stats[team] = {};
    stats[team][map] = {
      played: playedSets[key].size,
      duo,
      duoWins,
    };
  }

  // Mapas ordenados por cantidad de instancias jugadas (desc)
  const maps = Object.keys(mapTotals).sort((a, b) => mapTotals[b].size - mapTotals[a].size || a.localeCompare(b));
  return { stats, maps };
}

// allSeries (Agent Picks on the new main filter): series from round_info (getAllSeriesIds), so
// qualifiers without draft count; `teams` (Relevant) keeps the series one of them played, and
// both teams of those series count. Without it, the old draft-based filter.
// Meta Shift (allSeries too) adds `team` (only that tricode's comps, from the series it played)
// or `excludeTeams` (their comps leave both the picks and the comps count).
// v3: allSeries reads player_stats of the selected tournaments only. The scraper left rows with an
// empty tour_id for maps that were never played (80 rows, e.g. map 3 of a 2-0), which a query by
// series alone picked up.
export const getAgentPickStats = versioned('agent-pick-stats-v3', getAgentPickStats_impl);
async function getAgentPickStats_impl(
  filters: { reg?: string[]; tour?: string; team?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[]; allSeries?: boolean; teams?: string[] }
): Promise<AgentPickStat[]> {
  // Pre-fetch series_ids from draft cuando hay filtros que solo viven ahí (fecha y bo)
  const bo = filters.bo && filters.bo !== 'all' ? parseInt(filters.bo) : null;
  const tours = filters.tour?.split(',').filter(Boolean) ?? [];
  let seriesIds: (string | number)[] | null = null;
  if (filters.allSeries) {
    seriesIds = await getAllSeriesIds(filters);
    if (filters.team) {
      const rounds = await getFirstRounds([...tours].sort().join(','));
      const played = new Set(rounds.filter(r => r.teamA?.trim() === filters.team || r.teamB?.trim() === filters.team).map(r => Number(r.series_id)));
      seriesIds = seriesIds.filter(id => played.has(Number(id)));
    }
    if (seriesIds.length === 0) return [];
  } else if (filters.dateFrom || filters.dateTo || bo !== null) {
    let draftQuery = supabase.from('draft').select('series_id').not('tour_id', 'in', await getReducedTourList());
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
    if (bo !== null)      draftQuery = draftQuery.eq('bo', bo);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return [];
    seriesIds = [...new Set(draftData.map((d: { series_id: string }) => d.series_id))];
  }

  function applyFilters(q: PostgrestFilterBuilder<any, any, any, any[]>) {
    if (filters.tour) q = q.in('tour_id', filters.tour.split(','));
    if (filters.reg)  q = q.in('reg_id', filters.reg!);
    if (seriesIds)    q = q.in('series_id', seriesIds);
    return q;
  }

  // Team branch: single query from player_stats, totalMaps from map_id (denominator = totalMaps, not *2)
  if (filters.team) {
    const rows = filters.allSeries
      ? await bySeries<{ map: string; map_id: string; agent: string }>(seriesIds!, () => supabase.from('player_stats').select('map, map_id, agent').in('tour_id', tours).eq('team', filters.team!), 'map_id', 'player_id_vlr')
      : await fetchAllPages<{ map: string; map_id: string; agent: string }>((from, to) =>
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
      // Solo el equipo filtrado: 1 composicion por mapa
      const comps = totalMaps;
      const pickRate = comps > 0 ? Math.round((count / comps) * 100) : 0;
      results.push({ agent, map: mapName, timesPlayed: count, pickRate, totalMaps, comps });
    }
    return results.sort((a, b) => {
      const mapCmp = a.map.localeCompare(b.map);
      return mapCmp !== 0 ? mapCmp : b.pickRate - a.pickRate;
    });
  }

  // Two parallel queries: map counts from maps_id table + agent picks
  type PickRow = { team: string; map: string; series_id: string; map_id: string; agent: string };
  const [mapRows, allAgentRows] = await Promise.all(filters.allSeries ? [
    bySeries<{ map_id: string; map: string }>(seriesIds!, () => supabase.from('maps_id').select('map_id, map'), 'map_id'),
    bySeries<PickRow>(seriesIds!, () => supabase.from('player_stats').select('team, map, series_id, map_id, agent').in('tour_id', tours), 'map_id', 'player_id_vlr'),
  ] as const : [
    fetchAllPages<{ map_id: string; map: string }>((from, to) =>
      applyFilters(supabase.from('maps_id').select('map_id, map')).range(from, to)
    ),
    fetchAllPages<PickRow>((from, to) => {
      let q = applyFilters(supabase.from('player_stats').select('team, map, series_id, map_id, agent'));
      if (filters.excludeTeams && filters.excludeTeams.length > 0) {
        q = q.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
      }
      return q.range(from, to);
    }),
  ] as const);

  if (!mapRows || mapRows.length === 0) return [];

  // allSeries + excludeTeams: drop their rows here and count how many comps each map loses
  const excluded = filters.allSeries && filters.excludeTeams?.length ? new Set(filters.excludeTeams) : null;
  const agentRows = excluded ? (allAgentRows ?? []).filter(r => !excluded.has(r.team?.trim())) : allAgentRows;
  const excludedComps: Record<string, Set<string>> = {};
  if (excluded) for (const r of allAgentRows ?? []) {
    if (r.map && r.map_id && excluded.has(r.team?.trim())) (excludedComps[r.map] ??= new Set()).add(`${r.map_id}__${r.team.trim()}`);
  }

  // Count unique map instances per map name from maps_id table
  const uniqueMapIds: Record<string, Set<string>> = {};
  for (const row of mapRows) {
    if (!row.map || !row.map_id) continue;
    if (!uniqueMapIds[row.map]) uniqueMapIds[row.map] = new Set();
    uniqueMapIds[row.map].add(row.map_id);
  }

  // Count agent plays per (map, agent) + build per-instance agent sets per team
  const agentCounts: Record<string, number> = {};
  const instanceAgents: Record<string, Record<string, Set<string>>> = {};
  for (const row of agentRows ?? []) {
    if (!row.map || !row.agent) continue;
    const key = `${row.map}__${row.agent}`;
    agentCounts[key] = (agentCounts[key] || 0) + 1;
    if (!row.team || !row.series_id || !row.map_id) continue;
    const instKey = `${row.series_id}__${row.map_id}`;
    if (!instanceAgents[instKey]) instanceAgents[instKey] = {};
    if (!instanceAgents[instKey][row.team]) instanceAgents[instKey][row.team] = new Set();
    instanceAgents[instKey][row.team].add(row.agent);
  }

  // Fetch round_info to determine map winners (same pattern as getOverallCompositions)
  const allSeriesIds = [...new Set((agentRows ?? []).map(r => r.series_id).filter(Boolean))];
  const winnerByMapId: Record<string, string | undefined> = {};
  if (allSeriesIds.length > 0) {
    const roundRows = filters.allSeries
      ? await bySeries<RoundWinnerRow>(allSeriesIds, () => supabase.from('round_info').select('series_id, map_id, round, teamA, teamB, rndA, rndB'), 'team_map_round_id')
      : await fetchAllPages<RoundWinnerRow>((from, to) =>
      supabase.from('round_info')
        .select('series_id, map_id, round, teamA, teamB, rndA, rndB')
        .in('series_id', allSeriesIds)
        .range(from, to)
    );
    const finalRoundByMapId: Record<string, RoundWinnerRow> = {};
    for (const r of roundRows) {
      const prev = finalRoundByMapId[r.map_id];
      if (!prev || Number(r.round) > Number(prev.round)) finalRoundByMapId[r.map_id] = r;
    }
    for (const [map_id, r] of Object.entries(finalRoundByMapId)) {
      winnerByMapId[map_id] = Number(r.rndA) === 1 ? r.teamA?.trim() : r.teamB?.trim();
    }
  }

  // Per-agent non-mirror played/wins: a pick is mirror if the opponent also picked that agent
  const nmStats: Record<string, { nonMirrorPlayed: number; nonMirrorWins: number }> = {};
  for (const row of agentRows ?? []) {
    if (!row.map || !row.agent || !row.team || !row.series_id || !row.map_id) continue;
    const instKey = `${row.series_id}__${row.map_id}`;
    const instance = instanceAgents[instKey] ?? {};
    const isMirror = Object.entries(instance).some(([t, set]) => t !== row.team && set.has(row.agent));
    if (isMirror) continue;
    const key = `${row.map}__${row.agent}`;
    if (!nmStats[key]) nmStats[key] = { nonMirrorPlayed: 0, nonMirrorWins: 0 };
    nmStats[key].nonMirrorPlayed++;
    const winner = winnerByMapId[row.map_id];
    if (winner && winner.toLowerCase() === row.team.toLowerCase()) nmStats[key].nonMirrorWins++;
  }

  const results: AgentPickStat[] = [];
  for (const [key, count] of Object.entries(agentCounts)) {
    const [mapName, agent] = key.split('__');
    const totalMaps = uniqueMapIds[mapName]?.size ?? 0;
    // Ambos equipos de cada mapa: 2 composiciones por mapa
    const comps = totalMaps * 2 - (excludedComps[mapName]?.size ?? 0);
    const pickRate = comps > 0 ? Math.round((count / comps) * 100) : 0;
    const nm = nmStats[key];
    results.push({
      agent,
      map: mapName,
      timesPlayed: count,
      pickRate,
      totalMaps,
      comps,
      nonMirrorPlayed: nm?.nonMirrorPlayed ?? 0,
      nonMirrorWins: nm?.nonMirrorWins ?? 0,
    });
  }

  return results.sort((a, b) => {
    const mapCmp = a.map.localeCompare(b.map);
    return mapCmp !== 0 ? mapCmp : b.pickRate - a.pickRate;
  });
}

// Se cachea una fila por equipo+mapa en vez de una por agente: expandido, el mismo
// composition/oppComposition/url se repetía por cada agente y superaba el límite de 2MB
// de unstable_cache. Los agentes no-mirror se derivan de composition menos oppComposition.
// v4: new main filter (series from getAllSeriesIds, rows by series in chunks; date = first map's)
const getNonMirrorInstances = versioned('agent-nonmirror-instances-v4', getNonMirrorInstances_impl);

// Las instancias tal cual, para el filtro de comp rival (que necesita también las comps espejo)
export const getAgentCompMatches = getNonMirrorInstances;

export async function getAgentNonMirrorMatches(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[] }
): Promise<AgentMatchDetail[]> {
  const instances = await getNonMirrorInstances(filters);
  const result: AgentMatchDetail[] = [];
  for (const { attWins, attTotal, defWins, defTotal, ...inst } of instances) {
    for (const agent of inst.composition) {
      if (inst.oppComposition.includes(agent)) continue; // mirror → excluir
      result.push({ agent, ...inst });
    }
  }
  return result;
}

async function getNonMirrorInstances_impl(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[] }
): Promise<CompMatch[]> {
  const seriesIds = await getAllSeriesIds(filters);
  if (seriesIds.length === 0) return [];

  type NMRound = RoundWinnerRow & Pick<RoundInfoRow, 'side'> & { date: string | null };
  const [agentRows, roundRows] = await Promise.all([
    bySeries<{ team: string; map: string; series_id: string; map_id: string; agent: string; source_url: string }>(seriesIds, () =>
      supabase.from('player_stats').select('team, map, series_id, map_id, agent, source_url'), 'map_id', 'player_id_vlr'),
    bySeries<NMRound>(seriesIds, () =>
      supabase.from('round_info').select('series_id, map_id, round, side, date, teamA, teamB, rndA, rndB'), 'team_map_round_id'),
  ]);
  if (agentRows.length === 0) return [];

  // Series date = its first map's (qualifiers have no draft to take it from)
  const dateBySeriesId: Record<string, string> = {};
  for (const r of roundRows) {
    if (r.date && (!dateBySeriesId[r.series_id] || r.date < dateBySeriesId[r.series_id])) dateBySeriesId[r.series_id] = r.date;
  }

  // Per-instance agent sets per team + map/url
  const instanceAgents: Record<string, Record<string, Set<string>>> = {};
  const mapByInstance: Record<string, string> = {};
  const urlByInstance: Record<string, string> = {};
  const seriesByInstance: Record<string, string> = {};
  for (const row of agentRows) {
    if (!row.team || !row.series_id || !row.map_id || !row.agent) continue;
    const instKey = `${row.series_id}__${row.map_id}`;
    if (!instanceAgents[instKey]) instanceAgents[instKey] = {};
    if (!instanceAgents[instKey][row.team]) instanceAgents[instKey][row.team] = new Set();
    instanceAgents[instKey][row.team].add(row.agent);
    if (row.map && !mapByInstance[instKey]) mapByInstance[instKey] = row.map;
    if (row.source_url && !urlByInstance[instKey]) urlByInstance[instKey] = row.source_url;
    if (!seriesByInstance[instKey]) seriesByInstance[instKey] = row.series_id;
  }

  // Winner per map_id from round_info (same pattern as getAgentPickStats)
  const winnerByMapId: Record<string, string | undefined> = {};
  // Rondas por map_id: total y ganadas por equipo (nombre en minúscula), para el NMWR por rondas
  const roundsByMapId: Record<string, { total: number; won: Record<string, number> }> = {};
  // Rondas por lado por map_id + equipo (minúscula), mismo criterio que getOverallCompositions
  type SideAcc = { attWins: number; attTotal: number; defWins: number; defTotal: number };
  const sideByMapId: Record<string, Record<string, SideAcc>> = {};
  {
    const finalRoundByMapId: Record<string, RoundWinnerRow> = {};
    for (const r of roundRows) {
      const prev = finalRoundByMapId[r.map_id];
      if (!prev || Number(r.round) > Number(prev.round)) finalRoundByMapId[r.map_id] = r;
      const rw = (roundsByMapId[r.map_id] ??= { total: 0, won: {} });
      rw.total++;
      const roundWinner = (Number(r.rndA) === 1 ? r.teamA : r.teamB)?.trim().toLowerCase();
      if (roundWinner) rw.won[roundWinner] = (rw.won[roundWinner] ?? 0) + 1;

      // side viene desde la perspectiva de teamA, así que para teamB se invierte
      const rawSide = r.side?.trim().toLowerCase();
      if (rawSide !== 'atk' && rawSide !== 'def') continue;
      const flipped = rawSide === 'atk' ? 'def' : 'atk';
      for (const [name, side, won] of [
        [r.teamA, rawSide, Number(r.rndA) === 1],
        [r.teamB, flipped, Number(r.rndB) === 1],
      ] as const) {
        const key = name?.trim().toLowerCase();
        if (!key) continue;
        const acc = ((sideByMapId[r.map_id] ??= {})[key] ??= { attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 });
        if (side === 'atk') {
          acc.attTotal++;
          if (won) acc.attWins++;
        } else {
          acc.defTotal++;
          if (won) acc.defWins++;
        }
      }
    }
    for (const [map_id, r] of Object.entries(finalRoundByMapId)) {
      winnerByMapId[map_id] = Number(r.rndA) === 1 ? r.teamA?.trim() : r.teamB?.trim();
    }
  }

  // Emit one record per team in each instance
  const result: CompMatch[] = [];
  for (const [instKey, teams] of Object.entries(instanceAgents)) {
    const teamNames = Object.keys(teams);
    const [, map_id] = instKey.split('__');
    const seriesId = seriesByInstance[instKey];
    const map = mapByInstance[instKey] ?? '';
    const url = urlByInstance[instKey];
    const date = dateBySeriesId[seriesId] ?? '';
    const winner = winnerByMapId[map_id];
    for (const team of teamNames) {
      const opponent = teamNames.find(t => t !== team) ?? '';
      const oppAgents = opponent ? teams[opponent] : new Set<string>();
      const composition = [...teams[team]].sort((a, b) => a.localeCompare(b));
      const oppComposition = [...oppAgents].sort((a, b) => a.localeCompare(b));
      const won = !!winner && winner.toLowerCase() === team.toLowerCase();
      const rounds = roundsByMapId[map_id];
      const roundsWon = rounds?.won[team.trim().toLowerCase()] ?? 0;
      const roundsPlayed = rounds?.total ?? 0;
      const sides = sideByMapId[map_id]?.[team.trim().toLowerCase()] ?? { attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 };
      result.push({ map, team, opponent, won, roundsWon, roundsPlayed, date, url, composition, oppComposition, ...sides });
    }
  }
  return result;
}

// allSeries / teams: Agent Picks on the new main filter, see getAgentPickStats
export const getOverallCompositions = versioned('overall-compositions-v2', getOverallCompositions_impl);
async function getOverallCompositions_impl(
  filters: { team?: string; reg?: string[]; tour?: string; bo?: string; last?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[]; allSeries?: boolean; teams?: string[] }
): Promise<CompositionStat[]> {
  // Pre-fetch series_ids from draft cuando hay filtros que solo viven ahí (fecha y bo)
  const bo = filters.bo && filters.bo !== 'all' ? parseInt(filters.bo) : null;
  let seriesIds: (string | number)[] | null = null;
  if (filters.allSeries) {
    seriesIds = await getAllSeriesIds(filters);
    if (seriesIds.length === 0) return [];
  } else if (filters.dateFrom || filters.dateTo || bo !== null) {
    let draftQuery = supabase.from('draft').select('series_id').not('tour_id', 'in', await getReducedTourList());
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
    if (bo !== null)      draftQuery = draftQuery.eq('bo', bo);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return [];
    seriesIds = [...new Set(draftData.map((d: { series_id: string }) => d.series_id))];
  }

  type CompRow = Pick<PlayerStatsRow, 'team' | 'map' | 'series_id' | 'map_id' | 'agent' | 'reg_id' | 'tour_id'>;
  const rows = filters.allSeries
    ? await bySeries<CompRow>(seriesIds!, () => supabase.from('player_stats').select('team, map, series_id, map_id, agent, reg_id, tour_id'), 'map_id', 'player_id_vlr')
    : await fetchAllPages<CompRow>((from, to) => {
    let q = supabase
      .from('player_stats')
      .select('team, map, series_id, map_id, agent, reg_id, tour_id');
    if (filters.team) q = q.eq('team', filters.team);
    if (filters.tour) q = q.in('tour_id', filters.tour.split(','));
    if (filters.reg)  q = q.in('reg_id', filters.reg!);
    if (seriesIds) q = q.in('series_id', seriesIds);
    if (filters.excludeTeams && filters.excludeTeams.length > 0) {
      q = q.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
    }
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
  const mapByInstance: Record<string, string> = {};
  for (const [key, agents] of Object.entries(grouped)) {
    if (agents.length === 0) continue;
    const parts = key.split('__');
    const team = parts[0];
    const series_id = parts[2];
    const map_id = parts[3];
    const instKey = `${series_id}__${map_id}`;
    if (!compoByInstance[instKey]) compoByInstance[instKey] = {};
    compoByInstance[instKey][team] = agents.slice().sort().join(', ');
    if (!mapByInstance[instKey]) mapByInstance[instKey] = parts[1];
  }

  // Fetch round_info to determine map winners
  const allSeriesIds = [...new Set(Object.keys(grouped).map(k => k.split('__')[2]))];
  const roundRows = filters.allSeries
    ? await bySeries<RoundWinnerRow & Pick<RoundInfoRow, 'side'>>(allSeriesIds, () => supabase.from('round_info').select('series_id, map_id, round, side, teamA, teamB, rndA, rndB'), 'team_map_round_id')
    : await fetchAllPages<RoundWinnerRow & Pick<RoundInfoRow, 'side'>>((from, to) =>
    supabase.from('round_info')
      .select('series_id, map_id, round, side, teamA, teamB, rndA, rndB')
      .in('series_id', allSeriesIds)
      .range(from, to)
  );

  // Find the final round (max round number) per map_id → determine winner
  const finalRoundByMapId: Record<string, RoundWinnerRow> = {};
  for (const r of roundRows) {
    const prev = finalRoundByMapId[r.map_id];
    if (!prev || Number(r.round) > Number(prev.round)) {
      finalRoundByMapId[r.map_id] = r;
    }
  }
  // winner[map_id] = winning team name
  const winnerByMapId: Record<string, string | undefined> = {};
  for (const [map_id, r] of Object.entries(finalRoundByMapId)) {
    winnerByMapId[map_id] = Number(r.rndA) === 1 ? r.teamA?.trim() : r.teamB?.trim();
  }

  // Rondas por (map, composition) según el lado que jugó el equipo que llevó esa comp.
  // side viene desde la perspectiva de teamA, así que para teamB se invierte.
  type SideAcc = { attWins: number; attTotal: number; defWins: number; defTotal: number };
  const sideAcc: Record<string, SideAcc> = {};
  for (const r of roundRows) {
    const instKey = `${r.series_id}__${r.map_id}`;
    const instance = compoByInstance[instKey];
    const mapName = mapByInstance[instKey];
    if (!instance || !mapName) continue;

    const rawSide = r.side?.trim().toLowerCase();
    if (rawSide !== 'atk' && rawSide !== 'def') continue;
    const flipped = rawSide === 'atk' ? 'def' : 'atk';

    // player_stats.team y round_info.teamA/teamB vienen de tablas distintas → comparar normalizado
    const byName: Record<string, string> = {};
    for (const [team, composition] of Object.entries(instance)) {
      byName[team.trim().toLowerCase()] = composition;
    }

    for (const [name, side, won] of [
      [r.teamA, rawSide, Number(r.rndA) === 1],
      [r.teamB, flipped, Number(r.rndB) === 1],
    ] as const) {
      const composition = byName[name?.trim().toLowerCase() ?? ''];
      if (!composition) continue;
      const acc = (sideAcc[`${mapName}__${composition}`] ??= { attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 });
      if (side === 'atk') {
        acc.attTotal++;
        if (won) acc.attWins++;
      } else {
        acc.defTotal++;
        if (won) acc.defWins++;
      }
    }
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

  return Object.entries(countMap).map(([countKey, { teamCounts, nonMirrorWins, nonMirrorPlayed, ...rest }]) => ({
    ...rest,
    ...(sideAcc[countKey] ?? {}),
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
