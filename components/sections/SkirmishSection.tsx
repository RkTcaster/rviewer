'use client';

import { KPICard } from '@/components/KPICard';
import { SkirmishStats } from '@/lib/types';

interface Props {
  stats: SkirmishStats;
}

export function SkirmishSection({ stats }: Props) {
  const { total, sideAWins, sideBWins, matchSideWinnerSum } = stats;

  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '-';

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
      <KPICard
        title="Win Skirmish → Match"
        value={pct(matchSideWinnerSum)}
        label={`${matchSideWinnerSum} / ${total}`}
        variant="neutral"
      />
      <KPICard
        title="Winner Side A"
        value={pct(sideAWins)}
        label={`${sideAWins} wins`}
        variant="neutral"
      />
      <KPICard
        title="Winner Side B"
        value={pct(sideBWins)}
        label={`${sideBWins} wins`}
        variant="neutral"
      />
      </div>

      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="p-3 border-b border-gray-800">Team</th>
              <th className="p-3 text-center border-b border-gray-800 text-green-400">Wins</th>
              <th className="p-3 text-center border-b border-gray-800 text-red-400">Losses</th>
              <th className="p-3 text-center border-b border-gray-800 text-orange-400">Skirmish Win → Match</th>
              <th className="p-3 text-center border-b border-gray-800 text-blue-400">B Side Select</th>
              <th className="p-3 border-b border-gray-800 text-purple-400">Players</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {stats.teams.map((t, i) => (
              <tr key={t.team} className={i % 2 === 0 ? 'bg-[#1a1d23]' : 'bg-[#161920]'}>
                <td className="p-3 font-bold text-white">{t.team}</td>
                <td className="p-3 text-center text-green-400 font-bold">{t.wins}</td>
                <td className="p-3 text-center text-red-400 font-bold">{t.losses}</td>
                <td className="p-3 text-center text-orange-400 font-bold">
                  {t.wins > 0 ? `${Math.round((t.matchWins / t.wins) * 100)}%` : '-'}
                  <span className="text-gray-500 font-normal ml-1 text-xs">({t.matchWins}/{t.wins})</span>
                </td>
                <td className="p-3 text-center text-blue-400 font-bold">
                  {t.wins > 0 ? `${Math.round((t.bSideWins / t.wins) * 100)}%` : '-'}
                  <span className="text-gray-500 font-normal ml-1 text-xs">({t.bSideWins})</span>
                </td>
                <td className="p-3 text-sm text-gray-300">
                  {t.players.map((p, idx) => (
                    <span key={p.name}>
                      {idx > 0 && <span className="text-gray-600">, </span>}
                      {p.name} <span className="text-gray-500 text-xs">({p.wins}W-{p.losses}L)</span>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
