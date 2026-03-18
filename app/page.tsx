// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams, getTournamentRankings } from '@/lib/data-service';
import { Filters } from '@/components/Filters';
import { Sidebar } from '@/components/Sidebar';
import { MapsSection } from '@/components/sections/MapsSection';
import { EconomySection } from '@/components/sections/EconomySection';
import { ChartsSection } from '@/components/sections/ChartsSection';
import { DraftSection } from '@/components/sections/DraftSection';
import { CompareSection } from '@/components/sections/CompareSection';
import { CompareStatsSection } from '@/components/sections/CompareStatsSection';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reg?: string; team?: string; tour?: string; bo?: string; last?: string; section?: string; team2?: string; tour2?: string }>;
}) {
  const params = await searchParams;
  const { reg, team, tour, bo, last, section = 'maps', team2, tour2 } = params;

  const isCompare = section === 'compare-maps' || section === 'compare-stats';

  const result = team
    ? await getMapStats({ team, tour, bo, reg, last })
    : null;

  const resultB = (isCompare && team2)
    ? await getMapStats({ team: team2, tour: tour2, bo, reg, last })
    : null;

  const rankings = (section === 'compare-stats')
    ? await getTournamentRankings({ tour, reg, bo })
    : {};

  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const pab = result?.pab || { atkWins: 0, defWins: 0, wins: 0, atkTotal: 0, defTotal: 0, total: 0 };

  const regions = await getRegions();
  const teams = await getTeams(reg);
  const tours = await getTours(team, reg);
  const tours2 = isCompare ? await getTours(team2, reg) : [];

  function renderSection() {
    switch (section) {
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
        return <MapsSection stats={stats} />;
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0f1115] text-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="p-8 pb-0">
          <h1 className="text-4xl font-bold text-gray-100">VCT Team stats</h1>
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
            <Filters regions={regions} teams={teams} tours={tours} tours2={tours2} />
          </div>
        </header>

        <main className="p-8 pt-6">
          {!team ? (
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
