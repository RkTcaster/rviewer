// lib/data/images.ts — assets e info estática (logos, imágenes, región por equipo)
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import fs from 'fs';
import path from 'path';
import { versioned, fetchAllPages } from './helpers';
import { getTeamKeys, keyOf } from './teamKeys';

export const getAgentImages = versioned('agent-images', getAgentImages_impl);
async function getAgentImages_impl(): Promise<Record<string, string>> {
  const { data } = await supabase.from('agent_info').select('agent_name, agent_path');
  if (!data) return {};
  return Object.fromEntries(
    data
      .filter((r: { agent_name: string; agent_path: string | null }) => r.agent_path)
      .map((r: { agent_name: string; agent_path: string }) => [r.agent_name, r.agent_path])
  );
}

export const getAgentRoles = versioned('agent-roles', getAgentRoles_impl);
async function getAgentRoles_impl(): Promise<Record<string, string>> {
  const { data } = await supabase.from('agent_info').select('agent_name, rol');
  if (!data) return {};
  return Object.fromEntries(
    data
      .filter((r: { agent_name: string; rol: string | null }) => r.rol)
      .map((r: { agent_name: string; rol: string }) => [r.agent_name, r.rol])
  );
}

// v3: by vlr team id, keyed like the stats (getTeamKeys). Home region = the regional tournaments
// of the selection (`tours`) first, else the region it played most (reg_4, international, ignored).
export const getTeamRegions = versioned('team-regions-v3', getTeamRegions_impl);
async function getTeamRegions_impl(tours?: string): Promise<Record<string, string>> {
  const [{ data }, keys] = await Promise.all([
    supabase.from('tournament_played').select('team_id_vlr, reg_id, tour_id'),
    getTeamKeys(),
  ]);
  if (!data) return {};
  const selected = tours ? new Set(tours.split(',')) : null;
  const counts: Record<string, Record<string, number>> = {};
  const inSelection: Record<string, Record<string, number>> = {};
  for (const r of data as { team_id_vlr: string; reg_id: string; tour_id: string }[]) {
    const team = keyOf(keys, r.team_id_vlr);
    if (!team || r.reg_id === 'reg_4') continue;
    (counts[team] ??= {})[r.reg_id] = (counts[team]?.[r.reg_id] ?? 0) + 1;
    if (selected?.has(r.tour_id)) (inSelection[team] ??= {})[r.reg_id] = (inSelection[team]?.[r.reg_id] ?? 0) + 1;
  }
  const result: Record<string, string> = {};
  for (const [team, regs] of [...Object.entries(counts), ...Object.entries(inSelection)]) {
    result[team] = Object.entries(regs).sort((a, b) => b[1] - a[1])[0][0];
  }
  return result;
}

// Subregion per team key, for the rows of the team chips (TeamChipsPanel). `teams.subregion`
// (filled by hand: league, Pacific and China teams play no qualifier) wins; otherwise the subregion
// of the qualifiers the team played, those of the selection (`tours`) first. A missing column (before
// the SQL of handoff/RVIEWER_TEAMS_SUBREGION.md runs) reads as empty. `teams` is edited by hand, so
// 5-minute cache like getTeamKeys; errors other than the missing column throw (not cached).
const getTeamSubregionsCached = unstable_cache(getTeamSubregions_impl, ['team-subregions-v1'], { revalidate: 300 });
export async function getTeamSubregions(tours?: string): Promise<Record<string, string>> {
  return getTeamSubregionsCached(tours);
}
async function getTeamSubregions_impl(tours?: string): Promise<Record<string, string>> {
  const [manual, played, tourRows, keys] = await Promise.all([
    supabase.from('teams').select('team_id_vlr, subregion'),
    fetchAllPages<{ team_id_vlr: string; tour_id: string }>((from, to) =>
      supabase.from('tournament_played').select('team_id_vlr, tour_id').order('tour_id').order('team_id_vlr').range(from, to), 1000, true),
    supabase.from('tournament').select('tour_id, subregion'),
    getTeamKeys(),
  ]);
  if (tourRows.error) throw tourRows.error;
  const tourSub = Object.fromEntries((tourRows.data as { tour_id: string; subregion: string | null }[]).map(t => [t.tour_id, t.subregion]));
  const selected = tours ? new Set(tours.split(',')) : null;
  const counts: Record<string, Record<string, number>> = {};
  const inSelection: Record<string, Record<string, number>> = {};
  for (const r of played) {
    const sub = tourSub[r.tour_id];
    const team = keyOf(keys, r.team_id_vlr);
    if (!sub || !team) continue;
    (counts[team] ??= {})[sub] = (counts[team]?.[sub] ?? 0) + 1;
    if (selected?.has(r.tour_id)) (inSelection[team] ??= {})[sub] = (inSelection[team]?.[sub] ?? 0) + 1;
  }
  const result: Record<string, string> = {};
  for (const [team, subs] of [...Object.entries(counts), ...Object.entries(inSelection)]) {
    result[team] = Object.entries(subs).sort((a, b) => b[1] - a[1])[0][0];
  }
  if (manual.error && manual.error.code !== '42703') throw manual.error;
  for (const r of (manual.error ? [] : manual.data) as { team_id_vlr: string; subregion: string | null }[]) {
    if (r.subregion?.trim()) result[keyOf(keys, r.team_id_vlr)!] = r.subregion.trim();
  }
  return result;
}

// v3: keyed like the stats (getTeamKeys). No file in public/ (qualifier teams without a logo) →
// default logo.
const DEFAULT_TEAM_LOGO = '/teams/default.png';
export const getTeamLogos = versioned('team-logos-v3', getTeamLogos_impl);
async function getTeamLogos_impl(): Promise<Record<string, string>> {
  const [{ data }, keys] = await Promise.all([supabase.from('teams').select('team_id_vlr, team_path'), getTeamKeys()]);
  if (!data) return {};
  const logos: Record<string, string> = {};
  for (const r of data as { team_id_vlr: string; team_path: string | null }[]) {
    const found = !!r.team_path && fs.existsSync(path.join(process.cwd(), 'public', r.team_path));
    logos[keyOf(keys, r.team_id_vlr)!] = found ? `/${r.team_path}` : DEFAULT_TEAM_LOGO;
  }
  return logos;
}

// Mapas fuera de rotación (in_rotation = false en maps_name_ids): defaults de los
// filtros de mapas. Cache propio con revalidate corto (no versioned) para que un
// cambio de rotación en el dashboard se refleje sin necesitar una carga de datos.
export const getOutOfRotationMaps = unstable_cache(getOutOfRotationMaps_impl, ['out-of-rotation-maps'], { revalidate: 300, tags: ['vct-data'] });
async function getOutOfRotationMaps_impl(): Promise<string[]> {
  const { data } = await supabase.from('maps_name_ids').select('map').eq('in_rotation', false);
  return (data ?? []).map((r: { map: string }) => r.map.toLowerCase());
}

export const getMapImages = versioned('map-images', getMapImages_impl);
async function getMapImages_impl(): Promise<Record<string, string>> {
  const { data } = await supabase.from('maps_name_ids').select('map, image_path');
  if (!data) return {};
  return Object.fromEntries(
    data.filter((r: { map: string; image_path: string | null }) => r.image_path).map((r: { map: string; image_path: string }) => [r.map, r.image_path])
  );
}
