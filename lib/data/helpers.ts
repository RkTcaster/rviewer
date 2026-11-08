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

export async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) console.error('fetchAllPages error:', error);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// Torneos sin draft (qualifiers, match_format = 'reduced'): se excluyen de los filtros
// hasta que exista el toggle full/reduced (ROADMAP Phase 11). Si la query falla, set vacío.
export async function getReducedTourIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('tournament').select('tour_id').eq('match_format', 'reduced');
  if (error) console.error('getReducedTourIds error:', error);
  return new Set((data ?? []).map((r: { tour_id: string }) => r.tour_id));
}

// Series of the given tournaments taken from round_info instead of draft, so series without
// draft (qualifiers, match_format = 'reduced') count too. One row per map (round 1) gives both
// the date (first map) and the map count. bo = draft.bo when the series has a draft, else
// inferred from its maps: 4+ = Bo5. A 3-0 Bo5 without draft reads as Bo3 (none so far: every
// 2027 qualifier series has at most 3 maps). Dates compare by day, both ends inclusive.
export async function getAllSeriesIds(filters: {
  tour?: string; bo?: string; dateFrom?: string; dateTo?: string;
}): Promise<number[]> {
  const tours = filters.tour?.split(',').filter(Boolean) ?? [];
  if (tours.length === 0) return [];

  const [firstRounds, drafts] = await Promise.all([
    fetchAllPages<{ series_id: number; date: string | null }>((from, to) =>
      supabase.from('round_info').select('series_id, date')
        .in('tour_id', tours).eq('round', 1)
        .order('team_map_round_id').range(from, to)
    ),
    fetchAllPages<{ series_id: number; bo: number | string | null }>((from, to) =>
      supabase.from('draft').select('series_id, bo').in('tour_id', tours)
        .order('series_id').range(from, to)
    ),
  ]);

  const draftBo = new Map(drafts.map(d => [Number(d.series_id), Number(d.bo)]));
  const series = new Map<number, { maps: number; date: string }>();
  for (const r of firstRounds) {
    const id = Number(r.series_id);
    const day = r.date?.slice(0, 10) ?? '';
    const s = series.get(id);
    if (!s) series.set(id, { maps: 1, date: day });
    else { s.maps++; if (day && (!s.date || day < s.date)) s.date = day; }
  }

  const ids: number[] = [];
  for (const [id, s] of series) {
    const bo = draftBo.get(id) || (s.maps >= 4 ? 5 : 3);
    if (filters.bo && filters.bo !== 'all' && bo !== Number(filters.bo)) continue;
    if (filters.dateFrom && s.date < filters.dateFrom) continue;
    if (filters.dateTo && s.date > filters.dateTo) continue;
    ids.push(id);
  }
  return ids;
}

async function getLastUpdateDate_impl(): Promise<string | null> {
  const { data } = await supabase.from('draft').select('date').order('date', { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}
export const getLastUpdateDate = unstable_cache(getLastUpdateDate_impl, ['last-update-date'], { revalidate: 300 });
