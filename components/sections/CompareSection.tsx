import { MapStat } from '@/lib/types';

interface Props {
  statsA: MapStat[];
  statsB: MapStat[];
  teamAName: string;
  teamBName: string;
}

const EMPTY: MapStat = {
  mapName: '', picks: 0, bans: 0, deciders: 0,
  rivalPicks: 0, rivalBans: 0, wins: 0, played: 0,
  attWins: 0, attTotal: 0, defWins: 0, defTotal: 0,
};

function pct(wins: number, total: number): number | null {
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

function WrCell({ wins, played }: { wins: number; played: number }) {
  const w = pct(wins, played);
  if (w === null) return <span className="text-gray-600">-</span>;
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold ${w >= 50 ? 'text-green-500' : 'text-red-400'}`}>{w}%</span>
      <span className="text-[11.5px] text-gray-400">({wins}W - {played - wins}L)</span>
    </div>
  );
}

function SideCell({ wins, total }: { wins: number; total: number }) {
  const r = pct(wins, total);
  if (r === null) return <span className="text-gray-600">-</span>;
  return (
    <div className="flex flex-col items-center">
      <span className="font-bold">{r}%</span>
      <span className="text-[11.5px] text-gray-400">({wins}W - {total - wins}L)</span>
    </div>
  );
}

export function CompareSection({ statsA, statsB, teamAName, teamBName }: Props) {
  // Build joined map index
  const mapIndex: Record<string, { a: MapStat | null; b: MapStat | null }> = {};
  statsA.forEach(s => { mapIndex[s.mapName] = { a: s, b: null }; });
  statsB.forEach(s => {
    if (!mapIndex[s.mapName]) mapIndex[s.mapName] = { a: null, b: s };
    else mapIndex[s.mapName].b = s;
  });
  const rows = Object.entries(mapIndex).sort(([a], [b]) => a.localeCompare(b));

  const th = 'p-3 text-center border-b border-gray-800';

  return (
    <div>
      {!teamBName ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Choose Team B in the filters above to compare...
        </div>
      ) : (
        <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13.8px]">
              <thead className="bg-[#0f1115] text-gray-400 text-[11.5px] uppercase tracking-widest">
                {/* Team name labels */}
                <tr>
                  <th colSpan={6} className="py-2 text-center text-blue-300 border-b border-gray-700 font-bold tracking-wider">
                    {teamAName}
                  </th>
                  <th className="py-2 border-b border-gray-700 bg-[#252a33]" />
                  <th colSpan={6} className="py-2 text-center text-orange-300 border-b border-gray-700 font-bold tracking-wider">
                    {teamBName}
                  </th>
                </tr>
                {/* Column headers */}
                <tr>
                  {/* Team A side */}
                  <th className={`${th} bg-blue-900/30 text-blue-400`}>Decider</th>
                  <th className={`${th} bg-green-900/30 text-green-400`}>
                    <div>Picks</div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Pick · Rival</div>
                  </th>
                  <th className={`${th} bg-red-900/30 text-red-400`}>
                    <div>Bans</div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Ban · Rival</div>
                  </th>
                  <th className={`${th} bg-rose-900/80`}>Atk Side</th>
                  <th className={`${th} bg-green-800/80`}>Def Side</th>
                  <th className={`${th} bg-gray-900/80`}>Winrate</th>
                  {/* Map center */}
                  <th className="p-3 text-center border-b border-gray-800 bg-[#252a33] text-white font-bold min-w-[120px]">
                    Map
                  </th>
                  {/* Team B side (mirrored) */}
                  <th className={`${th} bg-gray-900/80`}>Winrate</th>
                  <th className={`${th} bg-green-800/80`}>Def Side</th>
                  <th className={`${th} bg-rose-900/80`}>Atk Side</th>
                  <th className={`${th} bg-red-900/30 text-red-400`}>
                    <div>Bans</div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Ban · Rival</div>
                  </th>
                  <th className={`${th} bg-green-900/30 text-green-400`}>
                    <div>Picks</div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Pick · Rival</div>
                  </th>
                  <th className={`${th} bg-blue-900/30 text-blue-400`}>Decider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map(([mapName, { a, b }]) => {
                  const sa = a ?? EMPTY;
                  const sb = b ?? EMPTY;
                  return (
                    <tr key={mapName} className="hover:bg-[#252a33] transition-colors">
                      {/* Team A */}
                      <td className="p-3 text-center text-blue-400 font-bold bg-blue-900/10">
                        {sa.deciders || <span className="text-gray-600">-</span>}
                      </td>
                      <td className="p-3 text-center bg-green-900/10">
                        <div className="font-bold text-green-400">{sa.picks}</div>
                        <div className="text-[11.5px] text-gray-500">{sa.rivalPicks}</div>
                      </td>
                      <td className="p-3 text-center bg-red-900/10">
                        <div className="font-bold text-red-400">{sa.bans}</div>
                        <div className="text-[11.5px] text-gray-500">{sa.rivalBans}</div>
                      </td>
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <SideCell wins={sa.attWins} total={sa.attTotal} />
                      </td>
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <SideCell wins={sa.defWins} total={sa.defTotal} />
                      </td>
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <WrCell wins={sa.wins} played={sa.played} />
                      </td>

                      {/* Map name (center) */}
                      <td className="p-3 text-center font-bold text-white bg-[#252a33]">{mapName}</td>

                      {/* Team B (mirrored) */}
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <WrCell wins={sb.wins} played={sb.played} />
                      </td>
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <SideCell wins={sb.defWins} total={sb.defTotal} />
                      </td>
                      <td className="p-3 text-center bg-[#1a1d23]">
                        <SideCell wins={sb.attWins} total={sb.attTotal} />
                      </td>
                      <td className="p-3 text-center bg-red-900/10">
                        <div className="font-bold text-red-400">{sb.bans}</div>
                        <div className="text-[11.5px] text-gray-500">{sb.rivalBans}</div>
                      </td>
                      <td className="p-3 text-center bg-green-900/10">
                        <div className="font-bold text-green-400">{sb.picks}</div>
                        <div className="text-[11.5px] text-gray-500">{sb.rivalPicks}</div>
                      </td>
                      <td className="p-3 text-center text-blue-400 font-bold bg-blue-900/10">
                        {sb.deciders || <span className="text-gray-600">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
