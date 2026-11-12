// lib/data/draft.ts — picks/bans del draft y stats de mapas por equipo
import { supabase } from '../supabase';
import { versioned, fetchAllPages, fetchAllBySeries, getAllSeriesIds, getTeamSeriesIds, TeamFilters, getReducedTourList } from './helpers';
import { CompositionStat, DashboardData, MapCompositionStat, TeamDashboardData, MapInfoData, MapStat, OverallMapFullStat, OverallMapStat, TeamCompareData, TeamMapsData, VetoFlow } from '../types';
import { DraftRow, RoundInfoRow } from './rows';

export async function getOverallMapPicks(
  filters: { reg?: string[]; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; excludeTeams?: string[] }
): Promise<OverallMapStat[]> {
  let query = supabase.from('draft').select('*').not('tour_id', 'in', await getReducedTourList());
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

const initMapStat = (stats: Record<string, OverallMapFullStat>, map: string) => {
  if (!stats[map]) stats[map] = { mapName: map, picks: 0, bans: 0, deciders: 0, attWins: 0, attTotal: 0, defWins: 0, defTotal: 0 };
};

// picks/bans/deciders of each draft row. Bo3: select_1 ban, select_2 pick, select_3 second ban;
// Bo5: select_3 is a pick too
function addDraftCounts(stats: Record<string, OverallMapFullStat>, drafts: DraftRow[]) {
  const init = (map: string) => initMapStat(stats, map);
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
}

// atk/def WR per round (side is team A's side, rndA = 1 when team A won it)
function addSideRounds(stats: Record<string, OverallMapFullStat>, rounds: Pick<RoundInfoRow, 'map' | 'rndA' | 'side'>[]) {
  for (const r of rounds) {
    const mapName = r.map;
    initMapStat(stats, mapName);
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
}

// Map Info on the new filter (ROADMAP Phase 12): series from round_info (getAllSeriesIds), so
// qualifiers without draft count. Atk / Def WR and maps played come from every series; picks,
// bans and deciders only from the ones with a draft, so the section says how many those are.
// Drafts are read by series_id with no reduced guard: the NA open qualifier has 72 real ones.
// `teams` (Relevant): only series where one of them played.
// v1: first version
// v2: getAllSeriesIds strict (v1 could cache an empty result after a timeout)
export const getMapInfo = versioned('map-info-v2', getMapInfo_impl);
async function getMapInfo_impl(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[] }
): Promise<MapInfoData> {
  const seriesIds = await getAllSeriesIds(filters);
  if (seriesIds.length === 0) return { stats: [], series: 0, draftSeries: 0 };

  const [drafts, rounds] = await Promise.all([
    fetchAllBySeries<DraftRow>(seriesIds, (ids, from, to) =>
      supabase.from('draft').select('*').in('series_id', ids).order('series_id').range(from, to)
    ),
    fetchAllBySeries<Pick<RoundInfoRow, 'map_id' | 'map' | 'rndA' | 'side'>>(seriesIds, (ids, from, to) =>
      supabase.from('round_info').select('map_id, map, rndA, side').in('series_id', ids)
        .order('series_id').order('team_map_round_id').range(from, to)
    ),
  ]);

  const stats: Record<string, OverallMapFullStat> = {};
  addDraftCounts(stats, drafts);
  addSideRounds(stats, rounds);
  const played: Record<string, Set<string>> = {};
  for (const r of rounds) (played[r.map] ??= new Set()).add(r.map_id);

  return {
    stats: Object.values(stats).map(s => ({ ...s, played: played[s.mapName]?.size ?? 0 })),
    series: seriesIds.length,
    draftSeries: new Set(drafts.map(d => Number(d.series_id))).size,
  };
}

// --- Stats ---

// Team pages on the new main filter (ROADMAP Phase 12). The team is a vlr id, not a tricode:
// its series come from round_info (team_a_id_vlr / team_b_id_vlr, so qualifiers without draft
// count and a homonym's series stay out), `last` keeps its newest N, and each round is read from
// its own column by id. Compositions come from player_stats.team_id_vlr. Only `draft` has no id:
// inside one of its series the team is the side with its tricode (a series between two teams
// with the same tricode, like 785082, can't be told apart there).
// procesarTodo matches by tricode, so the team's side is renamed to TEAM_KEY first.
const TEAM_KEY = '__team__';
type TeamRound = Pick<RoundInfoRow, 'series_id' | 'map_id' | 'map' | 'round' | 'side' | 'teamA' | 'teamB' | 'rndA' | 'rndB'>
  & { team_a_id_vlr: string | null; team_b_id_vlr: string | null };

// Series (getTeamSeriesIds), drafts and rounds of the team in the selection, the last two
// already on TEAM_KEY
async function loadTeamSeries(filters: TeamFilters) {
  const { tours, seriesIds, dateOf, tagOf, lastMatchDate } = await getTeamSeriesIds(filters);
  if (seriesIds.length === 0) return { tours, seriesIds, drafts: [] as DraftRow[], rounds: [] as TeamRound[], dateOf, lastMatchDate };

  const [drafts, allRounds] = await Promise.all([
    fetchAllBySeries<DraftRow>(seriesIds, (ids, from, to) =>
      supabase.from('draft').select('*').in('series_id', ids).order('series_id').range(from, to)
    ),
    fetchAllBySeries<TeamRound>(seriesIds, (ids, from, to) =>
      supabase.from('round_info').select('series_id, map_id, map, round, side, teamA, teamB, rndA, rndB, team_a_id_vlr, team_b_id_vlr')
        .in('series_id', ids).order('series_id').order('team_map_round_id').range(from, to)
    ),
  ]);
  return {
    tours, seriesIds, dateOf, lastMatchDate,
    // Rows without the team's id are left out (round_info has a few duplicated maps with null ids)
    rounds: allRounds
      .filter(r => r.team_a_id_vlr === filters.teamId || r.team_b_id_vlr === filters.teamId)
      .map(r => r.team_a_id_vlr === filters.teamId ? { ...r, teamA: TEAM_KEY, teamB: 'rival' } : { ...r, teamA: 'rival', teamB: TEAM_KEY }),
    drafts: drafts.map(d => {
      const isTeam = d.team?.trim() === tagOf.get(Number(d.series_id));
      return isTeam ? { ...d, team: TEAM_KEY, rival: 'rival' } : { ...d, team: 'rival', rival: TEAM_KEY };
    }),
  };
}
// Winner of each map (its last round), from the team's side
function teamMapWins(rounds: TeamRound[]): Record<string, boolean> {
  const won: Record<string, boolean> = {};
  const lastRound: Record<string, number> = {};
  for (const r of rounds) {
    if (lastRound[r.map_id] !== undefined && Number(r.round) <= lastRound[r.map_id]) continue;
    lastRound[r.map_id] = Number(r.round);
    won[r.map_id] = Number(r.teamA === TEAM_KEY ? r.rndA : r.rndB) === 1;
  }
  return won;
}

// The team's map table, draft order, pistols, anti-eco, recovery and PAB (Compare Stats)
export const getTeamDashboard = versioned('team-dashboard-v1', getTeamDashboard_impl);
async function getTeamDashboard_impl(filters: TeamFilters): Promise<TeamDashboardData> {
  const { seriesIds, drafts, rounds } = await loadTeamSeries(filters);
  const { lastMatchData, ...stats } = procesarTodo(drafts, rounds as unknown as RoundInfoRow[], TEAM_KEY);
  return { ...stats, series: seriesIds.length, draftSeries: new Set(drafts.map(d => Number(d.series_id))).size };
}

// Team → Maps
export const getTeamMaps = versioned('team-maps-v1', getTeamMaps_impl);
async function getTeamMaps_impl(filters: TeamFilters): Promise<TeamMapsData> {
  const { tours, seriesIds, drafts, rounds, lastMatchDate } = await loadTeamSeries(filters);
  if (seriesIds.length === 0) return { mapStats: [], compositions: [], series: 0, draftSeries: 0, lastMatchDate };

  const picks = await fetchAllBySeries<{ map: string; map_id: string; agent: string }>(seriesIds, (ids, from, to) =>
    supabase.from('player_stats').select('map, map_id, agent').in('series_id', ids).in('tour_id', tours)
      .eq('team_id_vlr', filters.teamId).order('map_id').order('player_id_vlr').range(from, to)
  );
  const { mapStats } = procesarTodo(drafts, rounds as unknown as RoundInfoRow[], TEAM_KEY);

  // Compositions: one per map played, with the team's W-L on it
  const wonMap = teamMapWins(rounds);
  const agentsOf: Record<string, { map: string; agents: string[] }> = {};
  for (const p of picks) {
    if (!p.map || !p.map_id || !p.agent) continue;
    (agentsOf[p.map_id] ??= { map: p.map, agents: [] }).agents.push(p.agent);
  }
  const comps: Record<string, CompositionStat> = {};
  for (const [mapId, { map, agents }] of Object.entries(agentsOf)) {
    const composition = agents.sort().join(', ');
    const c = (comps[`${map}__${composition}`] ??= { map, composition, played: 0, nonMirrorPlayed: 0, nonMirrorWins: 0 });
    c.played++;
    c.nonMirrorPlayed!++;
    if (wonMap[mapId]) c.nonMirrorWins!++;
  }

  return {
    mapStats,
    compositions: Object.values(comps).sort((a, b) => a.map.localeCompare(b.map) || b.played - a.played),
    series: seriesIds.length,
    draftSeries: new Set(drafts.map(d => Number(d.series_id))).size,
    lastMatchDate,
  };
}

// One side of Compare Maps: the map table (procesarTodo) plus the team's compositions per map,
// one row per composition and roster (same agents with other players = another row), with its
// rounds by side, W-L and the vlr link and date of the last time it was played.
export const getTeamCompare = versioned('team-compare-v1', getTeamCompare_impl);
async function getTeamCompare_impl(filters: TeamFilters): Promise<TeamCompareData> {
  const { tours, seriesIds, drafts, rounds, dateOf, lastMatchDate } = await loadTeamSeries(filters);
  if (seriesIds.length === 0) return { mapStats: [], draftOrder: { a: 0, b: 0 }, comps: [], series: 0, draftSeries: 0, lastMatchDate };

  type Pick5 = { map: string; map_id: string; series_id: string; agent: string; player: string; source_url: string | null };
  const picks = await fetchAllBySeries<Pick5>(seriesIds, (ids, from, to) =>
    supabase.from('player_stats').select('map, map_id, series_id, agent, player, source_url').in('series_id', ids).in('tour_id', tours)
      .eq('team_id_vlr', filters.teamId).order('map_id').order('player_id_vlr').range(from, to)
  );
  const { mapStats, draftOrder } = procesarTodo(drafts, rounds as unknown as RoundInfoRow[], TEAM_KEY);

  // Per map played: its composition group (map + agent:player pairs) and when it was played
  const instances: Record<string, { map: string; date: string; url: string; pairs: { agent: string; player: string }[] }> = {};
  for (const p of picks) {
    if (!p.map || !p.map_id) continue;
    const inst = (instances[p.map_id] ??= { map: p.map, date: dateOf.get(Number(p.series_id)) ?? '', url: p.source_url ?? '', pairs: [] });
    if (p.agent && p.player) inst.pairs.push({ agent: p.agent, player: p.player });
  }
  const groupOf: Record<string, string> = {};
  const acc: Record<string, MapCompositionStat & { latest: string }> = {};
  const wonMap = teamMapWins(rounds);
  for (const [mapId, inst] of Object.entries(instances)) {
    if (inst.pairs.length === 0 || wonMap[mapId] === undefined) continue;
    const pairs = inst.pairs.sort((a, b) => a.agent.localeCompare(b.agent));
    const key = `${inst.map}__${pairs.map(p => `${p.agent}:${p.player}`).join('|')}`;
    groupOf[mapId] = key;
    const c = (acc[key] ??= {
      map: inst.map, composition: pairs.map(p => p.agent).join(', '), played: 0, wins: 0,
      attWins: 0, attTotal: 0, defWins: 0, defTotal: 0,
      players: Object.fromEntries(pairs.map(p => [p.agent, p.player])), latest: '',
    });
    c.played++;
    if (wonMap[mapId]) c.wins++;
    if (inst.date > c.latest || !c.lastPlayedDate) {
      c.latest = inst.date;
      if (inst.date) c.lastPlayedDate = inst.date;
      if (inst.url) c.lastPlayedUrl = inst.url;
    }
  }
  for (const r of rounds) {
    const c = acc[groupOf[r.map_id]];
    const rawSide = r.side?.trim().toLowerCase();
    if (!c || (rawSide !== 'atk' && rawSide !== 'def')) continue;
    const isA = r.teamA === TEAM_KEY;
    const won = Number(isA ? r.rndA : r.rndB) === 1;
    if ((rawSide === 'atk') === isA) { c.attTotal++; if (won) c.attWins++; }
    else { c.defTotal++; if (won) c.defWins++; }
  }

  return {
    mapStats, draftOrder,
    comps: Object.values(acc)
      .sort((a, b) => a.map.localeCompare(b.map) || b.latest.localeCompare(a.latest) || b.played - a.played)
      .map(({ latest, ...c }) => c),
    series: seriesIds.length,
    draftSeries: new Set(drafts.map(d => Number(d.series_id))).size,
    lastMatchDate,
  };
}

export async function getMapStats(filters: { team: string; tour?: string; bo?: string; reg?: string[]; last?: string; dateFrom?: string; dateTo?: string }): Promise<DashboardData> {
  let idQuery = supabase
    .from('draft')
    .select('series_id, date')
    .not('tour_id', 'in', await getReducedTourList())
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
    .not('tour_id', 'in', await getReducedTourList())
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
  let lastDate = drafts[0]?.date ?? null
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
    // Picks Equipo — 1st/2nd según la posición en el draft: el equipo A pickea
    // antes que el B, así que sus picks son "1st pick" y los del B "2nd pick".
    const p1 = isTeam1 ? m.team_1_select_2 : m.team_2_select_2;
    if (p1) { initMap(p1); stats[p1].picks++; if (isTeam1) stats[p1].pick1++; else stats[p1].pick2++; }
    if (boType === 5) {
      const p2 = isTeam1 ? m.team_1_select_3 : m.team_2_select_3;
      if (p2) { initMap(p2); stats[p2].picks++; if (isTeam1) stats[p2].pick1++; else stats[p2].pick2++; }
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
    .not('tour_id', 'in', await getReducedTourList())
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
