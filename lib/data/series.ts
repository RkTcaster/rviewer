// lib/data/series.ts — series-level aggregates.
// The rest of the data layer reasons per map; this is the only module that rolls
// maps up into a series result, since Supabase stores no series winner or score.
//
// Two different scopes live here on purpose: the series blocks (veto order, and the
// 2-0 / 2-1 partition) are Bo3-only, because that partition is exact only in a Bo3;
// the overtime block is per map and covers every format. Restricting OT to Bo3 too
// would silently drop the Bo5 finals, which is where the high-stakes OT maps are.
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { SeriesOutcomeGlobal, SeriesOutcomeStats, SeriesOutcomesData } from '../types';
import { RoundInfoRow } from './rows';

type SeriesRow = { series_id: string; team: string | null; rival: string | null; bo: number | string | null };
type OutcomeRound = Pick<RoundInfoRow, 'series_id' | 'map_id' | 'map_order' | 'round' | 'teamA' | 'teamB' | 'rndA'>;

// A map went to overtime when it played more than 24 rounds (13 to win, so 24 is
// the regulation maximum before a 12-12 tie). OT always comes in pairs.
const REGULATION_ROUNDS = 24;

export const emptySeriesOutcomes = (): SeriesOutcomesData => ({
  global: { series: 0, teamAWins: 0, sweeps: 0, comebacks: 0, closers: 0, maps: 0, otMaps: 0 },
  teams: {},
});

export const getSeriesOutcomes = versioned('series-outcomes-v2', getSeriesOutcomes_impl);

async function getSeriesOutcomes_impl(filters: {
  tour?: string;
  reg?: string[];
  dateFrom?: string;
  dateTo?: string;
}): Promise<SeriesOutcomesData> {
  let idQuery = supabase.from('draft').select('series_id, team, rival, bo');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);

  const { data: idList, error } = await idQuery;
  if (error || !idList || idList.length === 0) return emptySeriesOutcomes();

  // Team A is the side that opens the veto (draft.team), the same notion as the
  // orderA/orderB counters in lib/data/draft.ts.
  const teamAbySeries: Record<string, string> = {};
  const boBySeries: Record<string, number> = {};
  for (const s of idList as SeriesRow[]) {
    if (!s.team) continue;
    teamAbySeries[s.series_id] = s.team.trim();
    boBySeries[s.series_id] = Number(s.bo);
  }
  const seriesIds = Object.keys(teamAbySeries);

  const rounds = await fetchAllPages<OutcomeRound>((from, to) =>
    supabase
      .from('round_info')
      .select('series_id, map_id, map_order, round, teamA, teamB, rndA')
      .in('series_id', seriesIds)
      .range(from, to)
  );
  if (rounds.length === 0) return emptySeriesOutcomes();

  // Last round per map_id decides the map winner; the highest round number also
  // tells whether the map went to overtime.
  type MapAgg = { seriesId: string; order: number; lastRound: number; winner: string; teamA: string; teamB: string };
  const byMapId: Record<string, MapAgg> = {};
  for (const r of rounds) {
    if (!r.map_id) continue;
    const tA = r.teamA?.trim();
    const tB = r.teamB?.trim();
    if (!tA || !tB) continue;
    const round = Number(r.round);
    const prev = byMapId[r.map_id];
    if (prev && round <= prev.lastRound) continue;
    byMapId[r.map_id] = {
      seriesId: r.series_id,
      order: Number(r.map_order),
      lastRound: round,
      winner: Number(r.rndA) === 1 ? tA : tB,
      teamA: tA,
      teamB: tB,
    };
  }

  const bySeries: Record<string, MapAgg[]> = {};
  for (const m of Object.values(byMapId)) {
    (bySeries[m.seriesId] ??= []).push(m);
  }

  const global: SeriesOutcomeGlobal = { series: 0, teamAWins: 0, sweeps: 0, comebacks: 0, closers: 0, maps: 0, otMaps: 0 };
  const teams: Record<string, SeriesOutcomeStats> = {};
  const init = (t: string) => (teams[t] ??= {
    series: 0, wins: 0, asA: 0, asAWins: 0, asB: 0, asBWins: 0,
    sweeps: 0, down01: 0, down01Wins: 0, even11: 0, even11Wins: 0,
    maps: 0, otMaps: 0, otWins: 0,
  });

  for (const [seriesId, maps] of Object.entries(bySeries)) {
    maps.sort((a, b) => a.order - b.order);
    const [tA, tB] = [maps[0].teamA, maps[0].teamB];
    const winsA = maps.filter(m => m.winner === tA).length;
    const winsB = maps.length - winsA;

    // Overtime counts every resolved map of every format, Bo5 finals included.
    for (const m of maps) {
      const ot = m.lastRound > REGULATION_ROUNDS;
      global.maps++;
      if (ot) global.otMaps++;
      for (const t of [m.teamA, m.teamB]) {
        init(t).maps++;
        if (ot) {
          teams[t].otMaps++;
          if (m.winner === t) teams[t].otWins++;
        }
      }
    }

    // The series blocks below are Bo3-only. Skip other formats, and anything that
    // isn't a finished Bo3 (walkovers, partially scraped series).
    if (boBySeries[seriesId] !== 3) continue;
    if (maps.length < 2 || maps.length > 3 || Math.max(winsA, winsB) !== 2) continue;

    const winner = winsA === 2 ? tA : tB;
    const vetoTeamA = teamAbySeries[seriesId];

    global.series++;
    if (winner === vetoTeamA) global.teamAWins++;
    if (maps.length === 2) global.sweeps++;
    else if (maps[0].winner !== winner) global.comebacks++;
    else global.closers++;

    for (const t of [tA, tB]) {
      const s = init(t);
      const won = winner === t;
      s.series++;
      if (won) s.wins++;
      if (t === vetoTeamA) { s.asA++; if (won) s.asAWins++; }
      else                 { s.asB++; if (won) s.asBWins++; }

      // Exact partition: series === sweeps + down01 + even11
      if (maps[0].winner !== t) {
        s.down01++;
        if (won) s.down01Wins++;
      } else if (maps[1].winner !== t) {
        s.even11++;
        if (won) s.even11Wins++;
      } else {
        s.sweeps++;
      }
    }
  }

  return { global, teams };
}
