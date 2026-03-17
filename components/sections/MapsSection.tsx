import { MapStat } from '@/lib/types';

interface Props {
  stats: MapStat[];
}

export function MapsSection({ stats }: Props) {
  return (
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="p-4 border-b border-gray-800">Mapa</th>
              <th className="p-4 text-center border-b border-gray-800 bg-gray-900/80">Winrate</th>
              <th className="p-4 text-center border-b border-gray-800 bg-rose-900/80">Atk Side</th>
              <th className="p-4 text-center border-b border-gray-800 bg-green-800/80">Def Side</th>
              <th className="p-4 text-center border-b border-gray-800 bg-green-900/30 text-green-400">Picks</th>
              <th className="p-4 text-center border-b border-gray-800 bg-red-900/30 text-red-400">Bans</th>
              <th className="p-4 text-center border-b border-gray-800 bg-blue-900/30 text-blue-400">Decider</th>
              <th className="p-4 text-center border-b border-gray-800 bg-gray-900/80">Picks Rival</th>
              <th className="p-4 text-center border-b border-gray-800 bg-gray-900/80">Bans Rival</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stats.map((s) => {
              const winrate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0;
              const atkRate = s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : null;
              const defRate = s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : null;

              return (
                <tr key={s.mapName} className="hover:bg-[#252a33] transition-colors">
                  <td className="p-4 font-bold text-white bg-[#1a1d23]">{s.mapName}</td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <span className={`font-bold ${winrate >= 50 ? 'text-green-600' : 'text-red-400'}`}>{winrate}%</span>
                    <div className="text-[10px] text-gray-400">({s.wins}W - {s.played - s.wins}L)</div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {atkRate !== null ? `${atkRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-300">
                        {s.attTotal > 0 ? `(${s.attWins}W - ${s.attTotal - s.attWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center border-x border-gray-800 bg-[#1a1d23]">
                    <div className="flex flex-col">
                      <span className="font-bold text-grey-500">
                        {defRate !== null ? `${defRate}%` : '-'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {s.defTotal > 0 ? `(${s.defWins}W - ${s.defTotal - s.defWins}L)` : 'no played'}
                      </span>
                    </div>
                  </td>

                  <td className="p-4 text-center text-green-400 font-bold bg-green-900/10">{s.picks}</td>
                  <td className="p-4 text-center text-red-400 font-bold bg-red-900/10">{s.bans}</td>
                  <td className="p-4 text-center text-blue-400 font-bold bg-blue-900/10">{s.deciders}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalPicks}</td>
                  <td className="p-4 text-center text-gray-300">{s.rivalBans}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
