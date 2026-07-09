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
    const { data } = await buildQuery(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function getLastUpdateDate_impl(): Promise<string | null> {
  const { data } = await supabase.from('draft').select('date').order('date', { ascending: false }).limit(1);
  return data?.[0]?.date ?? null;
}
export const getLastUpdateDate = unstable_cache(getLastUpdateDate_impl, ['last-update-date'], { revalidate: 300 });
