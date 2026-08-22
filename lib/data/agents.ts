// lib/data/agents.ts — picks de agentes y composiciones
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { AgentMatchDetail, AgentPickStat, CompositionStat, MapCompositionStat, MapsMastersData, MapWL } from '../types';
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { PlayerStatsRow, RoundInfoRow } from './rows';

// Subconjunto de round_info usado para determinar el ganador de cada mapa
type RoundWinnerRow = Pick<RoundInfoRow, 'series_id' | 'map_id' | 'round' | 'teamA' | 'teamB' | 'rndA' | 'rndB'>;

// Neon Dependency: misma lógica de filtro que Maps Masters (draft → series_ids),
// pero por equipo y mapa devuelve cuántas veces el equipo llevó al agente Neon
// (wins = picks de Neon) sobre cuántas veces jugó ese mapa (played).
export const getNeonDependencyStats = versioned('neon-dependency-stats', getNeonDependencyStats_impl);
async function getNeonDependencyStats_impl(
  filters: { tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string }
): Promise<MapsMastersData> {
  let idQuery = supabase.from('draft').select('series_id, bo');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return { stats: {}, maps: [] };

  const seriesIds = [...new Set(idList.map(x => x.series_id))];
  const rows = await fetchAllPages<{ team: string; map: string; map_id: string; agent: string }>((from, to) =>
    supabase.from('player_stats').select('team, map, map_id, agent').in('series_id', seriesIds).range(from, to)
  );
  if (!rows || rows.length === 0) return { stats: {}, maps: [] };

  // Por equipo+mapa: set de map_id jugados y set de map_id donde llevó Neon.
  const playedSets: Record<string, Set<string>> = {};
  const neonSets: Record<string, Set<string>> = {};
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
  }

  const stats: Record<string, Record<string, MapWL>> = {};
  for (const key of Object.keys(playedSets)) {
    const sep = key.indexOf('__');
    const team = key.slice(0, sep);
    const map = key.slice(sep + 2);
    if (!stats[team]) stats[team] = {};
    stats[team][map] = {
      wins: neonSets[key]?.size ?? 0,
      played: playedSets[key].size,
      bans: 0,
    };
  }

  // Mapas ordenados por cantidad de instancias jugadas (desc)
  const maps = Object.keys(mapTotals).sort((a, b) => mapTotals[b].size - mapTotals[a].size || a.localeCompare(b));
  return { stats, maps };
}

