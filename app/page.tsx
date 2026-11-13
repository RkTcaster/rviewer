// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams, getTournamentRankings, getAllTours, getOverallCompositions, getAgentPickStats, getAgentNonMirrorMatches, getAgentCompMatches, getPlayerStats, getTournamentPlayerAvg, getPlayerTimeline, getMapImages, getOutOfRotationMaps, getAgentImages, getAgentRoles, getMapInfo, getLastUpdateDate, getEconomyDistribution, getEconomyCompare, getTournamentEconomy, getLongestMaps, getTopPlayerPerformances, getSkirmishStats, getSimulationScenarios, getTeamLogos, getTeamRegions, getMapsMastersStats, getNeonDependencyStats, getPostPistolForce, getVetoFlows, getTeamFormTimeline, getVetoModelRows, getSeriesOutcomes, emptySeriesOutcomes, getOperatorUseStats, getWeaponPickStats, getTimeSiteStats, getTournamentTree, getRelevantTeams, getRelevantTags, getPlayedTags, getTeamMaps, getTeamCompare, getTeamDashboard, getTeamSeriesIds, getTeamOptions, getAddableTeams, getTeamProfiling } from '@/lib/data-service';
import { DEFAULT_TOURS, MapInfoData, TeamRankStats, TeamMapsData, TeamCompareData, TeamProfilingData } from '@/lib/types';
import { getLatestNews } from '@/lib/news';
import { Filters } from '@/components/Filters';
import { TournamentTreeFilter } from '@/components/TournamentTreeFilter';
import { MetaShiftFilters } from '@/components/MetaShiftFilters';
import { TeamTreeControls, LastXSelect } from '@/components/TeamTreeControls';
import { CompareFilters } from '@/components/CompareFilters';
import { Sidebar } from '@/components/Sidebar';
import { ContentOverlay } from '@/components/ContentOverlay';
import { MapsSection } from '@/components/sections/MapsSection';
import { EconomySection } from '@/components/sections/EconomySection';
import { ChartsSection } from '@/components/sections/ChartsSection';
import { DraftSection } from '@/components/sections/DraftSection';
import { CompareSection } from '@/components/sections/CompareSection';
import { CompareStatsSection } from '@/components/sections/CompareStatsSection';
import { MapPicksSection } from '@/components/sections/MapPicksSection';
import { AgentPicksSection } from '@/components/sections/AgentPicksSection';
import { PlayerStatsSection } from '@/components/sections/PlayerStatsSection';
import { MetaShiftSection } from '@/components/sections/MetaShiftSection';
import { GraphsSection } from '@/components/sections/GraphsSection';
import { CompareEconomySection } from '@/components/sections/CompareEconomySection';
import { RelevantInfoSection } from '@/components/sections/RelevantInfoSection';
import { SkirmishSection } from '@/components/sections/SkirmishSection';
import { PlayoffPctSection } from '@/components/sections/PlayoffPctSection';
import { StatsRankSection } from '@/components/sections/StatsRankSection';
import { MapsMastersSection } from '@/components/sections/MapsMastersSection';
import { NeonDependencySection } from '@/components/sections/NeonDependencySection';
import { PostPistolForceSection } from '@/components/sections/PostPistolForceSection';
import { VetoSection } from '@/components/sections/VetoSection';
import { FormSection } from '@/components/sections/FormSection';
import { VetoPredictorSection } from '@/components/sections/VetoPredictorSection';
import { SeriesOutcomesSection } from '@/components/sections/SeriesOutcomesSection';
import { OperatorUseSection } from '@/components/sections/OperatorUseSection';
import { WeaponPickSection } from '@/components/sections/WeaponPickSection';
import { TimeSiteSection } from '@/components/sections/TimeSiteSection';
import { TeamProfilingSection } from '@/components/sections/TeamProfilingSection';
import type { Metadata } from 'next';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; team?: string; team2?: string }>;
}): Promise<Metadata> {
  const { section = 'compare-maps', team, team2 } = await searchParams;
  if ((section === 'compare-maps' || section === 'compare-stats' || section === 'compare-economy') && team && team2) {
    return { title: `${team} vs ${team2} VCT Data` };
  }
  return {};
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string; team?: string; tour?: string; bo?: string; last?: string; section?: string; team2?: string; tour2?: string; reg2?: string; dateFrom?: string; dateTo?: string; dateFrom2?: string; dateTo2?: string; excA?: string; excB?: string; allTeams?: string; teamId?: string; teamId2?: string; addTeams?: string }>;
}) {
  const params = await searchParams;
  const { reg, team, tour: tourParam, bo, last, section = 'compare-maps', team2, tour2: tour2Param, dateFrom, dateTo, dateFrom2, dateTo2, excA, excB, allTeams, teamId, teamId2, addTeams } = params;
  const regArr = reg ? reg.split(',').filter(Boolean) : undefined;
  // No `tour` param → DEFAULT_TOURS on the old filter. An empty `tour=` means all.
  const isCompareMaps = section === 'compare-maps';
  const isCompareStats = section === 'compare-stats';
  const isCompareEconomy = section === 'compare-economy';
  const isCompare = isCompareMaps || isCompareStats || isCompareEconomy;
  // Sections on the new main filter (ROADMAP Phase 12) read their own tournament tree; without a
  // `tour` param they start on the latest season
  const isStatsRank = section === 'stats-rank';
  const isNeonDependency = section === 'neon-dependency';
  const usesTreeFilter = isStatsRank || isNeonDependency || section === 'map-picks' || section === 'maps-masters' || section === 'agent-picks' || section === 'post-pistol-force' || section === 'meta-shift' || section === 'maps' || isCompare || section === 'series-outcomes' || section === 'operator-use' || section === 'weapon-pick' || section === 'time-site' || section === 'player-stats' || section === 'team-profiling';
  const tourTree = usesTreeFilter ? await getTournamentTree() : [];
  const latestYear = Math.max(...tourTree.map(t => t.year ?? 0));
  const v2DefaultTours = tourTree.filter(t => t.year === latestYear).map(t => t.tour_id).join(',');
  const tour = tourParam !== undefined ? tourParam : usesTreeFilter ? v2DefaultTours : DEFAULT_TOURS.join(',');
  const tour2 = tour2Param !== undefined ? tour2Param : usesTreeFilter ? v2DefaultTours : DEFAULT_TOURS.join(',');
  const hasTour = (tour?.split(',').filter(Boolean).length ?? 0) > 0;
  const excludeTeamsA = excA ? excA.split(',') : [];
  const excludeTeamsB = excB ? excB.split(',') : [];

  const isOverall = section === 'map-picks' || section === 'agent-picks';
  const isMetaShift = section === 'meta-shift';
  const isTeamMaps = section === 'maps';
  const isPlayerStats = section === 'player-stats';
  const isMapsMasters = section === 'maps-masters';
  const isPostPistolForce = section === 'post-pistol-force';
  const isEconomy = section === 'economy';
  const isRelevantInfo = section === 'relevant-info';
  const isSkirmish = section === 'skirmish-americas';
  const isPlayoffPct = section === 'playoff-pct';
  const isVetoPredictor = section === 'veto-predictor';
  const isSeriesOutcomes = section === 'series-outcomes';
  const isOperatorUse = section === 'operator-use';
  const isWeaponPick = section === 'weapon-pick';
  const isTimeSite = section === 'time-site';
  const isTeamProfiling = section === 'team-profiling';

  // Todas las consultas se construyen como promesas y se esperan juntas en un
  // solo Promise.all para evitar la cascada secuencial de awaits.

  // Team data (only for team sections)
  const resultP = (!isOverall && !isMetaShift && !isTeamMaps && !isPlayerStats && !isCompare && !isEconomy && !isRelevantInfo && !isSkirmish && !isPlayoffPct && !isStatsRank && !isMapsMasters && !isOperatorUse && !isWeaponPick && !isTimeSite && !isTeamProfiling && team)
    ? getMapStats({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve(null);


  // New filter: only teams marked relevant unless the Teams filter is on All. On Relevant only
  // their series are fetched (Stats Rank / Neon + Phoenix: same figures for them, far fewer qualifier series;
  // Map Info: the maps of the series a relevant team played)
  // relevantTeams: their tricodes among the teams of the selection, for the team lists (the stats
  // are keyed by tricode); v2Teams: their vlr ids, which pick the series. v2Teams waits for the
  // tricodes so the round 1 scan they share with the data functions runs once.
  // Operator Use, Weapon Pick, Time & Site and Team Profiling always work with the relevant teams
  // (too heavy for All)
  const relevantOnly = isOperatorUse || isWeaponPick || isTimeSite || isTeamProfiling;
  // extraTeams: vlr ids the visitor added to Relevant from the filter (URL `addTeams`); they count
  // as relevant everywhere below. addable: the teams that control offers, per side.
  const extraTeams = [...new Set((addTeams ?? '').split(',').filter(id => /^\d+$/.test(id)))].sort();
  const relevantTeamsP = (usesTreeFilter && (allTeams !== '1' || relevantOnly)) ? getRelevantTags(tour, extraTeams) : Promise.resolve(null);
  const v2Teams = relevantTeamsP.then(tags => tags ? getRelevantTeams() : null).then(t => t?.length ? [...new Set([...t, ...extraTeams])].sort() : undefined);
  // relTags: the teams marked relevant that played each side's tournaments, for the tooltip of
  // the Relevant chip (without the visitor's additions)
  const relTagsP = usesTreeFilter ? getRelevantTags(tour) : Promise.resolve([]);
  const relTags2P = (isMetaShift || isCompare) ? getRelevantTags(tour2) : Promise.resolve([]);
  const addableP = usesTreeFilter ? getAddableTeams(tour) : Promise.resolve([]);
  const addable2P = (isMetaShift || isCompare) ? getAddableTeams(tour2) : Promise.resolve([]);

  const rankingsP = (isStatsRank && hasTour)
    ? v2Teams.then(teams => getTournamentRankings({ tour, bo, dateFrom, dateTo, allSeries: true, teams }))
    : section === 'graphs'
    ? getTournamentRankings({ tour, reg: regArr, bo, last, dateFrom, dateTo })
    : Promise.resolve<Record<string, TeamRankStats>>({});

  const economyP = (isStatsRank && hasTour)
    ? v2Teams.then(teams => getTournamentEconomy({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve({});

  // Overall data (only for overall sections)
  const mapInfoP = (isOverall && hasTour)
    ? v2Teams.then(teams => getMapInfo({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve<MapInfoData>({ stats: [], series: 0, draftSeries: 0 });

  // Team → Maps: the team is a vlr id, resolved from `teamId` or, coming from a page that only
  // writes the tricode, from `team` (see getTeamOptions)
  const noTeamOptions = Promise.resolve({ options: [], selected: null });
  const teamOptionsP = (isTeamMaps || isPlayerStats || isCompare) ? getTeamOptions(tour, allTeams === '1', team, teamId, extraTeams) : noTeamOptions;
  // Compare pages: each side has its own tournaments, dates and team; Serie and Last X are shared
  const teamOptions2P = isCompare ? getTeamOptions(tour2, allTeams === '1', team2, teamId2, extraTeams) : noTeamOptions;
  const compareSide = (optionsP: typeof teamOptionsP, sideTour: string | undefined, from: string | undefined, to: string | undefined) =>
    isCompareMaps
      ? optionsP.then(({ selected }) => selected ? getTeamCompare({ teamId: selected.id, tour: sideTour, bo, dateFrom: from, dateTo: to, last }) : null)
      : Promise.resolve<TeamCompareData | null>(null);
  const compareAP = compareSide(teamOptionsP, tour, dateFrom, dateTo);
  const compareBP = compareSide(teamOptions2P, tour2, dateFrom2, dateTo2);
  // Compare Stats: the team's own figures come from its series (by id, with Last X); the ranks
  // compare them with every team of that side's selection, the same data as Stats Rank
  const statsSide = (optionsP: typeof teamOptionsP, sideTour: string | undefined, from: string | undefined, to: string | undefined) =>
    isCompareStats
      ? Promise.all([optionsP, v2Teams]).then(async ([{ selected }, teams]) => {
          if (!selected) return null;
          const [dash, own, universe] = await Promise.all([
            getTeamDashboard({ teamId: selected.id, tour: sideTour, bo, dateFrom: from, dateTo: to, last }),
            getTournamentRankings({ tour: sideTour, bo, dateFrom: from, dateTo: to, last, allSeries: true, teamId: selected.id }),
            getTournamentRankings({ tour: sideTour, bo, dateFrom: from, dateTo: to, allSeries: true, teams }),
          ]);
          const rankings = { ...universe };
          if (own[selected.tag]) rankings[selected.tag] = own[selected.tag]; else delete rankings[selected.tag];
          return { dash, rankings };
        })
      : Promise.resolve(null);
  const statsAP = statsSide(teamOptionsP, tour, dateFrom, dateTo);
  const statsBP = statsSide(teamOptions2P, tour2, dateFrom2, dateTo2);
  // Each compared team's latest match in its selected tournaments (header)
  const lastMatchOf = (optionsP: typeof teamOptionsP, sideTour: string | undefined) =>
    isCompare
      ? optionsP.then(async ({ selected }) => selected ? (await getTeamSeriesIds({ teamId: selected.id, tour: sideTour })).lastMatchDate : null)
      : Promise.resolve(null);
  const lastMatchAP = lastMatchOf(teamOptionsP, tour);
  const lastMatchBP = lastMatchOf(teamOptions2P, tour2);
  const teamMapsP = isTeamMaps
    ? teamOptionsP.then(({ selected }) => selected && hasTour ? getTeamMaps({ teamId: selected.id, tour, bo, dateFrom, dateTo, last }) : null)
    : Promise.resolve<TeamMapsData | null>(null);

  const agentPickStatsP = (section === 'agent-picks' && hasTour)
    ? v2Teams.then(teams => getAgentPickStats({ tour, bo, dateFrom, dateTo, allSeries: true, teams }))
    : Promise.resolve([]);

  const agentCompositionsP = (section === 'agent-picks' && hasTour)
    ? v2Teams.then(teams => getOverallCompositions({ tour, bo, dateFrom, dateTo, allSeries: true, teams }))
    : Promise.resolve([]);

  const agentMatchesP = (section === 'agent-picks' && hasTour)
    ? v2Teams.then(teams => getAgentNonMirrorMatches({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve([]);

  const agentCompMatchesP = (section === 'agent-picks' && hasTour)
    ? v2Teams.then(teams => getAgentCompMatches({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve([]);

  const mapImagesP = (section === 'agent-picks' || section === 'maps-masters' || isOperatorUse || isWeaponPick || isTimeSite || section === 'neon-dependency' || section === 'compare-maps' || section === 'maps' || isVetoPredictor)
    ? getMapImages()
    : Promise.resolve({});

  // Mapas fuera de rotación (default oculto en los filtros de mapas)
  const defaultHiddenMapsP = (section === 'maps' || section === 'compare-maps' || isMapsMasters || isNeonDependency || isOperatorUse || isWeaponPick || isTimeSite)
    ? getOutOfRotationMaps()
    : Promise.resolve<string[]>([]);

  const agentImagesP = (section === 'agent-picks' || section === 'maps' || section === 'compare-maps' || isMetaShift || isOperatorUse)
    ? getAgentImages()
    : Promise.resolve({});

  const agentRolesP = (section === 'agent-picks')
    ? getAgentRoles()
    : Promise.resolve({});

  const needsLogos = isStatsRank || isMapsMasters || isOperatorUse || isWeaponPick || isTimeSite || isTeamProfiling || isNeonDependency || isPostPistolForce || isMetaShift || isVetoPredictor || isSeriesOutcomes || section === 'compare-maps' || section === 'compare-stats' || isCompareEconomy;
  // Every section that renders Filters gets logos for its team selects
  const showsFilters = !isSkirmish && !isPlayoffPct && !isVetoPredictor && !usesTreeFilter;
  const teamLogosP = (needsLogos || showsFilters || isTeamMaps || isPlayerStats) ? getTeamLogos() : Promise.resolve({});
  // New filter: regions from the selected tournaments first (tricodes shared across qualifiers)
  const teamRegionsP = needsLogos ? getTeamRegions(usesTreeFilter ? (isMetaShift ? `${tour},${tour2}` : tour) : undefined) : Promise.resolve({});

  const mapsMastersP = (isMapsMasters && hasTour)
    ? v2Teams.then(teams => getMapsMastersStats({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve({ stats: {}, maps: [], series: 0, draftSeries: 0 });

  // Only the relevant teams' entries travel to the client (their rivals in those series don't)
  const operatorUseP = (isOperatorUse && hasTour)
    ? Promise.all([v2Teams, relevantTeamsP]).then(([teams, tags]) =>
        getOperatorUseStats({ tour, bo, dateFrom, dateTo, teams, keepTags: tags ?? [] }))
    : Promise.resolve({ byWeapon: null, maps: [] as string[], series: 0, buySeries: 0 });

  const weaponPickP = (isWeaponPick && hasTour)
    ? Promise.all([v2Teams, relevantTeamsP]).then(([teams, tags]) =>
        getWeaponPickStats({ tour, bo, dateFrom, dateTo, teams, keepTags: tags ?? [] }))
    : Promise.resolve({ stats: null, maps: [] as string[], series: 0, buySeries: 0 });

  const timeSiteP = (isTimeSite && hasTour)
    ? Promise.all([v2Teams, relevantTeamsP]).then(([teams, tags]) =>
        getTimeSiteStats({ tour, bo, dateFrom, dateTo, teams, keepTags: tags ?? [] }))
    : Promise.resolve({ stats: null, maps: [] as string[], series: 0, dataSeries: 0 });

  const teamProfilingP = (isTeamProfiling && hasTour)
    ? Promise.all([v2Teams, relevantTeamsP]).then(([teams, tags]) =>
        getTeamProfiling({ tour, bo, dateFrom, dateTo, teams, keepTags: tags ?? [] }))
    : Promise.resolve<TeamProfilingData>({ teams: {}, series: 0, buySeries: 0, roundDataSeries: 0 });

  // Series Outcomes is Bo3-only by definition, so it ignores the bo filter
  const seriesOutcomesP = (isSeriesOutcomes && hasTour)
    ? v2Teams.then(teams => getSeriesOutcomes({ tour, dateFrom, dateTo, teams }))
    : Promise.resolve(emptySeriesOutcomes());

  const neonDepP = (isNeonDependency && hasTour)
    ? v2Teams.then(teams => getNeonDependencyStats({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve({ stats: {}, maps: [] });

  const postPistolForceP = (isPostPistolForce && hasTour)
    ? v2Teams.then(teams => getPostPistolForce({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve({});

  // Meta Shift: one selection per side. A side with a team reads only that team's series (Relevant
  // doesn't apply); otherwise Relevant / All like Agent Picks, minus the excluded teams
  const metaSide = (sideTour: string | undefined, sideTeam: string | undefined, from: string | undefined, to: string | undefined, exclude: string[]) =>
    v2Teams.then(teams => getAgentPickStats({
      tour: sideTour, bo, dateFrom: from, dateTo: to, allSeries: true,
      ...(sideTeam ? { team: sideTeam } : { teams, excludeTeams: exclude.length > 0 ? exclude : undefined }),
    }));
  const agentPickStatsLeftP = isMetaShift ? metaSide(tour, team, dateFrom, dateTo, excludeTeamsA) : Promise.resolve([]);
  const agentPickStatsRightP = isMetaShift ? metaSide(tour2, team2, dateFrom2, dateTo2, excludeTeamsB) : Promise.resolve([]);
  // Team lists of each side: the teams of its tournaments (the relevant ones unless All teams)
  const sideTags = (sideTour: string | undefined) => allTeams === '1' ? getPlayedTags(sideTour) : getRelevantTags(sideTour, extraTeams);
  const metaTeamsP = isMetaShift ? Promise.all([sideTags(tour), sideTags(tour2)]) : Promise.resolve([[], []] as string[][]);

  // Player Stats: the team by vlr id (see getTeamOptions); the average follows Relevant / All
  const playerStatsP = isPlayerStats
    ? teamOptionsP.then(({ selected }) => selected ? getPlayerStats({ teamId: selected.id, tour, bo, dateFrom, dateTo }) : [])
    : Promise.resolve([]);

  const tournamentPlayerAvgP = (isPlayerStats && hasTour)
    ? v2Teams.then(teams => getTournamentPlayerAvg({ tour, bo, dateFrom, dateTo, teams }))
    : Promise.resolve(null);

  const playerTimelineP = isPlayerStats
    ? teamOptionsP.then(({ selected }) => selected ? getPlayerTimeline({ teamId: selected.id, tour, bo, last, dateFrom, dateTo }) : [])
    : Promise.resolve([]);
  const playerLastMatchP = isPlayerStats
    ? teamOptionsP.then(async ({ selected }) => selected ? (await getTeamSeriesIds({ teamId: selected.id, tour })).lastMatchDate : null)
    : Promise.resolve(null);


  const vetoFlowsP = (section === 'veto' && team)
    ? getVetoFlows({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve([]);

  const vetoModelP = (isVetoPredictor || section === 'compare-maps') ? getVetoModelRows() : Promise.resolve(null);

  const formTimelineP = (section === 'form' && team)
    ? getTeamFormTimeline({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve([]);

  // Compare Economy
  const econSide = (optionsP: typeof teamOptionsP, sideTour: string | undefined, from: string | undefined, to: string | undefined) =>
    isCompareEconomy
      ? optionsP.then(({ selected }) => selected ? getEconomyCompare({ teamId: selected.id, tour: sideTour, bo, dateFrom: from, dateTo: to, last }) : null)
      : Promise.resolve(null);
  const econCompareAP = econSide(teamOptionsP, tour, dateFrom, dateTo);
  const econCompareBP = econSide(teamOptions2P, tour2, dateFrom2, dateTo2);

  // Economy histogram bins
  const economyBinsP = isEconomy
    ? getEconomyDistribution({ reg: regArr, tour, team: team || undefined })
    : Promise.resolve([]);

  const longestMapsP = isRelevantInfo
    ? getLongestMaps({ reg: regArr, tour, team: team || undefined, bo, last })
    : Promise.resolve([]);

  const topPerformancesP = isRelevantInfo
    ? getTopPlayerPerformances({ reg: regArr, tour, team: team || undefined, bo, last })
    : Promise.resolve([]);

  const skirmishStatsP = isSkirmish ? getSkirmishStats() : Promise.resolve(null);

  const simulationScenariosP = isPlayoffPct ? getSimulationScenarios() : Promise.resolve([]);

  // Tours source differs by context
  const toursP = (isEconomy || isRelevantInfo) ? getAllTours(regArr)
    : getTours(team, regArr);

  const [
    result, compareA, compareB, statsA, statsB, lastMatchA, lastMatchB, teamOptions2, rankings, economy, mapInfo,
    teamOptions, teamMaps, agentPickStats, agentCompositions, agentMatches, agentCompMatches,
    mapImages, defaultHiddenMaps, agentImages, agentRoles, teamLogos, teamRegions, mapsMasters, neonDep, postPistolForce,
    agentPickStatsLeft, agentPickStatsRight,
    playerStats, tournamentPlayerAvg, playerTimeline, playerLastMatch,
    regions, teams, lastUpdateDate, news,
    econCompareA, econCompareB, economyBins, longestMaps, topPerformances,
    skirmishStats, simulationScenarios, tours, vetoFlows, formTimeline, vetoModel, seriesOutcomes, operatorUse, weaponPick, timeSite, teamProfiling, relevantTeams, metaTeams, addable, addable2, relTags, relTags2,
  ] = await Promise.all([
    resultP, compareAP, compareBP, statsAP, statsBP, lastMatchAP, lastMatchBP, teamOptions2P, rankingsP, economyP, mapInfoP,
    teamOptionsP, teamMapsP, agentPickStatsP, agentCompositionsP, agentMatchesP, agentCompMatchesP,
    mapImagesP, defaultHiddenMapsP, agentImagesP, agentRolesP, teamLogosP, teamRegionsP, mapsMastersP, neonDepP, postPistolForceP,
    agentPickStatsLeftP, agentPickStatsRightP,
    playerStatsP, tournamentPlayerAvgP, playerTimelineP, playerLastMatchP,
    getRegions(), getTeams(regArr), getLastUpdateDate(), getLatestNews(),
    econCompareAP, econCompareBP, economyBinsP, longestMapsP, topPerformancesP,
    skirmishStatsP, simulationScenariosP, toursP, vetoFlowsP, formTimelineP, vetoModelP, seriesOutcomesP, operatorUseP, weaponPickP, timeSiteP, teamProfilingP, relevantTeamsP, metaTeamsP, addableP, addable2P, relTagsP, relTags2P,
  ]);


  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const pab = result?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 };

  // Meta Shift labels each side by the regions of its tournaments; [] (every region) = "All regions"
  const allTreeRegions = new Set(tourTree.map(t => t.reg_id)).size;
  const sideRegions = (sideTour: string | undefined) => {
    const ids = new Set(sideTour?.split(','));
    const regs = [...new Set(tourTree.filter(t => ids.has(t.tour_id)).map(t => t.reg_id))];
    return regs.length === allTreeRegions ? [] : regs;
  };

  // Team → Maps: the team's latest match in the selected tournaments
  const lastMatch = isTeamMaps ? teamMaps?.lastMatchDate : isPlayerStats ? playerLastMatch : result?.lastMatchData;

  function renderSection() {
    switch (section) {
      case 'map-picks':
        return <MapPicksSection data={mapInfo} />;
      case 'agent-picks':
        return <AgentPicksSection stats={agentPickStats} compositions={agentCompositions} agentMatches={agentMatches} compMatches={agentCompMatches} mapImages={mapImages} agentImages={agentImages} agentRoles={agentRoles} mapInfo={mapInfo} />;
      case 'meta-shift':
        return <MetaShiftSection
          statsLeft={agentPickStatsLeft}
          statsRight={agentPickStatsRight}
          agentImages={agentImages}
          left={{ regIds: sideRegions(tour), team: team || undefined }}
          right={{ regIds: sideRegions(tour2), team: team2 || undefined }}
          teamRegions={teamRegions}
          teamLogos={teamLogos}
        />;
      case 'graphs':
        return (
          <GraphsSection
            pistols={pistols}
            antiEco={antiEco}
            recovery={recovery}
            pab={pab}
            stats={stats}
            rankStats={rankings[team || '']}
          />
        );
      case 'player-stats':
        return <PlayerStatsSection stats={playerStats} tournamentAvg={tournamentPlayerAvg} timeline={playerTimeline} />;
      case 'economy':
        return <EconomySection bins={economyBins} />;
      case 'compare-economy':
        return <CompareEconomySection statsA={econCompareA} statsB={econCompareB} teamAName={teamOptions.selected?.tag ?? ''} teamBName={teamOptions2.selected?.tag ?? ''} />;
      case 'relevant-info':
        return <RelevantInfoSection maps={longestMaps} performances={topPerformances} />;
      case 'skirmish-americas':
        return <SkirmishSection stats={skirmishStats!} />;
      case 'playoff-pct':
        return <PlayoffPctSection scenarios={simulationScenarios} />;
      case 'stats-rank':
        return <StatsRankSection rankings={rankings} economy={economy} teamLogos={teamLogos} teamRegions={teamRegions} hasTour={hasTour} fixedTeams={relevantTeams ?? Object.keys(rankings)} />;
      case 'maps-masters':
        return <MapsMastersSection stats={mapsMasters.stats} maps={mapsMasters.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} hasTour={hasTour} defaultHiddenMaps={defaultHiddenMaps} series={mapsMasters.series} draftSeries={mapsMasters.draftSeries} fixedTeams={relevantTeams ?? Object.keys(mapsMasters.stats)} />;
      case 'neon-dependency':
        return <NeonDependencySection stats={neonDep.stats} maps={neonDep.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} defaultHiddenMaps={defaultHiddenMaps} fixedTeams={relevantTeams ?? Object.keys(neonDep.stats)} />;
      case 'operator-use':
        return <OperatorUseSection byWeapon={operatorUse.byWeapon} maps={operatorUse.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} agentImages={agentImages} hasTour={hasTour} defaultHiddenMaps={defaultHiddenMaps} series={operatorUse.series} buySeries={operatorUse.buySeries} fixedTeams={relevantTeams ?? []} />;
      case 'weapon-pick':
        return <WeaponPickSection stats={weaponPick.stats} maps={weaponPick.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} hasTour={hasTour} defaultHiddenMaps={defaultHiddenMaps} series={weaponPick.series} buySeries={weaponPick.buySeries} fixedTeams={relevantTeams ?? []} />;
      case 'time-site':
        return <TimeSiteSection stats={timeSite.stats} maps={timeSite.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} hasTour={hasTour} defaultHiddenMaps={defaultHiddenMaps} series={timeSite.series} dataSeries={timeSite.dataSeries} fixedTeams={relevantTeams ?? []} />;
      case 'team-profiling':
        return <TeamProfilingSection data={teamProfiling} teamLogos={teamLogos} hasTour={hasTour} fixedTeams={relevantTeams ?? []} />;
      case 'post-pistol-force':
        return <PostPistolForceSection stats={postPistolForce} teamLogos={teamLogos} teamRegions={teamRegions} fixedTeams={relevantTeams ?? Object.keys(postPistolForce)} />;
      case 'veto':
        return <VetoSection flows={vetoFlows} teamName={team || ''} />;
      case 'veto-predictor':
        return <VetoPredictorSection model={vetoModel!} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} />;
      case 'series-outcomes':
        return <SeriesOutcomesSection data={seriesOutcomes} teamLogos={teamLogos} teamRegions={teamRegions} fixedTeams={relevantTeams ?? Object.keys(seriesOutcomes.teams)} />;
      case 'form':
        return <FormSection points={formTimeline} teamName={team || ''} />;
      case 'charts':
        return <ChartsSection stats={stats} />;
      case 'draft':
        return <DraftSection draftOrder={draftOrder} stats={stats} />;
      case 'compare-maps':
        return (
          <CompareSection
            key={`${teamOptions.selected?.id}|${teamOptions2.selected?.id}`}
            statsA={compareA?.mapStats ?? []}
            statsB={compareB?.mapStats ?? []}
            compsA={compareA?.comps ?? []}
            compsB={compareB?.comps ?? []}
            seriesA={compareA?.series ?? 0}
            seriesB={compareB?.series ?? 0}
            draftSeriesA={compareA?.draftSeries ?? 0}
            draftSeriesB={compareB?.draftSeries ?? 0}
            agentImages={agentImages}
            teamAName={teamOptions.selected?.tag ?? ''}
            teamBName={teamOptions2.selected?.tag ?? ''}
            teamLogos={teamLogos}
            mapImages={mapImages}
            defaultHiddenMaps={defaultHiddenMaps}
            draftOrderA={compareA?.draftOrder ?? { a: 0, b: 0 }}
            draftOrderB={compareB?.draftOrder ?? { a: 0, b: 0 }}
            // Only the veto tables travel to the client; the result_* ones are Veto Predictor's
            vetoModel={vetoModel && { teamMap: vetoModel.teamMap, maps: vetoModel.maps, coef: vetoModel.coef, meta: vetoModel.meta }}
          />
        );
      case 'compare-stats':
        return (
          <CompareStatsSection
            statsA={statsA?.dash.mapStats ?? []}
            statsB={statsB?.dash.mapStats ?? []}
            pistolsA={statsA?.dash.pistols ?? pistols}
            pistolsB={statsB?.dash.pistols ?? pistols}
            antiEcoA={statsA?.dash.antiEco ?? antiEco}
            antiEcoB={statsB?.dash.antiEco ?? antiEco}
            recoveryA={statsA?.dash.recovery ?? recovery}
            recoveryB={statsB?.dash.recovery ?? recovery}
            pabA={statsA?.dash.pab ?? pab}
            pabB={statsB?.dash.pab ?? pab}
            teamAName={teamOptions.selected?.tag ?? ''}
            teamBName={teamOptions2.selected?.tag ?? ''}
            rankingsA={statsA?.rankings ?? {}}
            rankingsB={statsB?.rankings ?? {}}
            teamLogos={teamLogos}
          />
        );
      default:
        return <MapsSection key={`${teamOptions.selected?.id}|${teamMaps?.series}`} stats={teamMaps?.mapStats ?? []} compositions={teamMaps?.compositions ?? []} agentImages={agentImages} mapImages={mapImages} defaultHiddenMaps={defaultHiddenMaps} series={teamMaps?.series ?? 0} draftSeries={teamMaps?.draftSeries ?? 0} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0f1115] text-gray-100">
      <Sidebar lastUpdateDate={lastUpdateDate} news={news} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="p-8 pb-0">
          <h1 className="text-4xl font-bold text-gray-100">{{
            'maps': 'Maps',
            'compare-maps': 'Compare Maps',
            'compare-stats': 'Compare Stats',
            'player-stats': 'Player Stats',
            'map-picks': 'Map picks & Side win rate',
            'agent-picks': 'Agent Picks',
            'meta-shift': 'Meta Shift',
            'graphs': 'Sankey',
            'economy': 'Economy',
            'compare-economy': 'Compare Economy',
            'veto': 'Veto Draft',
            'veto-predictor': 'Veto Predictor',
            'series-outcomes': 'Series Outcomes',
            'form': 'Form Timeline',
          'relevant-info': 'Relevant Info',
          'skirmish-americas': 'Skirmish VCT Americas Stage 1',
          'playoff-pct': 'Playoff % (Number of possible results, not probability)',
          'stats-rank': 'Stats Rank',
          'maps-masters': 'Maps Rank',
          'neon-dependency': 'Neon + Phoenix',
          'post-pistol-force': 'Post Pistol Force',
          'operator-use': 'Operator Use',
          'weapon-pick': 'Weapon Pick',
          'time-site': 'Time & Site',
          'team-profiling': 'Team Profiling',
          }[section] ?? section}</h1>
          {regArr && regArr.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/30 text-blue-400 border border-blue-800 uppercase tracking-widest mt-1">
              {regArr.map(r => regions.find(x => x.reg_id === r)?.region ?? r).join(', ')}
            </span>
          )}
          {isCompare ? (
            (lastMatchA || lastMatchB) && (
              <div className="flex flex-wrap gap-x-6 mt-1">
                {lastMatchA && (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {team} — Last match:{' '}
                    {new Date(lastMatchA).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {lastMatchB && (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {team2} — Last match:{' '}
                    {new Date(lastMatchB).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            )
          ) : (
            lastMatch && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Last team match date:{' '}
                {new Date(lastMatch).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )
          )}
          {isMetaShift && (
            <div className="mt-4">
              <MetaShiftFilters tree={tourTree} regions={regions} teamLogos={teamLogos}
                selectedA={tour?.split(',').filter(Boolean) ?? []} selectedB={tour2?.split(',').filter(Boolean) ?? []}
                teamsA={metaTeams[0]} teamsB={metaTeams[1]} addA={addable} addB={addable2} relevantA={relTags} relevantB={relTags2} />
            </div>
          )}
          {isCompare && (
            <div className="mt-4">
              <CompareFilters tree={tourTree} regions={regions} teamLogos={teamLogos}
                left={{ selected: tour?.split(',').filter(Boolean) ?? [], options: teamOptions.options, team: teamOptions.selected, add: addable, relevant: relTags }}
                right={{ selected: tour2?.split(',').filter(Boolean) ?? [], options: teamOptions2.options, team: teamOptions2.selected, add: addable2, relevant: relTags2 }} />
            </div>
          )}
          {usesTreeFilter && !isMetaShift && !isCompare && (
            <div className="mt-4">
              <TournamentTreeFilter tree={tourTree} regions={regions} selected={tour?.split(',').filter(Boolean) ?? []} topControls={(isTeamMaps || isPlayerStats) ? <LastXSelect /> : undefined} hideSerie={isSeriesOutcomes} hideTeams={relevantOnly} addTeams={addable} relevantTags={relTags}>
                {(isTeamMaps || isPlayerStats) && <TeamTreeControls options={teamOptions.options} selected={teamOptions.selected} teamLogos={teamLogos} />}
              </TournamentTreeFilter>
            </div>
          )}
          {showsFilters && (
            <div className="mt-4">
              <Filters
                regions={regions}
                teams={teams}
                tours={tours}
                teamLogos={teamLogos}
                mode={isOverall ? 'overall' : isEconomy ? 'economy' : 'team'}
              />
            </div>
          )}
        </header>

        <main className="relative p-8 pt-6">
          <ContentOverlay />
          {(isOverall || isMetaShift || isEconomy || isRelevantInfo || isSkirmish || isPlayoffPct || isVetoPredictor || isStatsRank || isMapsMasters || isNeonDependency || isPostPistolForce || isSeriesOutcomes || isOperatorUse || isWeaponPick || isTimeSite || isTeamProfiling) ? (
            renderSection()
          ) : ((isTeamMaps || isPlayerStats || isCompare) ? !teamOptions.selected : !team) ? (
            <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
              Choose a team to see the data...
            </div>
          ) : (
            renderSection()
          )}
        </main>
      </div>
    </div>
  );
}
