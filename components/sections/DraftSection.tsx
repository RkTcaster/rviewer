import { KPICard } from '@/components/KPICard';
import { MapStat } from '@/lib/types';

interface Props {
  draftOrder: { a: number; b: number };
  stats: MapStat[];
}

export function DraftSection({ draftOrder, stats }: Props) {
  const sorted = [...stats].sort((a, b) => b.picks - a.picks);
  const topPicks = sorted.slice(0, 5);
  const topBans = [...stats].sort((a, b) => b.bans - a.bans).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard
          title="Draft Order A"
          label="Veces que fue equipo A"
          value={`${draftOrder.a}`}
        />
        <KPICard
          title="Draft Order B"
          label="Veces que fue equipo B"
          value={`${draftOrder.b}`}
        />
        <KPICard
          title="A — B"
          label="Ratio draft order"
          value={`${draftOrder.a} — ${draftOrder.b}`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-green-400">Top Picks</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-[#0f1115]">
              <tr>
                <th className="px-5 py-2 text-left">Mapa</th>
                <th className="px-5 py-2 text-center">Picks</th>
                <th className="px-5 py-2 text-center">Picks Rival</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {topPicks.map((s) => (
                <tr key={s.mapName} className="hover:bg-[#252a33] transition-colors">
                  <td className="px-5 py-3 font-semibold text-white">{s.mapName}</td>
                  <td className="px-5 py-3 text-center text-green-400 font-bold">{s.picks}</td>
                  <td className="px-5 py-3 text-center text-gray-400">{s.rivalPicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-red-400">Top Bans</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-gray-500 bg-[#0f1115]">
              <tr>
                <th className="px-5 py-2 text-left">Mapa</th>
                <th className="px-5 py-2 text-center">Bans</th>
                <th className="px-5 py-2 text-center">Bans Rival</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {topBans.map((s) => (
                <tr key={s.mapName} className="hover:bg-[#252a33] transition-colors">
                  <td className="px-5 py-3 font-semibold text-white">{s.mapName}</td>
                  <td className="px-5 py-3 text-center text-red-400 font-bold">{s.bans}</td>
                  <td className="px-5 py-3 text-center text-gray-400">{s.rivalBans}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
