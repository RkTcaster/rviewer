import { Sword, Shield } from 'lucide-react';
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

type MetricKey = 'map' | 'atk' | 'def' | 'pistol' | 'antiEco' | 'recovery' | 'pab' | 'pabAtk' | 'pabDef' | 'timeout' | 'retake' | 'postPlant' | 'plantAtk' | 'plantDef';

interface RowData {
  label: React.ReactNode;
  key: MetricKey;
  valA: number | null;
  winsA: number;
  totalA: number;
  valB: number | null;
  winsB: number;
  totalB: number;
  /** true = lower % is better (inverts color and ranking direction) */
  lowerIsBetter?: boolean;
  /** true = show raw count instead of W-L% */
  countOnly?: boolean;
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
      case 'timeout':  return s.timeoutLosses;
      case 'retake':     return pct(s.retakeDe, s.retakePl);
      case 'postPlant':  return s.postPlantPl > 0 ? pct(s.postPlantPl - s.postPlantDe, s.postPlantPl) : null;
      case 'plantAtk':   return pct(s.postPlantPl, s.attTotal);
      case 'plantDef':   return pct(s.retakePl, s.defTotal);
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
      {/* Team A: W-L or count */}
      <td className="px-4 py-4 text-right bg-[#1a1d23] text-[12px] text-gray-500 whitespace-nowrap">
        {!row.countOnly && wlA}
      </td>
      {/* Team A: % or count */}
      <td className="px-5 py-4 text-right bg-[#1a1d23]">
        <span className={`text-2xl font-black ${row.valA !== null ? colorA : 'text-gray-600'}`}>
          {row.valA !== null ? (row.countOnly ? row.valA : `${row.valA}%`) : '-'}
        </span>
      </td>

      {/* Metric label */}
      <td className="px-6 py-4 text-center bg-[#0f1115] min-w-[180px]">
        <span className="text-[12px] font-bold uppercase tracking-widest text-gray-400">{row.label}</span>
      </td>

      {/* Team B: % or count */}
      <td className="px-5 py-4 text-left bg-[#1a1d23]">
        <span className={`text-2xl font-black ${row.valB !== null ? colorB : 'text-gray-600'}`}>
          {row.valB !== null ? (row.countOnly ? row.valB : `${row.valB}%`) : '-'}
        </span>
      </td>
      {/* Team B: W-L or count */}
      <td className="px-4 py-4 text-left bg-[#1a1d23] text-[12px] text-gray-500 whitespace-nowrap">
        {!row.countOnly && wlB}
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
  const timeoutA = rankings[teamAName]?.timeoutLosses ?? 0;
  const timeoutB = rankings[teamBName]?.timeoutLosses ?? 0;
  const retakeA = rankings[teamAName] ?? { retakeDe: 0, retakePl: 0 };
  const retakeB = rankings[teamBName] ?? { retakeDe: 0, retakePl: 0 };
  const ppA = rankings[teamAName] ?? { postPlantPl: 0, postPlantDe: 0 };
  const ppB = rankings[teamBName] ?? { postPlantPl: 0, postPlantDe: 0 };
  if (!teamBName) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        Choose Team B in the filters above to compare...
      </div>
    );
  }

  const swordLabel = (text: string) => (
    <span className="flex items-center justify-center gap-1.5">
      <Sword size={11} className="text-blue-400 shrink-0" />
      {text}
      <Sword size={11} className="text-blue-400 shrink-0" />
    </span>
  );
  const shieldLabel = (text: string) => (
    <span className="flex items-center justify-center gap-1.5">
      <Shield size={11} className="text-orange-400 shrink-0" />
      {text}
      <Shield size={11} className="text-orange-400 shrink-0" />
    </span>
  );

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
      label: swordLabel('Atk Side Winrate'), key: 'atk',
      valA: pct(aggA.attWins, aggA.attTotal),       winsA: aggA.attWins,    totalA: aggA.attTotal,
      valB: pct(aggB.attWins, aggB.attTotal),       winsB: aggB.attWins,    totalB: aggB.attTotal,
    },
    {
      label: swordLabel('Plant Rate ATK'), key: 'plantAtk',
      valA: pct(rankings[teamAName]?.postPlantPl ?? 0, rankings[teamAName]?.attTotal ?? 0),
      winsA: rankings[teamAName]?.postPlantPl ?? 0, totalA: rankings[teamAName]?.attTotal ?? 0,
      valB: pct(rankings[teamBName]?.postPlantPl ?? 0, rankings[teamBName]?.attTotal ?? 0),
      winsB: rankings[teamBName]?.postPlantPl ?? 0, totalB: rankings[teamBName]?.attTotal ?? 0,
    },
    {
      label: swordLabel('Post Plant WR'), key: 'postPlant',
      valA: pct(ppA.postPlantPl - ppA.postPlantDe, ppA.postPlantPl),
      winsA: ppA.postPlantPl - ppA.postPlantDe, totalA: ppA.postPlantPl,
      valB: pct(ppB.postPlantPl - ppB.postPlantDe, ppB.postPlantPl),
      winsB: ppB.postPlantPl - ppB.postPlantDe, totalB: ppB.postPlantPl,
    },
    {
      label: shieldLabel('Def Side Winrate'), key: 'def',
      valA: pct(aggA.defWins, aggA.defTotal),       winsA: aggA.defWins,    totalA: aggA.defTotal,
      valB: pct(aggB.defWins, aggB.defTotal),       winsB: aggB.defWins,    totalB: aggB.defTotal,
    },
    {
      label: shieldLabel('Plant Rate DEF'), key: 'plantDef',
      valA: pct(rankings[teamAName]?.retakePl ?? 0, rankings[teamAName]?.defTotal ?? 0),
      winsA: rankings[teamAName]?.retakePl ?? 0, totalA: rankings[teamAName]?.defTotal ?? 0,
      valB: pct(rankings[teamBName]?.retakePl ?? 0, rankings[teamBName]?.defTotal ?? 0),
      winsB: rankings[teamBName]?.retakePl ?? 0, totalB: rankings[teamBName]?.defTotal ?? 0,
      lowerIsBetter: true,
    },
    {
      label: shieldLabel('Retake Eff'), key: 'retake',
      valA: pct(retakeA.retakeDe, retakeA.retakePl), winsA: retakeA.retakeDe, totalA: retakeA.retakePl,
      valB: pct(retakeB.retakeDe, retakeB.retakePl), winsB: retakeB.retakeDe, totalB: retakeB.retakePl,
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
    {
      label: 'Timeout Losses', key: 'timeout',
      valA: timeoutA, winsA: timeoutA, totalA: timeoutA,
      valB: timeoutB, winsB: timeoutB, totalB: timeoutB,
      lowerIsBetter: true, countOnly: true,
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
