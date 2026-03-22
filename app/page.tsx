// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams, getTournamentRankings, getAllTours, getOverallMapPicks, getOverallCompositions, getAgentPickStats, getPlayerStats, getTournamentPlayerAvg, getMapImages, getAgentImages, getOverallMapFullStats } from '@/lib/data-service';
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string; team?: string; tour?: string; bo?: string; last?: string; section?: string; team2?: string; tour2?: string; reg2?: string; dateFrom?: string; dateTo?: string; dateFrom2?: string; dateTo2?: string }>;
}) {
  const params = await searchParams;
  const { reg, team, tour, bo, last, section = 'maps', team2, tour2, reg2, dateFrom, dateTo, dateFrom2, dateTo2 } = params;

  const isOverall = section === 'map-picks' || section === 'agent-picks';
  const isCompare = section === 'compare-maps' || section === 'compare-stats';
  const isMetaShift = section === 'meta-shift';

  // Team data (only for team sections)
  const result = (!isOverall && !isMetaShift && team)
    ? await getMapStats({ team, tour, bo, reg, last })
    : null;

  const resultB = (isCompare && team2)
    ? await getMapStats({ team: team2, tour: tour2, bo, reg, last })
    : null;

  const rankings = (section === 'compare-stats')
    ? await getTournamentRankings({ tour, reg, bo })
    : {};

  // Overall data (only for overall sections)
  const overallMapStats = (section === 'map-picks')
    ? await getOverallMapPicks({ reg, tour, bo })
    : [];

  const compositionsData = (section === 'maps' && team)
    ? await getOverallCompositions({ team, reg, tour, bo, last })
    : [];

  const agentPickStats = (section === 'agent-picks')
    ? await getAgentPickStats({ reg, tour, bo })
    : [];

  const agentCompositions = (section === 'agent-picks')
    ? await getOverallCompositions({ reg, tour, bo })
    : [];

  const mapImages = (section === 'agent-picks')
    ? await getMapImages()
    : {};

  const agentImages = (section === 'agent-picks' || section === 'maps' || isMetaShift)
    ? await getAgentImages()
    : {};

  const mapFullStats = (section === 'agent-picks')
    ? await getOverallMapFullStats({ reg, tour, bo })
    : {};

  const agentPickStatsLeft = isMetaShift
    ? await getAgentPickStats({ reg, tour, team: team || undefined, dateFrom, dateTo })
    : [];

  const agentPickStatsRight = isMetaShift
    ? await getAgentPickStats({ reg: reg2, tour: tour2, team: team2 || undefined, dateFrom: dateFrom2, dateTo: dateTo2 })
    : [];

  const playerStats = (section === 'player-stats' && team)
    ? await getPlayerStats({ team, reg, tour, bo })
    : [];

  const tournamentPlayerAvg = (section === 'player-stats')
    ? await getTournamentPlayerAvg({ reg, tour, bo })
    : null;

  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const pab = result?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 };

  const regions = await getRegions();
  const teams = await getTeams(reg);
  const teams2 = isMetaShift ? await getTeams(reg2) : [];
  // Tours source differs by context
  const tours = (isOverall || isMetaShift) ? await getAllTours(reg) : await getTours(team, reg);
  const tours2 = isCompare
    ? await getTours(team2, reg)
    : isMetaShift
      ? (team2 ? await getTours(team2, reg2) : await getAllTours(reg2))
      : [];

  function renderSection() {
    switch (section) {
      case 'map-picks':
        return <MapPicksSection stats={overallMapStats} />;
      case 'agent-picks':
        return <AgentPicksSection stats={agentPickStats} compositions={agentCompositions} mapImages={mapImages} agentImages={agentImages} mapFullStats={mapFullStats} />;
      case 'meta-shift':
        return <MetaShiftSection statsLeft={agentPickStatsLeft} statsRight={agentPickStatsRight} agentImages={agentImages} />;
      case 'player-stats':
        return <PlayerStatsSection stats={playerStats} tournamentAvg={tournamentPlayerAvg} />;
      case 'economy':
        return <EconomySection pistols={pistols} antiEco={antiEco} recovery={recovery} pab={pab} />;
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
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="p-8 pb-0">
          <h1 className="text-4xl font-bold text-gray-100">VCT Team stats</h1>
          {reg && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/30 text-blue-400 border border-blue-800 uppercase tracking-widest mt-1">
              {regions.find(r => r.reg_id === reg)?.region ?? reg}
            </span>
          )}
          {result?.lastMatchData && (
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Last team match date:{' '}
              {new Date(result.lastMatchData).toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
          <div className="mt-4">
            <Filters
              regions={regions}
              teams={teams}
              tours={tours}
              tours2={tours2}
              teams2={teams2}
              mode={isOverall ? 'overall' : isMetaShift ? 'meta-shift' : 'team'}
            />
          </div>
        </header>

        <main className="p-8 pt-6">
          {(isOverall || isMetaShift) ? (
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
