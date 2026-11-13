// lib/data/teamProfiling.ts — Team Profiling (ROADMAP Phase 13): one raw figure per radar axis
import { getTournamentRankings } from './rankings';
import { getOperatorUseStats } from './economy';
import { getTimeSiteStats } from './timeSite';
import { getAgentCompMatches } from './agents';
import { TeamProfile, TeamProfilingData } from '../types';

// Reads the same cached functions as Stats Rank, Operator Use, Time & Site and Agent Picks (same
// arguments, so the caches are shared) and reduces them to a few numbers per team. Not cached
// itself: the inputs are, and the reduction is cheap. Only `keepTags` teams are returned.
export async function getTeamProfiling(
  filters: { tour?: string; bo?: string; dateFrom?: string; dateTo?: string; teams?: string[]; keepTags: string[] }
): Promise<TeamProfilingData> {
  const { tour, bo, dateFrom, dateTo, teams, keepTags } = filters;
  const [rankings, operator, timeSite, comps] = await Promise.all([
    getTournamentRankings({ tour, bo, dateFrom, dateTo, allSeries: true, teams }),
    getOperatorUseStats({ tour, bo, dateFrom, dateTo, teams, keepTags }),
    getTimeSiteStats({ tour, bo, dateFrom, dateTo, teams, keepTags }),
    getAgentCompMatches({ tour, bo, dateFrom, dateTo, teams }),
  ]);
  const keep = new Set(keepTags);

  // Meta: per map, each agent's share of the comps of every team shown (the "meta") and of each
  // team's own comps. Distance = ½ Σ |team − meta| / 5 (5 agents per comp): 0 = same picks,
  // 1 = nothing in common; a team's value is the average over its maps, weighted by maps played.
  const metaCount: Record<string, Record<string, number>> = {}; // map -> agent -> comps with it
  const metaMaps: Record<string, number> = {};                  // map -> comps
  const teamCount: Record<string, Record<string, Record<string, number>>> = {}; // team -> map -> agent
  const teamMaps: Record<string, Record<string, number>> = {};  // team -> map -> comps
  for (const c of comps) {
    const team = c.team?.trim();
    if (!team || !keep.has(team) || c.composition.length === 0) continue;
    metaMaps[c.map] = (metaMaps[c.map] ?? 0) + 1;
    (teamMaps[team] ??= {})[c.map] = (teamMaps[team][c.map] ?? 0) + 1;
    for (const agent of c.composition) {
      (metaCount[c.map] ??= {})[agent] = (metaCount[c.map][agent] ?? 0) + 1;
      ((teamCount[team] ??= {})[c.map] ??= {})[agent] = (teamCount[team][c.map][agent] ?? 0) + 1;
    }
  }
  const metaOf = (team: string): number | null => {
    const maps = teamMaps[team];
    if (!maps) return null;
    let sum = 0, n = 0;
    for (const [map, played] of Object.entries(maps)) {
      const agents = new Set([...Object.keys(metaCount[map]), ...Object.keys(teamCount[team][map])]);
      let diff = 0;
      for (const a of agents) diff += Math.abs((teamCount[team][map][a] ?? 0) / played - (metaCount[map][a] ?? 0) / metaMaps[map]);
      sum += (diff / 2 / 5) * played;
      n += played;
    }
    return sum / n;
  };

  const median = (ts: number[]) => {
    const s = [...ts].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const result: Record<string, TeamProfile> = {};
  for (const team of keepTags) {
    const r = rankings[team];
    const op = operator.byWeapon?.op.stats[team];
    const ts = timeSite.stats[team];
    if (!r && !op && !ts && !teamMaps[team]) continue; // didn't play the selection
    let opRounds = 0, eligible = 0;
    for (const m of Object.values(op ?? {})) for (const s of [m.atk, m.def]) { opRounds += s.op; eligible += s.eligible; }
    const plants = Object.values(ts ?? {}).flatMap(m => m.atk.map(x => x.plantT).filter((t): t is number => t !== null));
    result[team] = {
      atk: [r?.attWins ?? 0, r?.attTotal ?? 0],
      def: [r?.defWins ?? 0, r?.defTotal ?? 0],
      fk: [r?.fk ?? 0, (r?.fk ?? 0) + (r?.fd ?? 0)],
      op: [opRounds, eligible],
      plantMedian: plants.length ? median(plants) : null,
      plants: plants.length,
      meta: metaOf(team),
      metaMaps: Object.values(teamMaps[team] ?? {}).reduce((s, n) => s + n, 0),
    };
  }
  return {
    teams: result,
    series: operator.series,
    buySeries: operator.buySeries,
    roundDataSeries: timeSite.dataSeries,
  };
}
