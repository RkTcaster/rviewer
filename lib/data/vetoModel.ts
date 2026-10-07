// lib/data/vetoModel.ts — snapshot of the veto predictor model (exported by the notebook)
import { createHash } from 'crypto';
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import { fetchAllPages, getLastUpdateDate } from './helpers';
import type { TeamMapRow, MapRow, CoefRow, MetaRow } from '../vetoPredict';
import type { ResultTeamRow, ResultTeamMapRow } from '../resultPredict';

export interface VetoModelRows {
  teamMap: TeamMapRow[]; maps: MapRow[]; coef: CoefRow[]; meta: MetaRow[];
  // win probability model (result_* tables), shown on the same page
  resultTeam: ResultTeamRow[]; resultTeamMap: ResultTeamMapRow[]; resultMeta: MetaRow[];
}

// Fingerprint of the uploaded snapshot: hash of veto_meta + result_meta (snapshot date, hyper-
// parameters, test metrics), which change on every retrain. Uploading a new model does not touch
// `draft`, so getLastUpdateDate alone kept serving the old snapshot for up to 24 h. Cached 5 min
// like getLastUpdateDate, so a new upload shows up within 5 minutes.
async function getModelVersion_impl(): Promise<string> {
  const [veto, result] = await Promise.all([
    supabase.from('veto_meta').select('key, value'),
    supabase.from('result_meta').select('key, value'),
  ]);
  const rows = [...(veto.data ?? []).map(r => `veto:${r.key}=${r.value}`),
                ...(result.data ?? []).map(r => `result:${r.key}=${r.value}`)].sort();
  return createHash('sha1').update(rows.join('\n')).digest('hex').slice(0, 16);
}
const getModelVersion = unstable_cache(getModelVersion_impl, ['veto-model-version'], { revalidate: 300 });

// v3: cache key also includes the snapshot fingerprint (v2 keys only followed `draft`)
export async function getVetoModelRows(): Promise<VetoModelRows> {
  const [lastUpdate, model] = await Promise.all([getLastUpdateDate(), getModelVersion()]);
  return unstable_cache(getVetoModelRows_impl, ['veto-model-v3', lastUpdate ?? 'none', model],
    { revalidate: 86400, tags: ['vct-data'] })();
}
async function getVetoModelRows_impl(): Promise<VetoModelRows> {
  const [teamMap, maps, coef, meta, resultTeam, resultTeamMap, resultMeta] = await Promise.all([
    // grows with teams × maps; paginate like any table that can pass 1000 rows
    fetchAllPages<TeamMapRow>((from, to) => supabase.from('veto_team_map').select('*').range(from, to)),
    supabase.from('veto_map').select('*').then(r => (r.data ?? []) as MapRow[]),
    supabase.from('veto_coef').select('*').then(r => (r.data ?? []) as CoefRow[]),
    supabase.from('veto_meta').select('*').then(r => (r.data ?? []) as MetaRow[]),
    supabase.from('result_team').select('*').then(r => (r.data ?? []) as ResultTeamRow[]),
    fetchAllPages<ResultTeamMapRow>((from, to) => supabase.from('result_team_map').select('*').range(from, to)),
    supabase.from('result_meta').select('*').then(r => (r.data ?? []) as MetaRow[]),
  ]);
  return { teamMap, maps, coef, meta, resultTeam, resultTeamMap, resultMeta };
}
