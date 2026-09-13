// lib/data/economy.ts — economía por ronda (distribución, compare, torneo)
import { supabase } from '../supabase';
import { versioned, fetchAllPages } from './helpers';
import { EconomyBin, EconomyCategoryStats, TeamEconomyCompare, TeamPostPistolForce } from '../types';

export async function getEconomyDistribution(filters: {
  reg?: string[]; tour?: string; team?: string;
}): Promise<EconomyBin[]> {
  const { reg, tour, team } = filters;
  const BIN_COUNT = 50;
  const BIN_SIZE = 600; // 30000 / 50

  const emptyBins = (): EconomyBin[] =>
    Array.from({ length: BIN_COUNT }, (_, i) => ({ label: String(i * BIN_SIZE), count: 0, wins: 0 }));

  let draftQuery = supabase.from('draft').select('series_id');
  if (reg && reg.length > 0) draftQuery = draftQuery.in('reg_id', reg);
  if (tour) {
    const tourIds = tour.split(',').filter(Boolean);
    draftQuery = tourIds.length === 1
      ? draftQuery.eq('tour_id', tourIds[0])
      : draftQuery.in('tour_id', tourIds);
  }
  const { data: drafts } = await draftQuery;
  if (!drafts?.length) return emptyBins();
  const seriesIds = [...new Set(drafts.map((d: { series_id: string }) => d.series_id))];

  // Query 1: counts — no win_A, always succeeds
  const rows = await fetchAllPages<{ team_a: string; team_b: string; team_a_economy: number; team_b_economy: number; round: number }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const bins = emptyBins();
  for (const row of rows) {
    if (row.round === 1 || row.round === 13) continue;
    for (const { val, rowTeam } of [
      { val: row.team_a_economy, rowTeam: row.team_a },
      { val: row.team_b_economy, rowTeam: row.team_b },
    ]) {
      if (val == null || val < 0) continue;
      if (team && rowTeam !== team) continue;
      bins[Math.min(Math.floor(val / BIN_SIZE), BIN_COUNT - 1)].count++;
    }
  }

  // Query 2: wins — includes win_A; if column doesn't exist fetchAllPages returns [] gracefully
  const winRows = await fetchAllPages<{ team_a: string; team_b: string; team_a_economy: number; team_b_economy: number; win_A: number; round: number }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,win_A,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );
  for (const row of winRows) {
    if (row.round === 1 || row.round === 13) continue;
    for (const { val, rowTeam, won } of [
      { val: row.team_a_economy, rowTeam: row.team_a, won: row.win_A === 1 },
      { val: row.team_b_economy, rowTeam: row.team_b, won: row.win_A === 0 },
    ]) {
      if (val == null || val < 0) continue;
      if (team && rowTeam !== team) continue;
      if (won) bins[Math.min(Math.floor(val / BIN_SIZE), BIN_COUNT - 1)].wins++;
    }
  }

  return bins;
}

function classifyEconomy(val: number): keyof TeamEconomyCompare {
  if (val < 5000)  return 'eco';
  if (val < 15000) return 'semiEco';
  if (val < 20000) return 'semiBuy';
  return 'fullBuy';
}

const vsMap: Record<keyof TeamEconomyCompare, keyof EconomyCategoryStats> = {
  eco:     'vsEco',
  semiEco: 'vsSemiEco',
  semiBuy: 'vsSemiBuy',
  fullBuy: 'vsFullBuy',
};

function emptyMatchup() { return { played: 0, wins: 0 }; }
function emptyCategory(): EconomyCategoryStats {
  return { total: emptyMatchup(), vsEco: emptyMatchup(), vsSemiEco: emptyMatchup(), vsSemiBuy: emptyMatchup(), vsFullBuy: emptyMatchup() };
}
function emptyTeamEconomyCompare(): TeamEconomyCompare {
  return { eco: emptyCategory(), semiEco: emptyCategory(), semiBuy: emptyCategory(), fullBuy: emptyCategory() };
}