export const getAgentPickStats = versioned('agent-pick-stats', getAgentPickStats_impl);
async function getAgentPickStats_impl(
  filters: { reg?: string[]; tour?: string; team?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<AgentPickStat[]> {
  // Pre-fetch series_ids from draft cuando hay filtros que solo viven ahí (fecha y bo)
  const bo = filters.bo && filters.bo !== 'all' ? parseInt(filters.bo) : null;
  let seriesIds: string[] | null = null;
  if (filters.dateFrom || filters.dateTo || bo !== null) {
    let draftQuery = supabase.from('draft').select('series_id');
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
    fetchAllPages<{ team: string; map: string; series_id: string; map_id: string; agent: string }>((from, to) => {
      let q = applyFilters(supabase.from('player_stats').select('team, map, series_id, map_id, agent'));
      if (filters.excludeTeams && filters.excludeTeams.length > 0) {
        q = q.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
      }
      return q.range(from, to);
    }),
  ]);

  if (!mapRows || mapRows.length === 0) return [];

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
    const roundRows = await fetchAllPages<RoundWinnerRow>((from, to) =>
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
    const pickRate = totalMaps > 0 ? Math.round((count / (totalMaps * 2)) * 100) : 0;
    const nm = nmStats[key];
    results.push({
      agent,
      map: mapName,
      timesPlayed: count,
      pickRate,
      totalMaps,
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
type NonMirrorInstance = Omit<AgentMatchDetail, 'agent'>;

const getNonMirrorInstances = versioned('agent-nonmirror-instances', getNonMirrorInstances_impl);

export async function getAgentNonMirrorMatches(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<AgentMatchDetail[]> {
  const instances = await getNonMirrorInstances(filters);
  const result: AgentMatchDetail[] = [];
  for (const inst of instances) {
    for (const agent of inst.composition) {
      if (inst.oppComposition.includes(agent)) continue; // mirror → excluir
      result.push({ agent, ...inst });
    }
  }
  return result;
}

async function getNonMirrorInstances_impl(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<NonMirrorInstance[]> {
  // Pre-fetch series_ids + dates from draft (date filters + always for date lookup)
  const bo = filters.bo && filters.bo !== 'all' ? parseInt(filters.bo) : null;
  let draftQuery = supabase.from('draft').select('series_id, date');
  if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
  if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
  if (bo !== null)      draftQuery = draftQuery.eq('bo', bo);
  const { data: draftData } = await draftQuery;
  if (!draftData || draftData.length === 0) return [];
  const dateBySeriesId: Record<string, string> = {};
  for (const d of draftData as { series_id: string; date: string }[]) {
    if (d.series_id && d.date && !dateBySeriesId[d.series_id]) dateBySeriesId[d.series_id] = d.date;
  }
  const seriesIds = [...new Set(draftData.map((d: { series_id: string }) => d.series_id))];

  const agentRows = await fetchAllPages<{ team: string; map: string; series_id: string; map_id: string; agent: string; source_url: string }>((from, to) => {
    let q = supabase.from('player_stats')
      .select('team, map, series_id, map_id, agent, source_url')
      .in('series_id', seriesIds);
    if (filters.tour) q = q.in('tour_id', filters.tour.split(','));
    if (filters.reg)  q = q.in('reg_id', filters.reg!);
    if (filters.excludeTeams && filters.excludeTeams.length > 0) {
      q = q.not('team', 'in', `(${filters.excludeTeams.join(',')})`);
    }
    return q.range(from, to);
  });
  if (!agentRows || agentRows.length === 0) return [];

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
  const allSeriesIds = [...new Set(agentRows.map(r => r.series_id).filter(Boolean))];
  const winnerByMapId: Record<string, string | undefined> = {};
  if (allSeriesIds.length > 0) {
    const roundRows = await fetchAllPages<RoundWinnerRow>((from, to) =>
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

  // Emit one record per team in each instance
  const result: NonMirrorInstance[] = [];
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
      result.push({ map, team, opponent, won, date, url, composition, oppComposition });
    }
  }
  return result;
}

export const getOverallCompositions = versioned('overall-compositions-v2', getOverallCompositions_impl);
async function getOverallCompositions_impl(
  filters: { team?: string; reg?: string[]; tour?: string; bo?: string; last?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<CompositionStat[]> {
  // Pre-fetch series_ids from draft cuando hay filtros que solo viven ahí (fecha y bo)
  const bo = filters.bo && filters.bo !== 'all' ? parseInt(filters.bo) : null;
  let seriesIds: string[] | null = null;
  if (filters.dateFrom || filters.dateTo || bo !== null) {
    let draftQuery = supabase.from('draft').select('series_id');
    if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
    if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
    if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
    if (bo !== null)      draftQuery = draftQuery.eq('bo', bo);
    const { data: draftData } = await draftQuery;
    if (!draftData || draftData.length === 0) return [];
    seriesIds = [...new Set(draftData.map((d: { series_id: string }) => d.series_id))];
  }

  const rows = await fetchAllPages<Pick<PlayerStatsRow, 'team' | 'map' | 'series_id' | 'map_id' | 'agent' | 'reg_id' | 'tour_id'>>((from, to) => {
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
  const roundRows = await fetchAllPages<RoundWinnerRow & Pick<RoundInfoRow, 'side'>>((from, to) =>
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

export async function getTeamMapCompositions(
  filters: { team: string; tour?: string; bo?: string; reg?: string[]; last?: string; dateFrom?: string; dateTo?: string }
): Promise<MapCompositionStat[]> {
  // Pre-fetch series_ids from draft for this team applying tour/reg/bo/date/last filters
  let draftQuery = supabase
    .from('draft')
    .select('series_id, date')
    .or(`team.eq."${filters.team}",rival.eq."${filters.team}"`)
    .order('date', { ascending: false });
  if (filters.tour)     draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg)      draftQuery = draftQuery.in('reg_id', filters.reg!);
  if (filters.bo && filters.bo !== 'all') draftQuery = draftQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) draftQuery = draftQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   draftQuery = draftQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') draftQuery = draftQuery.limit(parseInt(filters.last));

  const { data: idList } = await draftQuery;
  if (!idList || idList.length === 0) return [];
  const seriesIds = [...new Set(idList.map((d: { series_id: string }) => d.series_id))];
  const dateBySeriesId: Record<string, string> = {};
  for (const d of idList as { series_id: string; date: string }[]) {
    if (d.series_id && d.date && !dateBySeriesId[d.series_id]) dateBySeriesId[d.series_id] = d.date;
  }

  // Fetch player_stats for the target team across those series
  const psRows = await fetchAllPages<Pick<PlayerStatsRow, 'team' | 'map' | 'series_id' | 'map_id' | 'agent' | 'player' | 'source_url'>>((from, to) =>
    supabase
      .from('player_stats')
      .select('team, map, series_id, map_id, agent, player, source_url')
      .eq('team', filters.team)
      .in('series_id', seriesIds)
      .range(from, to)
  );
  if (!psRows || psRows.length === 0) return [];

  // Group agent+player pairs by (series_id, map_id) for the target team
  const agentPlayerByInstance: Record<string, Array<{ agent: string; player: string }>> = {};
  const mapByInstance: Record<string, string> = {};
  const urlByInstance: Record<string, string> = {};
  for (const row of psRows) {
    const key = `${row.series_id}__${row.map_id}`;
    if (!agentPlayerByInstance[key]) agentPlayerByInstance[key] = [];
    if (row.agent && row.player) {
      agentPlayerByInstance[key].push({ agent: row.agent, player: row.player });
    }
    if (row.map && !mapByInstance[key]) mapByInstance[key] = row.map;
    if (row.source_url && !urlByInstance[key]) urlByInstance[key] = row.source_url;
  }

  // For each instance derive: composition (agents sorted), rosterKey (agent:player sorted)
  // and a players map (agent → player) for that exact instance.
  const compositionByInstance: Record<string, string> = {};
  const rosterKeyByInstance: Record<string, string> = {};
  const playersByInstance: Record<string, Record<string, string>> = {};
  for (const [key, pairs] of Object.entries(agentPlayerByInstance)) {
    if (pairs.length === 0) continue;
    const sortedByAgent = pairs.slice().sort((a, b) => a.agent.localeCompare(b.agent));
    compositionByInstance[key] = sortedByAgent.map(p => p.agent).join(', ');
    rosterKeyByInstance[key] = sortedByAgent.map(p => `${p.agent}:${p.player}`).join('|');
    const pm: Record<string, string> = {};
    for (const { agent, player } of sortedByAgent) pm[agent] = player;
    playersByInstance[key] = pm;
  }

  // Fetch round_info for those series
  type CompRound = Pick<RoundInfoRow, 'series_id' | 'map_id' | 'map' | 'round' | 'side' | 'teamA' | 'teamB' | 'rndA' | 'rndB'>;
  const rounds = await fetchAllPages<CompRound>((from, to) =>
    supabase
      .from('round_info')
      .select('series_id, map_id, map, round, side, teamA, teamB, rndA, rndB')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const target = filters.team.trim().toLowerCase();
  // Group key now includes the roster, so same comp with different players ⇒ separate rows
  const acc: Record<string, MapCompositionStat> = {};
  const groupKey = (mapName: string, rosterKey: string) => `${mapName}__${rosterKey}`;
  const ensure = (mapName: string, rosterKey: string, composition: string, players: Record<string, string>): MapCompositionStat => {
    const k = groupKey(mapName, rosterKey);
    if (!acc[k]) {
      acc[k] = { map: mapName, composition, played: 0, wins: 0, attWins: 0, attTotal: 0, defWins: 0, defTotal: 0, players };
    }
    return acc[k];
  };

  // Side accumulation + final-round detection per (series_id, map_id)
  const finalRoundByInstance: Record<string, CompRound> = {};
  for (const r of rounds) {
    const id = r.map_id;
    if (!id) continue;
    const instKey = `${r.series_id}__${id}`;
    const composition = compositionByInstance[instKey];
    const rosterKey = rosterKeyByInstance[instKey];
    if (!composition || !rosterKey) continue;

    const tA = r.teamA?.trim().toLowerCase();
    const tB = r.teamB?.trim().toLowerCase();
    const isTeamA = tA === target;
    const isTeamB = tB === target;
    if (!isTeamA && !isTeamB) continue;

    const mapName = r.map || mapByInstance[instKey];
    if (!mapName) continue;

    const wonRound = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    const rawSide = r.side?.trim().toLowerCase();
    const mySide = isTeamA ? rawSide : (rawSide === 'atk' ? 'def' : rawSide === 'def' ? 'atk' : rawSide);

    const stat = ensure(mapName, rosterKey, composition, playersByInstance[instKey]);
    if (mySide === 'atk') {
      stat.attTotal++;
      if (wonRound) stat.attWins++;
    } else if (mySide === 'def') {
      stat.defTotal++;
      if (wonRound) stat.defWins++;
    }

    const prev = finalRoundByInstance[instKey];
    if (!prev || Number(r.round) > Number(prev.round)) {
      finalRoundByInstance[instKey] = r;
    }
  }

  // played/wins from last round per instance
  for (const [instKey, r] of Object.entries(finalRoundByInstance)) {
    const composition = compositionByInstance[instKey];
    const rosterKey = rosterKeyByInstance[instKey];
    if (!composition || !rosterKey) continue;
    const mapName = r.map || mapByInstance[instKey];
    if (!mapName) continue;
    const isTeamA = r.teamA?.trim().toLowerCase() === target;
    const wonMap = isTeamA ? Number(r.rndA) === 1 : Number(r.rndB) === 1;
    const stat = ensure(mapName, rosterKey, composition, playersByInstance[instKey]);
    stat.played++;
    if (wonMap) stat.wins++;
  }

  // Track latest played instance per group → attach lastPlayedUrl/Date
  // draft.date can come either as ISO ("YYYY-MM-DDTHH:MM:SS" / "YYYY-MM-DD HH:MM:SS")
  // or as text in "D/M/YYYY HH:MM". Try ISO first; fall back to DD/M/YYYY parser.
  const parseDraftDate = (s: string): number => {
    if (!s) return 0;
    // 1) ISO-ish: starts with 4-digit year
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
      const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T'));
      if (!isNaN(t)) return t;
    }
    // 2) D/M/YYYY [HH:MM]
    const [datePart, timePart] = s.split(' ');
    if (datePart) {
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const d = Number(parts[0]);
        const m = Number(parts[1]);
        const y = Number(parts[2]);
        if (d && m && y) {
          let hh = 0, mm = 0;
          if (timePart) {
            const tp = timePart.split(':');
            hh = Number(tp[0]) || 0;
            mm = Number(tp[1]) || 0;
          }
          return new Date(y, m - 1, d, hh, mm).getTime();
        }
      }
    }
    // 3) Last resort: native parser
    const t = Date.parse(s);
    return isNaN(t) ? 0 : t;
  };
  const latestPerGroup: Record<string, { ts: number; date: string; url: string }> = {};
  for (const instKey of Object.keys(finalRoundByInstance)) {
    const composition = compositionByInstance[instKey];
    const rosterKey = rosterKeyByInstance[instKey];
    if (!composition || !rosterKey) continue;
    const mapName = mapByInstance[instKey] || finalRoundByInstance[instKey].map;
    if (!mapName) continue;
    const seriesId = instKey.split('__')[0];
    const date = dateBySeriesId[seriesId] || '';
    const ts = parseDraftDate(date);
    const url = urlByInstance[instKey] || '';
    const gk = groupKey(mapName, rosterKey);
    const prev = latestPerGroup[gk];
    if (!prev || ts > prev.ts) {
      latestPerGroup[gk] = { ts, date, url };
    }
  }
  for (const [gk, stat] of Object.entries(acc)) {
    const lp = latestPerGroup[gk];
    if (lp) {
      if (lp.url) stat.lastPlayedUrl = lp.url;
      if (lp.date) stat.lastPlayedDate = lp.date;
    }
  }

  return Object.entries(acc).sort(([gkA, a], [gkB, b]) => {
    const mc = a.map.localeCompare(b.map);
    if (mc !== 0) return mc;
    const tsA = latestPerGroup[gkA]?.ts ?? 0;
    const tsB = latestPerGroup[gkB]?.ts ?? 0;
    if (tsA !== tsB) return tsB - tsA;
    return b.played - a.played;
  }).map(([, v]) => v);
}
