import { MapStat, TeamRankStats } from '@/lib/types';

type PabStat = { wins: number; total: number; atkWins: number; atkTotal: number; defWins: number; defTotal: number };

interface Props {
  statsA: MapStat[];
  statsB: MapStat[];
  pistolsA: { wins: number; total: number };
  pistolsB: { wins: number; total: number };
  antiEcoA: { wins: number; total: number };
  antiEcoB: { wins: number; total: number };
  recoveryA: { wins: number; total: number };
  recoveryB: { wins: number; total: number };
  pabA: PabStat;
  pabB: PabStat;
  teamAName: string;
  teamBName: string;
  rankings: Record<string, TeamRankStats>;
}

type MetricKey = 'map' | 'atk' | 'def' | 'pistol' | 'antiEco' | 'recovery' | 'pab' | 'pabAtk' | 'pabDef';

interface RowData {
  label: string;
  key: MetricKey;
  valA: number | null;
  winsA: number;
  totalA: number;
  valB: number | null;
  winsB: number;
  totalB: number;
  /** true = lower % is better (inverts color and ranking direction) */
  lowerIsBetter?: boolean;
}

function pct(wins: number, total: number): number | null {
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

function getRank(
  rankings: Record<string, TeamRankStats>,
  team: string,
  key: MetricKey,
  lowerIsBetter = false
): { rank: number; total: number } | null {
  const getValue = (s: TeamRankStats): number | null => {
    switch (key) {
      case 'map':      return pct(s.mapWins, s.mapPlayed);
      case 'atk':      return pct(s.attWins, s.attTotal);
      case 'def':      return pct(s.defWins, s.defTotal);
      case 'pistol':   return pct(s.pistolWins, s.pistolTotal);
      case 'antiEco':  return pct(s.antiEcoWins, s.antiEcoTotal);
      case 'recovery': return pct(s.recoveryWins, s.recoveryTotal);
      case 'pab':      return pct(s.pabWins, s.pabTotal);
      case 'pabAtk':   return pct(s.pabAtkWins, s.pabAtkTotal);
      case 'pabDef':   return pct(s.pabDefWins, s.pabDefTotal);
    }
  };

  const entries = Object.entries(rankings)
    .map(([name, stats]) => ({ name, val: getValue(stats) }))
    .filter((e): e is { name: string; val: number } => e.val !== null)
    .sort((a, b) => lowerIsBetter ? a.val - b.val : b.val - a.val);

  const idx = entries.findIndex(e => e.name.trim() === team.trim());
  if (idx === -1) return null;
  return { rank: idx + 1, total: entries.length };
}

function RankBadge({ rankInfo }: { rankInfo: { rank: number; total: number } | null }) {
  if (!rankInfo) return <span className="text-gray-700 text-[11px]">—</span>;
  const { rank, total } = rankInfo;
  const color =
    rank === 1 ? 'text-yellow-400' :
    rank <= 3  ? 'text-green-400' :
    rank <= Math.ceil(total / 2) ? 'text-gray-300' : 'text-gray-600';
  return (
    <span className={`text-[12px] font-bold ${color}`}>
      #{rank}<span className="font-normal text-gray-600 text-[10px]"> / {total}</span>
    </span>
  );
}

const thBase = 'px-4 py-3 text-[10px] uppercase tracking-widest text-gray-500 font-bold border-b border-gray-800';

function StatRow({ row, teamAName, teamBName, rankings }: {
  row: RowData;
  teamAName: string;
  teamBName: string;
  rankings: Record<string, TeamRankStats>;
}) {
  const rankA = getRank(rankings, teamAName, row.key, row.lowerIsBetter);
  const rankB = getRank(rankings, teamBName, row.key, row.lowerIsBetter);

  // Color: for normal metrics higher = green; for lowerIsBetter higher = red
  let colorA = 'text-gray-300';
  let colorB = 'text-gray-300';
  if (row.valA !== null && row.valB !== null) {
    const aLeads = row.lowerIsBetter ? row.valA < row.valB : row.valA > row.valB;
    const bLeads = row.lowerIsBetter ? row.valB < row.valA : row.valB > row.valA;
    if (aLeads) { colorA = 'text-green-400'; colorB = 'text-red-400'; }
    else if (bLeads) { colorA = 'text-red-400'; colorB = 'text-green-400'; }
  }

  const wlA = row.totalA > 0 ? `${row.winsA}W – ${row.totalA - row.winsA}L` : '—';
  const wlB = row.totalB > 0 ? `${row.winsB}W – ${row.totalB - row.winsB}L` : '—';

  return (
    <tr className="hover:bg-[#252a33] transition-colors border-b border-gray-800">
      {/* Team A: Ranking */}
      <td className="px-4 py-4 text-center bg-[#1a1d23] w-20">
        <RankBadge rankInfo={rankA} />
      </td>
      {/* Team A: W-L */}
      <td className="px-4 py-4 text-right bg-[#1a1d23] text-[12px] text-gray-500 whitespace-nowrap">
        {wlA}
      </td>
      {/* Team A: % */}
      <td className="px-5 py-4 text-right bg-[#1a1d23]">
        <span className={`text-2xl font-black ${row.valA !== null ? colorA : 'text-gray-600'}`}>
          {row.valA !== null ? `${row.valA}%` : '-'}
        </span>
      </td>

      {/* Metric label */}
      <td className="px-6 py-4 text-center bg-[#0f1115] min-w-[180px]">
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{row.label}</span>
      </td>

      {/* Team B: % */}
      <td className="px-5 py-4 text-left bg-[#1a1d23]">
        <span className={`text-2xl font-black ${row.valB !== null ? colorB : 'text-gray-600'}`}>
          {row.valB !== null ? `${row.valB}%` : '-'}
        </span>
      </td>
      {/* Team B: W-L */}
      <td className="px-4 py-4 text-left bg-[#1a1d23] text-[12px] text-gray-500 whitespace-nowrap">
        {wlB}
      </td>
      {/* Team B: Ranking */}
      <td className="px-4 py-4 text-center bg-[#1a1d23] w-20">
        <RankBadge rankInfo={rankB} />
      </td>
    </tr>
  );
}

export function CompareStatsSection({
  statsA, statsB, pistolsA, pistolsB,
  antiEcoA, antiEcoB, recoveryA, recoveryB,
  pabA, pabB, teamAName, teamBName, rankings,
}: Props) {
  if (!teamBName) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Choose Team B in the filters above to compare...
      </div>
    );
  }

  const aggA = {
    wins: statsA.reduce((s, m) => s + m.wins, 0),
    played: statsA.reduce((s, m) => s + m.played, 0),
    attWins: statsA.reduce((s, m) => s + m.attWins, 0),
    attTotal: statsA.reduce((s, m) => s + m.attTotal, 0),
    defWins: statsA.reduce((s, m) => s + m.defWins, 0),
    defTotal: statsA.reduce((s, m) => s + m.defTotal, 0),
  };
  const aggB = {
    wins: statsB.reduce((s, m) => s + m.wins, 0),
    played: statsB.reduce((s, m) => s + m.played, 0),
    attWins: statsB.reduce((s, m) => s + m.attWins, 0),
    attTotal: statsB.reduce((s, m) => s + m.attTotal, 0),
    defWins: statsB.reduce((s, m) => s + m.defWins, 0),
    defTotal: statsB.reduce((s, m) => s + m.defTotal, 0),
  };

  const rows: RowData[] = [
    {
      label: 'Map Winrate', key: 'map',
      valA: pct(aggA.wins, aggA.played),            winsA: aggA.wins,       totalA: aggA.played,
      valB: pct(aggB.wins, aggB.played),            winsB: aggB.wins,       totalB: aggB.played,
    },
    {
      label: 'Atk Side Winrate', key: 'atk',
      valA: pct(aggA.attWins, aggA.attTotal),       winsA: aggA.attWins,    totalA: aggA.attTotal,
      valB: pct(aggB.attWins, aggB.attTotal),       winsB: aggB.attWins,    totalB: aggB.attTotal,
    },
    {
      label: 'Def Side Winrate', key: 'def',
      valA: pct(aggA.defWins, aggA.defTotal),       winsA: aggA.defWins,    totalA: aggA.defTotal,
      valB: pct(aggB.defWins, aggB.defTotal),       winsB: aggB.defWins,    totalB: aggB.defTotal,
    },
    {
      label: 'Pistol Winrate', key: 'pistol',
      valA: pct(pistolsA.wins, pistolsA.total),     winsA: pistolsA.wins,   totalA: pistolsA.total,
      valB: pct(pistolsB.wins, pistolsB.total),     winsB: pistolsB.wins,   totalB: pistolsB.total,
    },
    {
      label: 'Post Pistol Into Win', key: 'antiEco',
      valA: pct(antiEcoA.wins, antiEcoA.total),     winsA: antiEcoA.wins,   totalA: antiEcoA.total,
      valB: pct(antiEcoB.wins, antiEcoB.total),     winsB: antiEcoB.wins,   totalB: antiEcoB.total,
    },
    {
      label: 'Bonus Conversion (PAB)', key: 'pab',
      valA: pct(pabA.wins, pabA.total),             winsA: pabA.wins,       totalA: pabA.total,
      valB: pct(pabB.wins, pabB.total),             winsB: pabB.wins,       totalB: pabB.total,
    },
    {
      label: 'PAB Atk', key: 'pabAtk',
      valA: pct(pabA.atkWins, pabA.atkTotal),       winsA: pabA.atkWins,    totalA: pabA.atkTotal,
      valB: pct(pabB.atkWins, pabB.atkTotal),       winsB: pabB.atkWins,    totalB: pabB.atkTotal,
    },
    {
      label: 'PAB Def', key: 'pabDef',
      valA: pct(pabA.defWins, pabA.defTotal),       winsA: pabA.defWins,    totalA: pabA.defTotal,
      valB: pct(pabB.defWins, pabB.defTotal),       winsB: pabB.defWins,    totalB: pabB.defTotal,
    },
  ];

  return (
    <div className="bg-[#1a1d23] rounded-xl shadow-2xl overflow-hidden border border-gray-800">
      <table className="w-full border-collapse">
        <thead className="bg-[#0f1115]">
          {/* Team name row */}
          <tr>
            <th colSpan={3} className="py-3 text-center text-blue-300 text-sm font-bold tracking-wider border-b border-gray-700">
              {teamAName}
            </th>
            <th className="py-3 border-b border-gray-700" />
            <th colSpan={3} className="py-3 text-center text-orange-300 text-sm font-bold tracking-wider border-b border-gray-700">
              {teamBName}
            </th>
          </tr>
          {/* Column header row */}
          <tr>
            <th className={`${thBase} text-center`}>Rank</th>
            <th className={`${thBase} text-right`}>W-L</th>
            <th className={`${thBase} text-right`}>%</th>
            <th className={`${thBase} text-center`}>Metric</th>
            <th className={`${thBase} text-left`}>%</th>
            <th className={`${thBase} text-left`}>W-L</th>
            <th className={`${thBase} text-center`}>Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <StatRow
              key={row.key}
              row={row}
              teamAName={teamAName}
              teamBName={teamBName}
              rankings={rankings}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
