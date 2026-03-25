import { EconomyCategoryStats, EconomyMatchup, TeamEconomyCompare } from '@/lib/types';

interface Props {
  statsA: TeamEconomyCompare | null;
  statsB: TeamEconomyCompare | null;
  teamAName: string;
  teamBName: string;
}

function cell(m: EconomyMatchup | undefined): string {
  if (!m || m.played === 0) return '—';
  const wr = Math.round((m.wins / m.played) * 100);
  return `Played ${m.played} · WR ${wr}%`;
}

const CATEGORIES: { key: keyof TeamEconomyCompare; label: string; range: string }[] = [
  { key: 'eco',     label: 'Eco',      range: '0k – 5k'  },
  { key: 'semiEco', label: 'Semi-Eco', range: '5k – 15k' },
  { key: 'semiBuy', label: 'Semi-Buy', range: '15k – 20k' },
  { key: 'fullBuy', label: 'Full-Buy', range: '20k+'     },
];

const ROWS: { key: keyof EconomyCategoryStats; label: string }[] = [
  { key: 'total',     label: 'Total'        },
  { key: 'vsEco',     label: 'vs Eco'       },
  { key: 'vsSemiEco', label: 'vs Semi-Eco'  },
  { key: 'vsSemiBuy', label: 'vs Semi-Buy'  },
  { key: 'vsFullBuy', label: 'vs Full-Buy'  },
];

export function CompareEconomySection({ statsA, statsB, teamAName, teamBName }: Props) {
  if (!statsA && !statsB) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Choose a team to see the data...
      </div>
    );
  }

  const totalA = statsA ? Object.values(statsA).reduce((s, c) => s + c.total.played, 0) : 0;
  const totalB = statsB ? Object.values(statsB).reduce((s, c) => s + c.total.played, 0) : 0;
  const hdrPct = (played: number, grand: number) =>
    grand > 0 ? `${Math.round((played / grand) * 100)}% of total rounds played` : '—';

  return (
    <div className="space-y-1.5">
      {CATEGORIES.map(({ key, label, range }) => {
        const playedA = statsA?.[key].total.played ?? 0;
        const playedB = statsB?.[key].total.played ?? 0;
        return (
        <div key={key} className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
          {/* Category header */}
          <div className="px-5 py-3 border-b border-gray-800 bg-[#0f1115] grid grid-cols-3 items-center">
            <div className="text-left">
              <div className="text-[14px] font-bold uppercase tracking-widest text-blue-400">
                {teamAName || 'Team A'} <span className="text-blue-400/60 font-semibold">{hdrPct(playedA, totalA)}</span>
              </div>
            </div>
            <div className="text-center">
              <span className="text-xs font-black uppercase tracking-widest text-gray-300">{label}</span>
              <span className="ml-2 text-xs font-semibold text-gray-500">{range}</span>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-bold uppercase tracking-widest text-orange-400">
                <span className="text-orange-400/60 font-semibold">{hdrPct(playedB, totalB)}</span> {teamBName || 'Team B'}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <tbody>
              {ROWS.map(({ key: rowKey, label: rowLabel }, i) => (
                <tr
                  key={rowKey}
                  className={`border-b border-gray-800/50 ${i === 0 ? 'bg-[#1a1d23]' : 'hover:bg-[#252a33]/40'} transition-colors`}
                >
                  <td className={`px-5 py-2.5 text-left font-mono text-sm ${i === 0 ? 'font-bold text-blue-300' : 'text-blue-400/80'}`}>
                    {cell(statsA?.[key]?.[rowKey])}
                  </td>
                  <td className={`px-5 py-2.5 text-center text-[11px] uppercase tracking-wider ${i === 0 ? 'font-black text-gray-300' : 'font-semibold text-gray-500'}`}>
                    {rowLabel}
                  </td>
                  <td className={`px-5 py-2.5 text-right font-mono text-sm ${i === 0 ? 'font-bold text-orange-300' : 'text-orange-400/80'}`}>
                    {cell(statsB?.[key]?.[rowKey])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })}
    </div>
  );
}
