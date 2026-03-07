// app/page.tsx
import { getMapStats, getRegions, getTours, getTeams } from '@/lib/data-service';
import { Filters } from '@/components/Filters';
import { KPICard } from '@/components/KPICard';

export default async function Page({ searchParams }: { searchParams: Promise<any> }) {
  const params = await searchParams;
  const { reg, team, tour, bo } = params;

  const result = team ? await getMapStats({ team, tour, bo, reg }) : null;
  const stats = result?.mapStats || [];
  const draftOrder = result?.draftOrder || { a: 0, b: 0 };
  const pistols = result?.pistols || { wins: 0, total: 0 };
  const antiEco = result?.antiEco || { wins: 0, total: 0 };
  const regions = await getRegions();
  const teams = await getTeams(reg);
  const tours = await getTours(team, reg);
  const pistolRate = pistols.total > 0 ? Math.round((pistols.wins / pistols.total) * 100) : 0;
  const antiEcoRate = antiEco.total > 0 ? Math.round((antiEco.wins / antiEco.total) * 100) : 0;
  const recovery = result?.recovery || { wins: 0, total: 0 };
  const recoveryRate = recovery.total > 0 ? Math.round((recovery.wins / recovery.total) * 100) : 0;
  const pab = result?.pab || {wins: 0, total: 0}
  const pabRate = pab.total >0 ? Math.round((pab.wins/pab.total)*100) : 0;

  return (
    <main className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-black mb-8 text-gray-900">VALORANT Stats</h1>

      <Filters regions={regions} teams={teams} tours={tours} />

      {team ? (
        <div className="space-y-8 mt-8"> {/* Contenedor con espacio entre tabla y KPIs */}

        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-900 text-white text-[11px] uppercase tracking-widest">
                <tr>
                  <th className="p-4 border-b">Mapa</th>
                  <th className="p-4 text-center border-b bg-gray-800">Winrate</th>
                  <th className="p-4 text-center border-b bg-amber-700/80">Atk Side</th>
                  <th className="p-4 text-center border-b bg-blue-800/80">Def Side</th>
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
                  const atkRate = s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : null;
                  const defRate = s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : null;


                  return (
                    <tr key={s.mapName} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-900 bg-gray-50/30">{s.mapName}</td>

                      {/* Winrate Mapa */}
                      <td className="p-4 text-center border-x bg-white">
                        <span className={`font-bold ${winrate >= 50 ? 'text-green-600' : 'text-red-600'}`}>{winrate}%</span>
                        <div className="text-[10px] text-gray-400">({s.wins}W - {s.played - s.wins}L)</div>
                      </td>

                      {/* Attack Side */}
                      <td className="p-4 text-center bg-amber-50/30 border-x border-gray-100">
                        <div className="flex flex-col">
                          <span className="font-bold text-amber-700">
                            {atkRate !== null ? `${atkRate}%` : '-'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {s.attTotal > 0 ? `(${s.attWins}W - ${s.attTotal - s.attWins}L)` : 'no played'}
                          </span>
                        </div>
                      </td>

                      {/* Defense Side */}
                      <td className="p-4 text-center bg-blue-50/30 border-r border-gray-100">
                        <div className="flex flex-col">
                          <span className="font-bold text-blue-700">
                            {defRate !== null ? `${defRate}%` : '-'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {s.defTotal > 0 ? `(${s.defWins}W - ${s.defTotal - s.defWins}L)` : 'no played'}
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


          {/* SECCIÓN DE KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

            <KPICard 
              title="Draft Order" 
              label="A — B" 
              value={`${draftOrder.a} — ${draftOrder.b}`} 
            />
                        
            <KPICard 
              title="Pistol Rounds" 
              label={`${pistols.wins}W — ${pistols.total - pistols.wins}L`} 
              value={`${pistolRate}%`} 
            />

            <KPICard 
              title="Post Pistol Win into Win" 
              label={`${antiEco.wins}W — ${antiEco.total - antiEco.wins}L`} 
              value={`${antiEcoRate}%`} 
            />
            {/* Aquí podremos agregar más tarjetas luego */}

            <KPICard 
              title="Post Pistol Loss into Win" 
              label={`${recovery.wins}W — ${recovery.total - recovery.wins}L`} 
              value={`${recoveryRate}%`} 
            />
              <KPICard 
              title="PAB (Bonus conversion)" 
              label={`${pab.wins}W — ${pab.total - pab.wins}L`} 
              value={`${pabRate}%`} 
            />

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