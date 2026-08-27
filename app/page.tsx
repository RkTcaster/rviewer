// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams, getTournamentRankings, getAllTours, getOverallCompositions, getTeamMapCompositions, getAgentPickStats, getAgentNonMirrorMatches, getPlayerStats, getTournamentPlayerAvg, getPlayerTimeline, getMapImages, getOutOfRotationMaps, getAgentImages, getAgentRoles, getOverallMapFullStats, getLastUpdateDate, getEconomyDistribution, getEconomyCompare, getTournamentEconomy, getLongestMaps, getTopPlayerPerformances, getSkirmishStats, getSimulationScenarios, getTeamLogos, getTeamRegions, getMapsMastersStats, getNeonDependencyStats, getVetoFlows, getTeamFormTimeline } from '@/lib/data-service';
import { STATS_RANK_DEFAULT_TOURS, OverallMapFullStat, TeamRankStats } from '@/lib/types';
import { Filters } from '@/components/Filters';
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
import { VetoSection } from '@/components/sections/VetoSection';
import { FormSection } from '@/components/sections/FormSection';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string; team?: string; tour?: string; bo?: string; last?: string; section?: string; team2?: string; tour2?: string; reg2?: string; dateFrom?: string; dateTo?: string; dateFrom2?: string; dateTo2?: string; excA?: string; excB?: string }>;
}) {
  const params = await searchParams;
  const { reg, team, tour, bo, last, section = 'compare-maps', team2, tour2, reg2, dateFrom, dateTo, dateFrom2, dateTo2, excA, excB } = params;
  const regArr = reg ? reg.split(',').filter(Boolean) : undefined;
  const reg2Arr = reg2 ? reg2.split(',').filter(Boolean) : undefined;
  // Solo Neon + Phoenix conserva la selección de torneos por defecto
  const effectiveTour = (section === 'neon-dependency' && tour === undefined)
    ? STATS_RANK_DEFAULT_TOURS.join(',')
    : tour;
  // Stats Rank y Maps Masters arrancan sin torneo: sin torneo no se consulta nada
  const hasTour = (tour?.split(',').filter(Boolean).length ?? 0) > 0;
  const excludeTeamsA = excA ? excA.split(',') : [];
  const excludeTeamsB = excB ? excB.split(',') : [];

  const isOverall = section === 'map-picks' || section === 'agent-picks';
  const isCompare = section === 'compare-maps' || section === 'compare-stats' || section === 'compare-economy';
  const isMetaShift = section === 'meta-shift';
  const isStatsRank = section === 'stats-rank';
  const isMapsMasters = section === 'maps-masters';
  const isNeonDependency = section === 'neon-dependency';
  const isEconomy = section === 'economy';
  const isCompareEconomy = section === 'compare-economy';
  const isRelevantInfo = section === 'relevant-info';
  const isSkirmish = section === 'skirmish-americas';
  const isPlayoffPct = section === 'playoff-pct';

  // Todas las consultas se construyen como promesas y se esperan juntas en un
  // solo Promise.all para evitar la cascada secuencial de awaits.

  // Team data (only for team sections)
  const resultP = (!isOverall && !isMetaShift && !isEconomy && !isRelevantInfo && !isSkirmish && !isPlayoffPct && !isStatsRank && !isMapsMasters && team)
    ? getMapStats({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve(null);

  const resultBP = (isCompare && team2)
    ? getMapStats({ team: team2, tour: tour2, bo, reg: regArr, last, dateFrom: dateFrom2, dateTo: dateTo2 })
    : Promise.resolve(null);

  const compsAP = (section === 'compare-maps' && team)
    ? getTeamMapCompositions({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve([]);
  const compsBP = (section === 'compare-maps' && team2)
    ? getTeamMapCompositions({ team: team2, tour: tour2, bo, reg: regArr, last, dateFrom: dateFrom2, dateTo: dateTo2 })
    : Promise.resolve([]);

  const rankingsP = (section === 'compare-stats' || section === 'graphs' || (isStatsRank && hasTour))
    ? getTournamentRankings({ tour: effectiveTour, reg: regArr, bo, last, dateFrom, dateTo })
    : Promise.resolve<Record<string, TeamRankStats>>({});

  const economyP = (isStatsRank && hasTour)
    ? getTournamentEconomy({ tour: effectiveTour, reg: regArr, bo, last, dateFrom, dateTo })
    : Promise.resolve({});

  // Overall data (only for overall sections)
  const mapPicksFullStatsP = (section === 'map-picks')
    ? getOverallMapFullStats({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve<Record<string, OverallMapFullStat>>({});

  const compositionsDataP = (section === 'maps' && team)
    ? getOverallCompositions({ team, reg: regArr, tour, bo, last, dateFrom, dateTo })
    : Promise.resolve([]);

  const agentPickStatsP = (section === 'agent-picks')
    ? getAgentPickStats({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve([]);

  const agentCompositionsP = (section === 'agent-picks')
    ? getOverallCompositions({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve([]);

  const agentMatchesP = (section === 'agent-picks')
    ? getAgentNonMirrorMatches({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve([]);

  const mapImagesP = (section === 'agent-picks' || section === 'maps-masters' || section === 'neon-dependency' || section === 'compare-maps' || section === 'maps')
    ? getMapImages()
    : Promise.resolve({});

  // Mapas fuera de rotación (default oculto en los filtros de mapas)
  const defaultHiddenMapsP = (section === 'maps' || section === 'compare-maps' || isMapsMasters || isNeonDependency)
    ? getOutOfRotationMaps()
    : Promise.resolve<string[]>([]);

  const agentImagesP = (section === 'agent-picks' || section === 'maps' || section === 'compare-maps' || isMetaShift)
    ? getAgentImages()
    : Promise.resolve({});

  const agentRolesP = (section === 'agent-picks')
    ? getAgentRoles()
    : Promise.resolve({});

  const needsLogos = isStatsRank || isMapsMasters || isNeonDependency || section === 'compare-maps' || section === 'compare-stats';
  const teamLogosP = needsLogos ? getTeamLogos() : Promise.resolve({});
  const teamRegionsP = needsLogos ? getTeamRegions() : Promise.resolve({});

  const mapsMastersP = (isMapsMasters && hasTour)
    ? getMapsMastersStats({ tour: effectiveTour, reg: regArr, bo, last, dateFrom, dateTo })
    : Promise.resolve({ stats: {}, maps: [] });

  const neonDepP = isNeonDependency
    ? getNeonDependencyStats({ tour: effectiveTour, reg: regArr, bo, last, dateFrom, dateTo })
    : Promise.resolve({ stats: {}, maps: [] });

  const mapFullStatsP = (section === 'agent-picks')
    ? getOverallMapFullStats({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve({});

  const agentPickStatsLeftP = isMetaShift
    ? getAgentPickStats({ reg: regArr, tour, team: team || undefined, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : Promise.resolve([]);

  const agentPickStatsRightP = isMetaShift
    ? getAgentPickStats({ reg: reg2Arr, tour: tour2, team: team2 || undefined, dateFrom: dateFrom2, dateTo: dateTo2, excludeTeams: excludeTeamsB.length > 0 ? excludeTeamsB : undefined })
    : Promise.resolve([]);

  const playerStatsP = (section === 'player-stats' && team)
    ? getPlayerStats({ team, reg: regArr, tour, bo, dateFrom, dateTo })
    : Promise.resolve([]);

  const tournamentPlayerAvgP = (section === 'player-stats')
    ? getTournamentPlayerAvg({ reg: regArr, tour, bo, dateFrom, dateTo })
    : Promise.resolve(null);

  const playerTimelineP = (section === 'player-stats' && team)
    ? getPlayerTimeline({ team, reg: regArr, tour, bo, last, dateFrom, dateTo })
    : Promise.resolve([]);

  const teams2P = isMetaShift ? getTeams(reg2Arr) : Promise.resolve([]);

  const vetoFlowsP = (section === 'veto' && team)
    ? getVetoFlows({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve([]);

  const formTimelineP = (section === 'form' && team)
    ? getTeamFormTimeline({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : Promise.resolve([]);

  // Compare Economy
  const econCompareAP = isCompareEconomy && team
    ? getEconomyCompare({ reg: regArr, tour, team })
    : Promise.resolve(null);
  const econCompareBP = isCompareEconomy && team2
    ? getEconomyCompare({ reg: regArr, tour: tour2, team: team2 })
    : Promise.resolve(null);

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
  const toursP = (isOverall || isMetaShift || isEconomy || isRelevantInfo || isStatsRank || isMapsMasters || isNeonDependency) ? getAllTours(regArr) : getTours(team, regArr);
  const tours2P = isCompare
    ? getTours(team2, regArr)
    : isMetaShift
      ? (team2 ? getTours(team2, reg2Arr) : getAllTours(reg2Arr))
      : Promise.resolve([]);

  const [
    result, resultB, compsA, compsB, rankings, economy, mapPicksFullStatsRaw,
    compositionsData, agentPickStats, agentCompositions, agentMatches,
    mapImages, defaultHiddenMaps, agentImages, agentRoles, teamLogos, teamRegions, mapsMasters, neonDep,
    mapFullStats, agentPickStatsLeft, agentPickStatsRight,
    playerStats, tournamentPlayerAvg, playerTimeline,
    regions, teams, lastUpdateDate, teams2,
    econCompareA, econCompareB, economyBins, longestMaps, topPerformances,
    skirmishStats, simulationScenarios, tours, tours2, vetoFlows, formTimeline,
  ] = await Promise.all([
    resultP, resultBP, compsAP, compsBP, rankingsP, economyP, mapPicksFullStatsP,
    compositionsDataP, agentPickStatsP, agentCompositionsP, agentMatchesP,
    mapImagesP, defaultHiddenMapsP, agentImagesP, agentRolesP, teamLogosP, teamRegionsP, mapsMastersP, neonDepP,
    mapFullStatsP, agentPickStatsLeftP, agentPickStatsRightP,
    playerStatsP, tournamentPlayerAvgP, playerTimelineP,
    getRegions(), getTeams(regArr), getLastUpdateDate(), teams2P,
    econCompareAP, econCompareBP, economyBinsP, longestMapsP, topPerformancesP,
    skirmishStatsP, simulationScenariosP, toursP, tours2P, vetoFlowsP, formTimelineP,
  ]);

  const mapPicksFullStats = Object.values(mapPicksFullStatsRaw).sort((a, b) => b.picks - a.picks);

  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const pab = result?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 };

  function renderSection() {
    switch (section) {
      case 'map-picks':
        return <MapPicksSection stats={mapPicksFullStats} />;
      case 'agent-picks':
        return <AgentPicksSection stats={agentPickStats} compositions={agentCompositions} agentMatches={agentMatches} mapImages={mapImages} agentImages={agentImages} agentRoles={agentRoles} mapFullStats={mapFullStats} />;
      case 'meta-shift':
        return <MetaShiftSection statsLeft={agentPickStatsLeft} statsRight={agentPickStatsRight} agentImages={agentImages} />;
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
        return <CompareEconomySection statsA={econCompareA} statsB={econCompareB} teamAName={team || ''} teamBName={team2 || ''} />;
      case 'relevant-info':
        return <RelevantInfoSection maps={longestMaps} performances={topPerformances} />;
      case 'skirmish-americas':
        return <SkirmishSection stats={skirmishStats!} />;
      case 'playoff-pct':
        return <PlayoffPctSection scenarios={simulationScenarios} />;
      case 'stats-rank':
        return <StatsRankSection rankings={rankings} economy={economy} teamLogos={teamLogos} teamRegions={teamRegions} hasTour={hasTour} />;
      case 'maps-masters':
        return <MapsMastersSection stats={mapsMasters.stats} maps={mapsMasters.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} hasTour={hasTour} defaultHiddenMaps={defaultHiddenMaps} />;
      case 'neon-dependency':
        return <NeonDependencySection stats={neonDep.stats} maps={neonDep.maps} teamLogos={teamLogos} teamRegions={teamRegions} mapImages={mapImages} defaultHiddenMaps={defaultHiddenMaps} />;
      case 'veto':
        return <VetoSection flows={vetoFlows} teamName={team || ''} />;
      case 'form':
        return <FormSection points={formTimeline} teamName={team || ''} />;
      case 'charts':
        return <ChartsSection stats={stats} />;
      case 'draft':
        return <DraftSection draftOrder={draftOrder} stats={stats} />;
      case 'compare-maps':
        return (
          <CompareSection
            statsA={stats}
            statsB={resultB?.mapStats || []}
            compsA={compsA}
            compsB={compsB}
            agentImages={agentImages}
            teamAName={team || ''}
            teamBName={team2 || ''}
            teamLogos={teamLogos}
            mapImages={mapImages}
            defaultHiddenMaps={defaultHiddenMaps}
            draftOrderA={draftOrder}
            draftOrderB={resultB?.draftOrder || { a: 0, b: 0 }}
          />
        );
      case 'compare-stats':
        return (
          <CompareStatsSection
            statsA={stats}
            statsB={resultB?.mapStats || []}
            pistolsA={pistols}
            pistolsB={resultB?.pistols || { wins: 0, total: 0 }}
            antiEcoA={antiEco}
            antiEcoB={resultB?.antiEco || { wins: 0, total: 0 }}
            recoveryA={recovery}
            recoveryB={resultB?.recovery || { wins: 0, total: 0 }}
            pabA={pab}
            pabB={resultB?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 }}
            teamAName={team || ''}
            teamBName={team2 || ''}
            rankings={rankings}
            teamLogos={teamLogos}
          />
        );
      default:
        return <MapsSection stats={stats} compositions={compositionsData} agentImages={agentImages} mapImages={mapImages} defaultHiddenMaps={defaultHiddenMaps} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0f1115] text-gray-100">
      <Sidebar lastUpdateDate={lastUpdateDate} />
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
            'form': 'Form Timeline',
          'relevant-info': 'Relevant Info',
          'skirmish-americas': 'Skirmish VCT Americas Stage 1',
          'playoff-pct': 'Playoff % (Number of possible results, not probability)',
          'stats-rank': 'Stats Rank',
          'maps-masters': 'Maps Masters',
          'neon-dependency': 'Neon + Phoenix',
          }[section] ?? section}</h1>
          {regArr && regArr.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/30 text-blue-400 border border-blue-800 uppercase tracking-widest mt-1">
              {regArr.map(r => regions.find(x => x.reg_id === r)?.region ?? r).join(', ')}
            </span>
          )}
          {isCompare ? (
            (result?.lastMatchData || resultB?.lastMatchData) && (
              <div className="flex flex-wrap gap-x-6 mt-1">
                {result?.lastMatchData && (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {team} — Last match:{' '}
                    {new Date(result.lastMatchData).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {resultB?.lastMatchData && (
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {team2} — Last match:{' '}
                    {new Date(resultB.lastMatchData).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            )
          ) : (
            result?.lastMatchData && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
                Last team match date:{' '}
                {new Date(result.lastMatchData).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )
          )}
          {!isSkirmish && !isPlayoffPct && (
            <div className="mt-4">
              <Filters
                regions={regions}
                teams={teams}
                tours={tours}
                tours2={tours2}
                teams2={teams2}
                mode={isOverall ? 'overall' : isMetaShift ? 'meta-shift' : isEconomy ? 'economy' : (isStatsRank || isMapsMasters || isNeonDependency) ? 'stats-rank' : 'team'}
              />
            </div>
          )}
        </header>

        <main className="relative p-8 pt-6">
          <ContentOverlay />
          {(isOverall || isMetaShift || isEconomy || isRelevantInfo || isSkirmish || isPlayoffPct || isStatsRank || isMapsMasters || isNeonDependency) ? (
            renderSection()
          ) : !team ? (
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
