// lib/data/vetoModel.ts — snapshot of the veto predictor model (exported by the notebook)
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import type { TeamMapRow, MapRow, CoefRow, MetaRow } from '../vetoPredict';

export interface VetoModelRows { teamMap: TeamMapRow[]; maps: MapRow[]; coef: CoefRow[]; meta: MetaRow[] }

export const getVetoModelRows = versioned('veto-model', getVetoModelRows_impl);
async function getVetoModelRows_impl(): Promise<VetoModelRows> {
  const [teamMap, maps, coef, meta] = await Promise.all([
    // grows with teams × maps; paginate like any table that can pass 1000 rows
    fetchAllPages<TeamMapRow>((from, to) => supabase.from('veto_team_map').select('*').range(from, to)),
    supabase.from('veto_map').select('*').then(r => (r.data ?? []) as MapRow[]),
    supabase.from('veto_coef').select('*').then(r => (r.data ?? []) as CoefRow[]),
    supabase.from('veto_meta').select('*').then(r => (r.data ?? []) as MetaRow[]),
  ]);
  return { teamMap, maps, coef, meta };
}
