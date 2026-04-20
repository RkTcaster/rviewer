// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams, getTournamentRankings, getAllTours, getOverallMapPicks, getOverallCompositions, getAgentPickStats, getPlayerStats, getTournamentPlayerAvg, getPlayerTimeline, getMapImages, getAgentImages, getOverallMapFullStats, getLastUpdateDate, getEconomyDistribution, getEconomyCompare, getLongestMaps, getTopPlayerPerformances, getSkirmishStats } from '@/lib/data-service';
import { Filters } from '@/components/Filters';
import { Sidebar } from '@/components/Sidebar';
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string; team?: string; tour?: string; bo?: string; last?: string; section?: string; team2?: string; tour2?: string; reg2?: string; dateFrom?: string; dateTo?: string; dateFrom2?: string; dateTo2?: string; excA?: string; excB?: string }>;
}) {
  const params = await searchParams;
  const { reg, team, tour, bo, last, section = 'maps', team2, tour2, reg2, dateFrom, dateTo, dateFrom2, dateTo2, excA, excB } = params;
  const regArr = reg ? reg.split(',').filter(Boolean) : undefined;
  const reg2Arr = reg2 ? reg2.split(',').filter(Boolean) : undefined;
  const excludeTeamsA = excA ? excA.split(',') : [];
  const excludeTeamsB = excB ? excB.split(',') : [];

  const isOverall = section === 'map-picks' || section === 'agent-picks';
  const isCompare = section === 'compare-maps' || section === 'compare-stats' || section === 'compare-economy';
  const isMetaShift = section === 'meta-shift';
  const isEconomy = section === 'economy';
  const isCompareEconomy = section === 'compare-economy';
  const isRelevantInfo = section === 'relevant-info';
  const isSkirmish = section === 'skirmish-americas';

  // Team data (only for team sections)
  const result = (!isOverall && !isMetaShift && !isEconomy && !isRelevantInfo && !isSkirmish && team)
    ? await getMapStats({ team, tour, bo, reg: regArr, last, dateFrom, dateTo })
    : null;

  const resultB = (isCompare && team2)
    ? await getMapStats({ team: team2, tour: tour2, bo, reg: regArr, last, dateFrom: dateFrom2, dateTo: dateTo2 })
    : null;

  const rankings = (section === 'compare-stats' || section === 'graphs')
    ? await getTournamentRankings({ tour, reg: regArr, bo })
    : {};

  // Overall data (only for overall sections)
  const overallMapStats = (section === 'map-picks')
    ? await getOverallMapPicks({ reg: regArr, tour, bo, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : [];

  const compositionsData = (section === 'maps' && team)
    ? await getOverallCompositions({ team, reg: regArr, tour, bo, last })
    : [];

  const agentPickStats = (section === 'agent-picks')
    ? await getAgentPickStats({ reg: regArr, tour, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : [];

  const agentCompositions = (section === 'agent-picks')
    ? await getOverallCompositions({ reg: regArr, tour, bo })
    : [];

  const mapImages = (section === 'agent-picks')
    ? await getMapImages()
    : {};

  const agentImages = (section === 'agent-picks' || section === 'maps' || isMetaShift)
    ? await getAgentImages()
    : {};

  const mapFullStats = (section === 'agent-picks')
    ? await getOverallMapFullStats({ reg: regArr, tour, bo })
    : {};

  const agentPickStatsLeft = isMetaShift
    ? await getAgentPickStats({ reg: regArr, tour, team: team || undefined, dateFrom, dateTo, excludeTeams: excludeTeamsA.length > 0 ? excludeTeamsA : undefined })
    : [];

  const agentPickStatsRight = isMetaShift
    ? await getAgentPickStats({ reg: reg2Arr, tour: tour2, team: team2 || undefined, dateFrom: dateFrom2, dateTo: dateTo2, excludeTeams: excludeTeamsB.length > 0 ? excludeTeamsB : undefined })
    : [];

  const playerStats = (section === 'player-stats' && team)
    ? await getPlayerStats({ team, reg: regArr, tour, bo, dateFrom, dateTo })
    : [];

  const tournamentPlayerAvg = (section === 'player-stats')
    ? await getTournamentPlayerAvg({ reg: regArr, tour, bo, dateFrom, dateTo })
    : null;

  const playerTimeline = (section === 'player-stats' && team)
    ? await getPlayerTimeline({ team, reg: regArr, tour, bo, last, dateFrom, dateTo })
    : [];

  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const pab = result?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 };

  const [regions, teams, lastUpdateDate] = await Promise.all([getRegions(), getTeams(regArr), getLastUpdateDate()]);
  const teams2 = isMetaShift ? await getTeams(reg2Arr) : [];
  // Compare Economy
  const econCompareA = isCompareEconomy && team
    ? await getEconomyCompare({ reg: regArr, tour, team })
    : null;
  const econCompareB = isCompareEconomy && team2
    ? await getEconomyCompare({ reg: regArr, tour: tour2, team: team2 })
    : null;

  // Economy histogram bins
  const economyBins = isEconomy
    ? await getEconomyDistribution({ reg: regArr, tour, team: team || undefined })
    : [];

  const longestMaps = isRelevantInfo
    ? await getLongestMaps({ reg: regArr, tour, team: team || undefined, bo, last })
    : [];

  const topPerformances = isRelevantInfo
    ? await getTopPlayerPerformances({ reg: regArr, tour, team: team || undefined, bo, last })
    : [];

  const skirmishStats = isSkirmish ? await getSkirmishStats() : null;

  // Tours source differs by context
  const tours = (isOverall || isMetaShift || isEconomy || isRelevantInfo) ? await getAllTours(regArr) : await getTours(team, regArr);
  const tours2 = isCompare
    ? await getTours(team2, regArr)
    : isMetaShift
      ? (team2 ? await getTours(team2, reg2Arr) : await getAllTours(reg2Arr))
      : [];

  function renderSection() {
    switch (section) {
      case 'map-picks':
        return <MapPicksSection stats={overallMapStats} />;
      case 'agent-picks':
        return <AgentPicksSection stats={agentPickStats} compositions={agentCompositions} mapImages={mapImages} agentImages={agentImages} mapFullStats={mapFullStats} />;
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
      case 'charts':
        return <ChartsSection stats={stats} />;
      case 'draft':
        return <DraftSection draftOrder={draftOrder} stats={stats} />;
      case 'compare-maps':
        return (
          <CompareSection
            statsA={stats}
            statsB={resultB?.mapStats || []}
            teamAName={team || ''}
            teamBName={team2 || ''}
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
          />
        );
      default:
        return <MapsSection stats={stats} compositions={compositionsData} agentImages={agentImages} />;
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
            'map-picks': 'Map Picks',
            'agent-picks': 'Agent Picks',
            'meta-shift': 'Meta Shift',
            'graphs': 'Sankey',
            'economy': 'Economy',
            'compare-economy': 'Compare Economy',
          'relevant-info': 'Relevant Info',
          'skirmish-americas': 'Skirmish VCT Americas Stage 1',
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
          {!isSkirmish && (
            <div className="mt-4">
              <Filters
                regions={regions}
                teams={teams}
                tours={tours}
                tours2={tours2}
                teams2={teams2}
                mode={isOverall ? 'overall' : isMetaShift ? 'meta-shift' : isEconomy ? 'economy' : 'team'}
              />
            </div>
          )}
        </header>

        <main className="p-8 pt-6">
          {(isOverall || isMetaShift || isEconomy || isRelevantInfo || isSkirmish) ? (
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
