// lib/data/helpers.ts — helpers compartidos de la capa de datos
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';

// Envuelve una función de datos con unstable_cache, invalidando cuando cambia la
// última actualización (getLastUpdateDate, cacheada 5min). La key combina keyBase +
// versión + los argumentos serializados de la llamada. revalidate diario como red.
export function versioned<A extends unknown[], R>(
  keyBase: string,
  fn: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const version = (await getLastUpdateDate()) ?? 'none';
    return unstable_cache(fn, [keyBase, version], { revalidate: 86400, tags: ['vct-data'] })(...args);
  };
}

// A failed page is retried twice, after 1 s and 2 s (statement timeouts under load are transient,
// an immediate retry hits the same load). If it still fails, the rows read so far are returned,
// or with `strict` it throws, so a cut result never reaches unstable_cache.
export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
  strict = false
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    let { data, error } = await buildQuery(from, from + pageSize - 1);
    for (let retry = 1; error && retry <= 2; retry++) {
      await new Promise(r => setTimeout(r, retry * 1000));
      ({ data, error } = await buildQuery(from, from + pageSize - 1));
    }
    if (error) {
      // PostgrestError prints as {} in the dev overlay: log its message
      const message = (error as { message?: string }).message ?? String(error);
      if (strict) throw new Error(`fetchAllPages: ${message}`);
      console.error('fetchAllPages error:', message);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// fetchAllPages over a long series_id list, split in chunks run a few at a time. One query with
// hundreds of series (qualifiers) and deep offsets hits the anon statement timeout (~3 s, 57014).
// Pages of 10000 rows: Supabase's Max rows is raised to 10000 (nov 2026), and a 10000-row page of
// round_events takes ~0.5-0.9 s; round trips (~170 ms each) were most of the load time.
export async function fetchAllBySeries<T>(
  seriesIds: (string | number)[],
  buildQuery: (ids: (string | number)[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  chunkSize = 100,
  concurrency = 3
): Promise<T[]> {
  const chunks: (string | number)[][] = [];
  for (let i = 0; i < seriesIds.length; i += chunkSize) chunks.push(seriesIds.slice(i, i + chunkSize));
  const results: T[][] = new Array(chunks.length);
  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      results[i] = await fetchAllPages<T>((from, to) => buildQuery(chunks[i], from, to), 10000, true);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker));
  return results.flat();
}

// Torneos sin draft (qualifiers, match_format = 'reduced'): se excluyen de los filtros
// hasta que exista el toggle full/reduced (ROADMAP Phase 11). Si la query falla, set vacío.
export async function getReducedTourIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('tournament').select('tour_id').eq('match_format', 'reduced');
  if (error) console.error('getReducedTourIds error:', error);
  return new Set((data ?? []).map((r: { tour_id: string }) => r.tour_id));
}

// Reduced tournaments as a PostgREST list, for `.not('tour_id', 'in', …)` on every draft query
// that picks series: the NA open qualifier has draft in 72 of its series, and with a tricode shared
// by a league team (MIBR) a team's series by draft would mix both. Until 11.4 the draft-based
// sections stay league-only. ("") when there are none, so the filter is a no-op.
async function getReducedTourList_impl(): Promise<string> {
  const ids = [...await getReducedTourIds()];
  return `(${ids.map(id => `"${id}"`).join(',') || '""'})`;
}
export const getReducedTourList = unstable_cache(getReducedTourList_impl, ['reduced-tour-list'], { revalidate: 300 });

// Round 1 of every map of the given tournaments (sorted, comma separated), with both teams'
// tricode and vlr id. Cached, so getAllSeriesIds and getRelevantTags share one scan.
// Strict: a timeout (the scan takes ~2 s against the ~3 s anon limit) must throw, not return no
// rows, or callers cache an empty result. Pages of 10000 rows (Max rows, 12.4).
export type FirstRound = {
  series_id: number; date: string | null; teamA: string | null; teamB: string | null;
  team_a_id_vlr: string | null; team_b_id_vlr: string | null;
};
export const getFirstRounds = versioned('first-rounds-v1', (tours: string) =>
  fetchAllPages<FirstRound>((from, to) =>
    supabase.from('round_info').select('series_id, date, teamA, teamB, team_a_id_vlr, team_b_id_vlr')
      .in('tour_id', tours.split(',')).eq('round', 1)
      .order('team_map_round_id').range(from, to),
    10000, true
  )
);

