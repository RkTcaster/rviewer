// lib/data/misc.ts — misceláneas: mapas más largos, skirmish, simulaciones
import { supabase } from '../supabase';
import { fetchAllPages } from './helpers';
import { LongestMapEntry, SimulationRow, SkirmishStats, SkirmishTeamStat } from '../types';
import { SkirmishRow } from './rows';

export async function getLongestMaps(filters: {
  reg?: string[];
  tour?: string;
  team?: string;
  bo?: string;
  last?: string;
}): Promise<LongestMapEntry[]> {
  let seriesIds: string[] | null = null;

  // BO filter
  if (filters.bo && filters.bo !== 'all') {
    let draftQuery = supabase.from('draft').select('series_id').eq('bo', parseInt(filters.bo));
    if (filters.tour) draftQuery = draftQuery.in('tour_id', filters.tour.split(','));
    if (filters.reg)  draftQuery = draftQuery.in('reg_id', filters.reg!);
    const draftData = await fetchAllPages<{ series_id: string }>((from, to) => draftQuery.range(from, to));
    if (!draftData.length) return [];
    seriesIds = [...new Set(draftData.map(d => d.series_id))];
  }

  // Last X filter (only when team is provided)
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

  // Main query
  let query = supabase
    .from('player_stats')
    .select('map, map_id, map_duration, team, series_id, tour_id, reg_id, source_url');
  if (filters.team) query = query.eq('team', filters.team);
  if (filters.reg)  query = query.in('reg_id', filters.reg!);
  if (filters.tour) query = query.in('tour_id', filters.tour.split(','));
  if (seriesIds)    query = query.in('series_id', seriesIds);

  const rows = await fetchAllPages<{ map: string; map_id: string; map_duration: string; team: string; series_id: string; tour_id: string; reg_id: string; source_url: string }>((from, to) => query.range(from, to));
  if (!rows.length) return [];

  // Deduplicate by map_id — collect both teams and pick the duration
  const byMapId = new Map<string, { map: string; duration: string; teams: Set<string>; series_id: string; sourceUrl: string }>();
  for (const row of rows) {
    if (!row.map_id || !row.map_duration) continue;
    if (!byMapId.has(row.map_id)) {
      byMapId.set(row.map_id, { map: row.map, duration: row.map_duration, teams: new Set(), series_id: row.series_id, sourceUrl: row.source_url ?? '' });
    }
    if (row.team) byMapId.get(row.map_id)!.teams.add(row.team.trim());
  }

  // Sort by duration descending — try numeric parse, fall back to string compare
  const toSeconds = (s: string): number => {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };
  const sorted = [...byMapId.entries()].sort(([, a], [, b]) => toSeconds(b.duration) - toSeconds(a.duration));

  // Take top 50 by duration as pool, then also sort by rounds after fetching them
  const pool = sorted.slice(0, 50);
  if (!pool.length) return [];

  const poolMapIds = pool.map(([id]) => id);

  // Fetch round counts for the full pool (needs pagination — up to 50×30 = ~1500 rows)
  const roundRows = await fetchAllPages<{ map_id: string; round: string }>((from, to) =>
    supabase.from('round_info').select('map_id, round').in('map_id', poolMapIds).range(from, to)
  );
  const roundMax = new Map<string, number>();
  for (const r of roundRows) {
    if (!r.map_id) continue;
    const n = Number(r.round);
    if (!isNaN(n)) roundMax.set(r.map_id, Math.max(roundMax.get(r.map_id) ?? 0, n));
  }

  // Top 5 by duration, top 5 by rounds — combine and deduplicate
  const byDuration = pool.slice(0, 5);
  const byRounds = [...pool].sort(([idA], [idB]) => (roundMax.get(idB) ?? 0) - (roundMax.get(idA) ?? 0)).slice(0, 5);
  const combined = [...byDuration];
  for (const entry of byRounds) {
    if (!combined.some(([id]) => id === entry[0])) combined.push(entry);
  }

  const combinedSeriesIds = [...new Set(combined.map(([, v]) => v.series_id))];

  // Fetch event + date from draft
  const { data: draftRows } = await supabase
    .from('draft')
    .select('series_id, date, event')
    .in('series_id', combinedSeriesIds);
  const draftMeta = new Map<string, { date: string; event: string }>();
  for (const d of draftRows ?? []) {
    if (!draftMeta.has(d.series_id)) draftMeta.set(d.series_id, { date: d.date ?? '', event: d.event ?? '' });
  }

  return combined.map(([mapId, v]) => {
    const teams = [...v.teams];
    const meta = draftMeta.get(v.series_id) ?? { date: '', event: '' };
    return {
      map: v.map,
      duration: v.duration,
      teamA: teams[0] ?? '',
      teamB: teams[1] ?? '',
      event: meta.event,
      date: meta.date,
      rounds: roundMax.get(mapId) ?? 0,
      sourceUrl: v.sourceUrl,
    };
  });
}

