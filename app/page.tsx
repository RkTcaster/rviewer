// app/page.tsx
import { getDraftStats, getRegions, getTours, getTeams } from '@/lib/data-service';
import { Filters } from '@/components/Filters';

export default async function Page({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const { reg, team, tour, bo } = params;

  const regions = await getRegions();
  const teams = await getTeams(reg);
  const tours = await getTours(team, reg);

  const stats = team ? await getDraftStats({ team, tour, bo, reg }) : [];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-black mb-8">VALORANT Stats</h1>

      <Filters regions={regions} teams={teams} tours={tours} />

      {team ? (
        <div className="bg-white rounded-xl shadow overflow-hidden border">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-white text-xs uppercase">
              <tr>
                <th className="p-4 border-b">Mapa</th>
                <th className="p-4 text-center border-b bg-green-900">Picks</th>
                <th className="p-4 text-center border-b bg-red-900">Bans</th>
                <th className="p-4 text-center border-b bg-green-800">Picks Rival</th>
                <th className="p-4 text-center border-b bg-red-800">Bans Rival</th>
                <th className="p-4 text-center border-b">Deciders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.map((s) => (
                <tr key={s.mapName} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-800">{s.mapName}</td>

                  {/* Stats Equipo */}
                  <td className="p-4 text-center text-green-700 font-bold bg-green-50/50">{s.picks}</td>
                  <td className="p-4 text-center text-red-700 font-bold bg-red-50/50">{s.bans}</td>

                  {/* Stats Rival */}
                  <td className="p-4 text-center text-green-600 bg-gray-50/50">{s.rivalPicks}</td>
                  <td className="p-4 text-center text-red-600 bg-gray-50/50">{s.rivalBans}</td>

                  {/* Decider */}
                  <td className="p-4 text-center text-blue-600 font-semibold">{s.deciders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Selecciona al menos un equipo para ver datos
        </div>
      )}
    </main>
  );
}