export async function getEconomyCompare(filters: {
  reg?: string[]; tour?: string; team?: string;
}): Promise<TeamEconomyCompare> {
  const { reg, tour, team } = filters;
  const stats = emptyTeamEconomyCompare();
  if (!team) return stats;

  let draftQuery = supabase.from('draft').select('series_id');
  if (reg && reg.length > 0) draftQuery = draftQuery.in('reg_id', reg);
  if (tour) {
    const tourIds = tour.split(',').filter(Boolean);
    draftQuery = tourIds.length === 1
      ? draftQuery.eq('tour_id', tourIds[0])
      : draftQuery.in('tour_id', tourIds);
  }
  const { data: drafts } = await draftQuery;
  if (!drafts?.length) return stats;
  const seriesIds = [...new Set(drafts.map((d: { series_id: string }) => d.series_id))];

  const rows = await fetchAllPages<{
    team_a: string; team_b: string;
    team_a_economy: number; team_b_economy: number;
    win_A: number; round: number;
  }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,win_A,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  for (const row of rows) {
    if (row.round === 1 || row.round === 13) continue;

    let teamEco: number, oppEco: number, won: boolean;
    if (row.team_a === team) {
      teamEco = row.team_a_economy; oppEco = row.team_b_economy; won = row.win_A === 1;
    } else if (row.team_b === team) {
      teamEco = row.team_b_economy; oppEco = row.team_a_economy; won = row.win_A === 0;
    } else continue;

    if (teamEco == null || oppEco == null) continue;

    const teamCat = classifyEconomy(teamEco);
    const oppCat  = classifyEconomy(oppEco);
    const vsKey   = vsMap[oppCat];

    stats[teamCat].total.played++;
    if (won) stats[teamCat].total.wins++;
    stats[teamCat][vsKey].played++;
    if (won) stats[teamCat][vsKey].wins++;
  }

  return stats;
}

export const getTournamentEconomy = versioned('tournament-economy', getTournamentEconomy_impl);
async function getTournamentEconomy_impl(filters: {
  tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string;
}): Promise<Record<string, TeamEconomyCompare>> {
  let idQuery = supabase.from('draft').select('series_id');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return {};
  const seriesIds = [...new Set(idList.map((x: { series_id: string }) => x.series_id))];

  const rows = await fetchAllPages<{
    team_a: string; team_b: string;
    team_a_economy: number; team_b_economy: number;
    win_A: number; round: number;
  }>((from, to) =>
    supabase
      .from('team_economy')
      .select('team_a,team_b,team_a_economy,team_b_economy,win_A,round')
      .in('series_id', seriesIds)
      .range(from, to)
  );

  const result: Record<string, TeamEconomyCompare> = {};
  const ensure = (team: string) => (result[team] ??= emptyTeamEconomyCompare());

  for (const row of rows) {
    if (row.round === 1 || row.round === 13) continue;
    if (row.team_a_economy == null || row.team_b_economy == null) continue;

    for (const { team, teamEco, oppEco, won } of [
      { team: row.team_a, teamEco: row.team_a_economy, oppEco: row.team_b_economy, won: row.win_A === 1 },
      { team: row.team_b, teamEco: row.team_b_economy, oppEco: row.team_a_economy, won: row.win_A === 0 },
    ]) {
      if (!team) continue;
      const teamCat = classifyEconomy(teamEco);
      const vsKey   = vsMap[classifyEconomy(oppEco)];
      const stats = ensure(team);
      stats[teamCat].total.played++;
      if (won) stats[teamCat].total.wins++;
      stats[teamCat][vsKey].played++;
      if (won) stats[teamCat][vsKey].wins++;
    }
  }

  return result;
}

// Post Pistol Force: the team that lost R1 / R13 "forces" the next round (R2 / R14) when it
// spends more than FORCE_SPEND or is left with less than FORCE_BANK. Everything comes from
// team_economy: its win_A / team_a match round_info's rndA / teamA row by row.
const FORCE_SPEND = 10000;
const FORCE_BANK = 1000;

