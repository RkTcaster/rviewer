// lib/data/timeSite.ts — Time & Site: plant times, plant sites and first-blood times per team
import { supabase } from '../supabase';
import { versioned, fetchAllBySeries, getAllSeriesIds } from './helpers';
import { TimeSiteData, TimeSiteRound } from '../types';
import type { RoundSummaryRow } from './rows';
import { getTeamKeys, keyOf } from './teamKeys';

type TsRow = Pick<RoundSummaryRow, 'map_id' | 'team_a_id_vlr' | 'team_b_id_vlr' | 'side_team_a' | 'fb_team_id_vlr' | 'fb_t' | 'plant_t' | 'plant_site'>;

// Every round of round_summary (pistols included) of the selected series. Each round gives one
// entry per team, on that team's side.
// v2: new main filter (ROADMAP Phase 12): series from round_info (getAllSeriesIds), so qualifiers
// count; `teams` (Relevant) keeps the series those teams played and `keepTags` only their
// entries, dropped inside the cached function (see getOperatorUseStats); rows by series in
// chunks, strict. `series` / `dataSeries`: series selected and how many have round_summary rows.
// v3: teams by vlr id, keyed by getTeamKeys
export const getTimeSiteStats = versioned('time-site-stats-v3', getTimeSiteStats_impl);
async function getTimeSiteStats_impl(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[]; keepTags?: string[] }
): Promise<TimeSiteData> {
  const seriesIds = await getAllSeriesIds(filters);
  if (seriesIds.length === 0) return { stats: {}, maps: [], series: 0, dataSeries: 0 };

  // Ordered by the PK so the pages never overlap or skip rows
  const [rows, keys] = await Promise.all([fetchAllBySeries<TsRow>(seriesIds, (ids, from, to) =>
    supabase.from('round_summary')
      .select('map_id, team_a_id_vlr, team_b_id_vlr, side_team_a, fb_team_id_vlr, fb_t, plant_t, plant_site')
      .in('series_id', ids)
      .order('team_map_round_id')
      .range(from, to)
  ), getTeamKeys()]);

  const keep = filters.keepTags ? new Set(filters.keepTags) : null;
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
    const fbTeam = keyOf(keys, r.fb_team_id_vlr) ?? null;
    for (const s of ['a', 'b'] as const) {
      const team = keyOf(keys, s === 'a' ? r.team_a_id_vlr : r.team_b_id_vlr);
      if (!team || (keep && !keep.has(team))) continue;
      const atk = (r.side_team_a === 'atk') === (s === 'a');
      const entry: TimeSiteRound = { plantT, site, fbT, fbOwn: fbTeam === null || fbT === null ? null : fbTeam === team };
      ((stats[team] ??= {})[map] ??= { atk: [], def: [] })[atk ? 'atk' : 'def'].push(entry);
    }
  }

  const dataSeries = new Set(rows.map(r => r.map_id?.slice(0, r.map_id.indexOf('-')))).size;
  return { stats, maps: [...maps].sort(), series: seriesIds.length, dataSeries };
}