// Series of the given tournaments taken from round_info instead of draft, so series without
// draft (qualifiers, match_format = 'reduced') count too. One row per map (round 1) gives both
// the date (first map) and the map count. bo = draft.bo when the series has a draft, else
// inferred from its maps: 4+ = Bo5. A 3-0 Bo5 without draft reads as Bo3 (none so far: every
// 2027 qualifier series has at most 3 maps). Dates compare by day, both ends inclusive.
// `teams` (Relevant): vlr team ids (teams.team_id_vlr); only series where at least one of them
// played. By id, not tricode, so a qualifier team sharing a league tricode (MIBR, 100T…) doesn't
// bring its series in. Their stats only depend on their own series, and qualifiers load far less.
export async function getAllSeriesIds(filters: {
  tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[];
}): Promise<number[]> {
  const tours = filters.tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];

  const [firstRounds, drafts] = await Promise.all([
    getFirstRounds([...tours].sort().join(',')),
    fetchAllPages<{ series_id: number; bo: number | string | null }>((from, to) =>
      supabase.from('draft').select('series_id, bo').in('tour_id', tours)
        .order('series_id').range(from, to),
      10000, true
    ),
  ]);

  const draftBo = new Map(drafts.map(d => [Number(d.series_id), Number(d.bo)]));
  const teams = filters.teams?.length ? new Set(filters.teams) : null;
  const withTeam = new Set<number>();
  const series = new Map<number, { maps: number; date: string }>();
  for (const r of firstRounds) {
    const id = Number(r.series_id);
    if (teams && (teams.has(r.team_a_id_vlr ?? '') || teams.has(r.team_b_id_vlr ?? ''))) withTeam.add(id);
    const day = r.date?.slice(0, 10) ?? '';
    const s = series.get(id);
    if (!s) series.set(id, { maps: 1, date: day });
    else { s.maps++; if (day && (!s.date || day < s.date)) s.date = day; }
  }

  const ids: number[] = [];
  for (const [id, s] of series) {
    if (teams && !withTeam.has(id)) continue;
    const bo = draftBo.get(id) || (s.maps >= 4 ? 5 : 3);
    if (filters.bo && filters.bo !== 'all' && bo !== Number(filters.bo)) continue;
    if (filters.dateFrom && s.date < filters.dateFrom) continue;
    if (filters.dateTo && s.date > filters.dateTo) continue;
    ids.push(id);
  }
  return ids;
}

// Team pages: the series one team (vlr id) played in the selection, newest first, cut to its last
// N with `last`. Also the date of each (first map), the tricode the team played it under (the
// tables without ids are matched by it inside the team's own series), the rival's tricode and
// `lastMatchDate`, its latest match in the selected tournaments whatever the other filters say.
export type TeamFilters = { teamId: string; tour?: string; bo?: string; dateFrom?: string; dateTo?: string; last?: string };
export async function getTeamSeriesIds(filters: TeamFilters) {
  const tours = filters.tour?.split(',').filter(Boolean) ?? [];
  const dateOf = new Map<number, string>();
  const tagOf = new Map<number, string>();
  const rivalOf = new Map<number, string>();
  let lastMatchDate: string | null = null;
  if (tours.length === 0) return { tours, seriesIds: [] as number[], dateOf, tagOf, rivalOf, lastMatchDate };

  const [firstRounds, filtered] = await Promise.all([
    getFirstRounds([...tours].sort().join(',')),
    getAllSeriesIds({ tour: filters.tour, bo: filters.bo, dateFrom: filters.dateFrom, dateTo: filters.dateTo, teams: [filters.teamId] }),
  ]);
  for (const r of firstRounds) {
    const isA = r.team_a_id_vlr === filters.teamId;
    if (!isA && r.team_b_id_vlr !== filters.teamId) continue;
    const id = Number(r.series_id);
    tagOf.set(id, ((isA ? r.teamA : r.teamB) ?? '').trim());
    rivalOf.set(id, ((isA ? r.teamB : r.teamA) ?? '').trim());
    if (!r.date) continue;
    if (!dateOf.has(id) || r.date < dateOf.get(id)!) dateOf.set(id, r.date);
    if (!lastMatchDate || r.date > lastMatchDate) lastMatchDate = r.date;
  }
  let seriesIds = [...filtered].sort((a, b) => (dateOf.get(b) ?? '').localeCompare(dateOf.get(a) ?? '') || b - a);
  if (filters.last && filters.last !== 'all') seriesIds = seriesIds.slice(0, parseInt(filters.last));
  return { tours, seriesIds, dateOf, tagOf, rivalOf, lastMatchDate };
}

// Keyed on round_info, not draft: qualifier uploads have no draft and wouldn't bust the cache (12.3)
async function getLastUpdateDate_impl(): Promise<string | null> {
  const { data } = await supabase.from('round_info').select('date').order('date', { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}
export const getLastUpdateDate = unstable_cache(getLastUpdateDate_impl, ['last-update-date'], { revalidate: 300 });