export const getPostPistolForce = versioned('post-pistol-force-v3', getPostPistolForce_impl);
async function getPostPistolForce_impl(filters: {
  tour?: string; reg?: string[]; bo?: string; last?: string; dateFrom?: string; dateTo?: string;
}): Promise<Record<string, TeamPostPistolForce>> {
  let idQuery = supabase.from('draft').select('series_id');
  if (filters.tour) idQuery = idQuery.in('tour_id', filters.tour.split(','));
  if (filters.reg && filters.reg.length > 0) idQuery = idQuery.in('reg_id', filters.reg);
  if (filters.bo && filters.bo !== 'all') idQuery = idQuery.eq('bo', parseInt(filters.bo));
  if (filters.dateFrom) idQuery = idQuery.gte('date', filters.dateFrom);
  if (filters.dateTo)   idQuery = idQuery.lte('date', filters.dateTo);
  if (filters.last && filters.last !== 'all') idQuery = idQuery.order('date', { ascending: false }).limit(parseInt(filters.last));

  const { data: idList } = await idQuery;
  if (!idList || idList.length === 0) return {};
  const seriesIds = [...new Set(idList.map((x: { series_id: string }) => x.series_id))];

  type EcoRow = {
    map_id: string; round: number; team_a: string; team_b: string;
    team_a_economy: number; team_b_economy: number; team_a_bank: number; team_b_bank: number; win_A: number; winCon: string;
  };
  // Ordered by the PK so the pages never overlap or skip rows
  const rows = await fetchAllPages<EcoRow>((from, to) =>
    supabase
      .from('team_economy')
      .select('map_id,round,team_a,team_b,team_a_economy,team_b_economy,team_a_bank,team_b_bank,win_A,winCon')
      .in('series_id', seriesIds)
      .in('round', [1, 2, 3, 13, 14, 15])
      .order('team_map_round_id')
      .range(from, to)
  );

  const byMap: Record<string, Record<number, EcoRow>> = {};
  for (const r of rows) (byMap[r.map_id] ??= {})[Number(r.round)] = r;

  const result: Record<string, TeamPostPistolForce> = {};
  const empty = () => ({ losses: 0, forced: 0, forcedWins: 0, ecoWins: 0, postEcoTotal: 0, postEcoWins: 0 });

  for (const rounds of Object.values(byMap)) {
    for (const [pistolRound, nextRound, half] of [[1, 2, 'r2'], [13, 14, 'r14']] as const) {
      const pistol = rounds[pistolRound];
      const next = rounds[nextRound];
      // Both rounds must exist and keep the same team_a, otherwise the columns would be crossed
      if (!pistol || !next || pistol.team_a?.trim() !== next.team_a?.trim()) continue;

      const loserIsA = Number(pistol.win_A) === 0;
      const team = (loserIsA ? pistol.team_a : pistol.team_b)?.trim();
      const spend = loserIsA ? next.team_a_economy : next.team_b_economy;
      const bank = loserIsA ? next.team_a_bank : next.team_b_bank;
      if (!team || spend == null || bank == null) continue;

      const forced = Number(spend) > FORCE_SPEND || Number(bank) < FORCE_BANK;
      const won = (Number(next.win_A) === 1) === loserIsA;

      // Post eco: conversion of the round after the eco (R3 / R15), same team_a guard
      const after = rounds[nextRound + 1];
      const hasAfter = !!after && after.team_a?.trim() === pistol.team_a?.trim();
      const afterWon = hasAfter && (Number(after.win_A) === 1) === loserIsA;

      const t = (result[team] ??= { r2: empty(), r14: empty(), r2PostPlant: empty(), r14PostPlant: empty() });
      // Post plant: pistol lost by defuse, so the loser attacked and planted
      const targets = [t[half]];
      if (pistol.winCon?.trim().toLowerCase() === 'defus') targets.push(t[half === 'r2' ? 'r2PostPlant' : 'r14PostPlant']);
      for (const s of targets) {
        s.losses++;
        if (forced) { s.forced++; if (won) s.forcedWins++; }
        else {
          if (won) s.ecoWins++;
          if (hasAfter) { s.postEcoTotal++; if (afterWon) s.postEcoWins++; }
        }
      }
    }
  }

  return result;
}
