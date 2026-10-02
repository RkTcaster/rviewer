// lib/data/vetoModel.ts — snapshot of the veto predictor model (exported by the notebook)
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import type { TeamMapRow, MapRow, CoefRow, MetaRow } from '../vetoPredict';
import type { ResultTeamRow, ResultTeamMapRow } from '../resultPredict';

export interface VetoModelRows {
  teamMap: TeamMapRow[]; maps: MapRow[]; coef: CoefRow[]; meta: MetaRow[];
  // win probability model (result_* tables), shown on the same page
  resultTeam: ResultTeamRow[]; resultTeamMap: ResultTeamMapRow[]; resultMeta: MetaRow[];
}

// v2: rows now include the result_* tables and the English veto columns
export const getVetoModelRows = versioned('veto-model-v2', getVetoModelRows_impl);
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
