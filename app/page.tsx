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
        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="p-4 border-b">Mapa</th>
                <th className="p-4 text-center border-b">Picks</th>
                <th className="p-4 text-center border-b">Bans</th>
                <th className="p-4 text-center border-b">Deciders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.length > 0 ? (
                stats.map((s) => (
                  <tr key={s.mapName} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-800">{s.mapName}</td>
                    <td className="p-4 text-center text-green-600 font-semibold bg-green-50/30">{s.picks}</td>
                    <td className="p-4 text-center text-red-600 font-semibold bg-red-50/30">{s.bans}</td>
                    <td className="p-4 text-center text-blue-600 font-semibold bg-blue-50/30">{s.deciders}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-gray-500 italic">
                    No se encontraron partidos para este equipo con los filtros aplicados.
                  </td>
                </tr>
              )}
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