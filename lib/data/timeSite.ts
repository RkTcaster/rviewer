// lib/data/timeSite.ts — Time & Site: plant times, plant sites and first-blood times per team
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { TimeSiteData, TimeSiteRound } from '../types';
import type { RoundSummaryRow } from './rows';

type TsRow = Pick<RoundSummaryRow, 'map_id' | 'team_a' | 'team_b' | 'side_team_a' | 'fb_team' | 'fb_t' | 'plant_t' | 'plant_site'>;

// Series picked from draft with the same filters as Operator Use, then every round of round_summary
// (pistols included). Each round gives one entry per team, on that team's side.
export const getTimeSiteStats = versioned('time-site-stats-v1', getTimeSiteStats_impl);
async function getTimeSiteStats_impl(
  filters: { tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string }
): Promise<TimeSiteData> {
  let idQuery = supabase.from('draft').select('series_id');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return { stats: {}, maps: [] };

  const seriesIds = [...new Set(idList.map(x => x.series_id))];
  // Ordered by the PK so the pages never overlap or skip rows
  const rows = await fetchAllPages<TsRow>((from, to) =>
    supabase.from('round_summary')
      .select('map_id, team_a, team_b, side_team_a, fb_team, fb_t, plant_t, plant_site')
      .in('series_id', seriesIds)
      .order('team_map_round_id')
      .range(from, to)
  );

  const stats: TimeSiteData['stats'] = {};
  const maps = new Set<string>();
  const num = (v: TsRow['fb_t']) => v == null || v === '' ? null : Number(v);
  for (const r of rows) {
    // map_id is "<series_id>-<Map>"
    const map = r.map_id?.slice(r.map_id.indexOf('-') + 1);
    if (!map) continue;
    maps.add(map);
    const plantT = num(r.plant_t);
    const fbT = num(r.fb_t);
    const site = plantT === null ? null : r.plant_site?.trim() || null;
    const fbTeam = r.fb_team?.trim() || null;
    for (const s of ['a', 'b'] as const) {
      const team = (s === 'a' ? r.team_a : r.team_b)?.trim();
      if (!team) continue;
      const atk = (r.side_team_a === 'atk') === (s === 'a');
      const entry: TimeSiteRound = { plantT, site, fbT, fbOwn: fbTeam === null || fbT === null ? null : fbTeam === team };
      ((stats[team] ??= {})[map] ??= { atk: [], def: [] })[atk ? 'atk' : 'def'].push(entry);
    }
  }

  return { stats, maps: [...maps].sort() };
}
