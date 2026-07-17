// lib/data/images.ts — assets e info estática (logos, imágenes, región por equipo)
import { unstable_cache } from 'next/cache';
import { supabase } from '../supabase';
import { versioned } from './helpers';

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

export const getTeamRegions = versioned('team-regions', getTeamRegions_impl);
async function getTeamRegions_impl(): Promise<Record<string, string>> {
  // Map each team to its home region (reg_0..reg_3), ignoring reg_4 (international events).
  // If a team appears in multiple regions, the most frequent one wins.
  const { data } = await supabase.from('tournament_played').select('teamA, reg_id');
  if (!data) return {};
  const counts: Record<string, Record<string, number>> = {};
  for (const r of data as { teamA: string; reg_id: string }[]) {
    if (!r.teamA || r.reg_id === 'reg_4') continue;
    (counts[r.teamA] ??= {})[r.reg_id] = (counts[r.teamA]?.[r.reg_id] ?? 0) + 1;
  }
  const result: Record<string, string> = {};
  for (const [team, regs] of Object.entries(counts)) {
    result[team] = Object.entries(regs).sort((a, b) => b[1] - a[1])[0][0];
  }
  return result;
}

export const getTeamLogos = versioned('team-logos', getTeamLogos_impl);
async function getTeamLogos_impl(): Promise<Record<string, string>> {
  const { data } = await supabase.from('teams').select('team_id, team_path');
  if (!data) return {};
  return Object.fromEntries(
    data
      .filter((r: { team_id: string; team_path: string | null }) => r.team_path)
      .map((r: { team_id: string; team_path: string }) => [r.team_id, `/${r.team_path}`])
  );
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