export async function getSkirmishStats(): Promise<SkirmishStats> {
  const { data, error } = await supabase
    .from('skirmish')
    .select('Winner_Side, Match_Side_Winner, TeamA, TeamB, PlayerA_score, PlayerB_Score, TeamA_Player, TeamB_Player');

  if (error) {
    console.error('[getSkirmishStats] Supabase error:', JSON.stringify(error));
    return { total: 0, sideAWins: 0, sideBWins: 0, matchSideWinnerSum: 0, teams: [] };
  }

  const total = data?.length ?? 0;
  if (total === 0) return { total: 0, sideAWins: 0, sideBWins: 0, matchSideWinnerSum: 0, teams: [] };

  const sideAWins = data!.filter((r: SkirmishRow) => r.Winner_Side === 'A').length;
  const sideBWins = data!.filter((r: SkirmishRow) => r.Winner_Side === 'B').length;
  const matchSideWinnerSum = data!.reduce((acc: number, r: SkirmishRow) => acc + (Number(r.Match_Side_Winner) || 0), 0);

  type TeamEntry = { wins: number; losses: number; matchWins: number; bSideWins: number; players: Record<string, { wins: number; losses: number }> };
  const teamMap: Record<string, TeamEntry> = {};
  const init = (t: string) => { if (t && !teamMap[t]) teamMap[t] = { wins: 0, losses: 0, matchWins: 0, bSideWins: 0, players: {} }; };
  const initPlayer = (t: string, p: string) => { if (p && !teamMap[t].players[p]) teamMap[t].players[p] = { wins: 0, losses: 0 }; };

  for (const r of data! as SkirmishRow[]) {
    const a = r.TeamA as string;
    const b = r.TeamB as string;
    const pa = r.TeamA_Player as string;
    const pb = r.TeamB_Player as string;
    const matchWon = Number(r.Match_Side_Winner) >= 1;
    init(a); init(b);
    if (Number(r.PlayerA_score) >= 5) {
      if (a) {
        teamMap[a].wins++;
        if (matchWon) teamMap[a].matchWins++;
        if (r.Winner_Side === 'B') teamMap[a].bSideWins++;
        if (pa) { initPlayer(a, pa); teamMap[a].players[pa].wins++; }
      }
      if (b && pb) { initPlayer(b, pb); teamMap[b].players[pb].losses++; }
      if (b) teamMap[b].losses++;
    } else if (Number(r.PlayerB_Score) >= 5) {
      if (b) {
        teamMap[b].wins++;
        if (matchWon) teamMap[b].matchWins++;
        if (r.Winner_Side === 'B') teamMap[b].bSideWins++;
        if (pb) { initPlayer(b, pb); teamMap[b].players[pb].wins++; }
      }
      if (a && pa) { initPlayer(a, pa); teamMap[a].players[pa].losses++; }
      if (a) teamMap[a].losses++;
    }
  }

  const teams: SkirmishTeamStat[] = Object.entries(teamMap)
    .map(([team, s]) => ({
      team, wins: s.wins, losses: s.losses, matchWins: s.matchWins, bSideWins: s.bSideWins,
      players: Object.entries(s.players).map(([name, p]) => ({ name, wins: p.wins, losses: p.losses })).sort((a, b) => b.wins - a.wins),
    }))
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  return { total, sideAWins, sideBWins, matchSideWinnerSum, teams };
}

export async function getSimulationScenarios(): Promise<SimulationRow[]> {
  const rows = await fetchAllPages<SimulationRow>((from, to) =>
    supabase
      .from('simulations')
      .select('week1_match_1, week1_match_2, week1_match_3, week2_match_1, week2_match_2, week2_match_3, pos1, pos2, pos3, pos4, pos5, pos6, group, region, tournament')
      .range(from, to)
  );
  return rows;
}
