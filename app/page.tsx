// app/page.tsx
import { getMapStats, getFilterOptions } from '@/lib/data-service';
import { Filters } from '@/components/Filters';

export default async function Page({ 
  searchParams 
}: { 
  searchParams: Promise<{ team?: string; tour?: string }> 
}) {
  const params = await searchParams;
  const { teams, tours } = await getFilterOptions();
  
  // Si no hay equipo seleccionado, no mostramos stats todavía
  const stats = params.team 
    ? await getMapStats({ 
        team: params.team, 
        tour: params.tour // <--- Pasamos el filtro de torneo
      })
    : [];
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-black text-gray-900 mb-2">VLR Analytics</h1>
      <p className="text-gray-500 mb-8">Estadísticas de mapas en series BO3</p>
      
      {/* Pasamos ambas listas al componente */}
      <Filters teams={teams} tours={tours} />

      {!params.team ? (
        <div className="text-center p-20 border-2 border-dashed rounded-xl text-gray-400">
          Por favor, selecciona un equipo para comenzar el análisis.
        </div>
      ) : (

        <div className="bg-white rounded-xl shadow overflow-hidden border">
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
                  <td colSpan={4} className="p-10 text-center text-gray-500">
                    No se encontraron partidos para este equipo con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}