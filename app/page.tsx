// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams } from '@/lib/data-service';
import { Filters } from '@/components/Filters';

export default async function Page({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const { reg, team, tour, bo } = params;

  const regions = await getRegions();
  const teams = await getTeams(reg);
  const tours = await getTours(team, reg);

  const stats = team ? await getMapStats({ team, tour, bo, reg }) : [];

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-black mb-8">VALORANT Stats</h1>

      <Filters regions={regions} teams={teams} tours={tours} />

      {team ? (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-900 text-white text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="p-4 border-b">Mapa</th>
                  <th className="p-4 text-center border-b bg-gray-800">Winrate</th> {/* NUEVA COLUMNA EN HEADER */}
                  <th className="p-4 text-center border-b bg-green-900/80">Picks</th>
                  <th className="p-4 text-center border-b bg-red-900/80">Bans</th>
                  <th className="p-4 text-center border-b bg-blue-900/80">Decider</th>
                  <th className="p-4 text-center border-b bg-gray-800">Picks Rival</th>
                  <th className="p-4 text-center border-b bg-gray-800">Bans Rival</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.map((s) => {
                  const winrate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;

                  return (
                    <tr key={s.mapName} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-900 bg-gray-50/30">{s.mapName}</td>

                      {/* Celda: Winrate */}
                      <td className="p-4 text-center border-x bg-white min-w-[100px]">
                        <div className="flex flex-col">
                          <span className={`font-bold ${winrate >= 50 ? 'text-green-600' : 'text-amber-600'}`}>
                            {winrate}%
                          </span>
                          <span className="text-[10px] text-gray-400">
                            ({s.wins}W - {s.played - s.wins}L)
                          </span>
                        </div>
                      </td>

                      {/* Resto de columnas */}
                      <td className="p-4 text-center text-green-700 font-bold bg-green-50/30">{s.picks}</td>
                      <td className="p-4 text-center text-red-700 font-bold bg-red-50/30">{s.bans}</td>
                      <td className="p-4 text-center text-blue-700 font-bold bg-blue-50/30">{s.deciders}</td>
                      <td className="p-4 text-center text-gray-600">{s.rivalPicks}</td>
                      <td className="p-4 text-center text-gray-600">{s.rivalBans}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Selecciona al menos un equipo para ver datos
        </div>
      )}
    </main>
  );
}