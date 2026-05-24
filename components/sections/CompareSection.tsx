'use client';

import { Fragment, useState } from 'react';
import { MapStat, MapCompositionStat } from '@/lib/types';

interface Props {
  statsA: MapStat[];
  statsB: MapStat[];
  compsA: MapCompositionStat[];
  compsB: MapCompositionStat[];
  agentImages: Record<string, string>;
  teamAName: string;
  teamBName: string;
}

const EMPTY: MapStat = {
  mapName: '', picks: 0, pick1: 0, pick2: 0, bans: 0, ban1: 0, ban2: 0, deciders: 0,
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

function CompositionIcons({
  composition,
  agentImages,
  players,
}: {
  composition: string;
  agentImages: Record<string, string>;
  players?: Record<string, string>;
}) {
  const agents = composition.split(', ').slice().sort((a, b) => {
    const pa = players?.[a] ?? '';
    const pb = players?.[b] ?? '';
    return pa.localeCompare(pb);
  });
  const allHaveIcons = agents.every(a => agentImages[a]);
  if (!allHaveIcons) {
    return <span className="text-gray-300 text-xs leading-snug">{composition}</span>;
  }
  return (
    <div className="flex gap-1">
      {agents.map((agent, i) => {
        const player = players?.[agent];
        return (
          <div key={i} className="flex flex-col items-center gap-0.5 min-w-[24px]">
            <img src={agentImages[agent]} alt={agent} title={agent} className="w-[24px] h-[24px] rounded" />
            {player && (
              <span className="text-[9.5px] text-gray-400 leading-none truncate max-w-[60px]" title={player}>
                {player}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function wrColor(v: number | null) {
  if (v === null) return 'text-gray-600';
  if (v >= 55) return 'text-green-400';
  if (v <= 45) return 'text-red-400';
  return 'text-gray-300';
}

function PctCell({ wins, total }: { wins: number; total: number }) {
  const v = pct(wins, total);
  if (v === null) return <span className="text-gray-700">-</span>;
  return (
    <div className="flex flex-col items-center">
      <span className={`text-[12px] font-bold ${wrColor(v)}`}>{v}%</span>
      <span className="text-[10.5px] text-gray-400">({wins}W - {total - wins}L)</span>
    </div>
  );
}

function formatDateDMY(raw?: string): string | null {
  if (!raw) return null;
  let d: number | null = null, m: number | null = null, y: number | null = null;
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) {
    const [datePart] = raw.split(/[T ]/);
    const parts = datePart.split('-');
    y = Number(parts[0]); m = Number(parts[1]); d = Number(parts[2]);
  } else {
    const [datePart] = raw.split(' ');
    const parts = datePart.split('/');
    if (parts.length === 3) {
      d = Number(parts[0]); m = Number(parts[1]); y = Number(parts[2]);
    }
  }
  if (!d || !m || !y) return null;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dd}-${mm}-${y}`;
}

function CompCells({
  c,
  agentImages,
  side,
}: {
  c: MapCompositionStat | null;
  agentImages: Record<string, string>;
  side: 'a' | 'b';
}) {
  const formattedDate = formatDateDMY(c?.lastPlayedDate);
  const link = c?.lastPlayedUrl ? (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <a
        href={c.lastPlayedUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={c.lastPlayedDate ? `Last played: ${c.lastPlayedDate}` : 'Last played'}
        className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 underline"
      >
        Last played
      </a>
      {formattedDate && (
        <span className="text-[10px] text-gray-500 leading-none">{formattedDate}</span>
      )}
    </div>
  ) : null;
  const linkCell = (
    <td className="p-2 text-center bg-[#252a33]">
      {link}
    </td>
  );
  const iconsCell = (
    <td colSpan={2} className="p-2 bg-[#252a33]">
      {c ? (
        <div className="flex items-center justify-center gap-2">
          <CompositionIcons composition={c.composition} agentImages={agentImages} players={c.players} />
          <span className="text-gray-500 text-xs shrink-0">({c.played})</span>
        </div>
      ) : (
        <div className="text-center text-gray-700">—</div>
      )}
    </td>
  );
  const atkCell = (
    <td className="p-2 text-center bg-[#252a33]">
      {c ? <PctCell wins={c.attWins} total={c.attTotal} /> : <span className="text-gray-700">-</span>}
    </td>
  );
  const defCell = (
    <td className="p-2 text-center bg-[#252a33]">
      {c ? <PctCell wins={c.defWins} total={c.defTotal} /> : <span className="text-gray-700">-</span>}
    </td>
  );
  const wrCell = (
    <td className="p-2 text-center bg-[#252a33]">
      {c ? <PctCell wins={c.wins} total={c.played} /> : <span className="text-gray-700">-</span>}
    </td>
  );
  if (side === 'a') {
    return (
      <>
        {linkCell}
        {iconsCell}
        {atkCell}
        {defCell}
        {wrCell}
      </>
    );
  }
  return (
    <>
      {wrCell}
      {defCell}
      {atkCell}
      {iconsCell}
      {linkCell}
    </>
  );
}

export function CompareSection({ statsA, statsB, compsA, compsB, agentImages, teamAName, teamBName }: Props) {
  const [expandedMap, setExpandedMap] = useState<string | null>(null);

  // Build joined map index
  const mapIndex: Record<string, { a: MapStat | null; b: MapStat | null }> = {};
  statsA.forEach(s => { mapIndex[s.mapName] = { a: s, b: null }; });
  statsB.forEach(s => {
    if (!mapIndex[s.mapName]) mapIndex[s.mapName] = { a: null, b: s };
    else mapIndex[s.mapName].b = s;
  });
  const rows = Object.entries(mapIndex).sort(([a], [b]) => a.localeCompare(b));

  const compsAByMap: Record<string, MapCompositionStat[]> = {};
  for (const c of compsA) {
    if (!compsAByMap[c.map]) compsAByMap[c.map] = [];
    compsAByMap[c.map].push(c);
  }
  const compsBByMap: Record<string, MapCompositionStat[]> = {};
  for (const c of compsB) {
    if (!compsBByMap[c.map]) compsBByMap[c.map] = [];
    compsBByMap[c.map].push(c);
  }

  const th = 'p-3 text-center border-b border-gray-800 sticky top-[48px] z-10';

  return (
    <div>
      {!teamBName ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Choose Team B in the filters above to compare...
        </div>
      ) : (
        <div className="bg-[#1a1d23] rounded-xl shadow-2xl border border-gray-800">
          <div>
            <table className="w-full text-left border-collapse text-[13.8px]">
              <thead className="bg-[#0f1115] text-gray-400 text-[11.5px] uppercase tracking-widest">
                {/* Team name labels */}
                <tr>
                  <th colSpan={6} className="sticky top-0 z-20 bg-[#0f1115] py-2 text-center text-blue-300 border-b border-gray-700 font-bold tracking-wider text-[23px]">
                    {teamAName}
                  </th>
                  <th className="sticky top-0 z-20 bg-[#0f1115] py-2 border-b border-gray-700" />
                  <th colSpan={6} className="sticky top-0 z-20 bg-[#0f1115] py-2 text-center text-orange-300 border-b border-gray-700 font-bold tracking-wider text-[23px]">
                    {teamBName}
                  </th>
                </tr>
                {/* Column headers */}
                <tr>
                  {/* Team A side */}
                  <th className={`${th} bg-[#141D38] text-blue-400`}>Decider</th>
                  <th className={`${th} bg-[#11251C] text-green-400`}>
                    <div>Picks <span className="text-[10.5px] text-green-600 normal-case font-normal">(1st / 2nd)</span></div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Pick · Rival</div>
                  </th>
                  <th className={`${th} bg-[#311517] text-red-400`}>
                    <div>Bans <span className="text-[10.5px] text-red-700 normal-case font-normal">(1st / 2nd)</span></div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Ban · Rival</div>
                  </th>
                  <th className={`${th} bg-[#701330]`}>Atk Side</th>
                  <th className={`${th} bg-[#15542E]`}>Def Side</th>
                  <th className={`${th} bg-[#111723]`}>Winrate</th>
                  {/* Map center */}
                  <th className="p-3 text-center border-b border-gray-800 bg-[#252a33] text-white font-bold min-w-[120px] sticky top-[48px] z-10">
                    <div>Map</div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Click a map to expand</div>
                  </th>
                  {/* Team B side (mirrored) */}
                  <th className={`${th} bg-[#111723]`}>Winrate</th>
                  <th className={`${th} bg-[#15542E]`}>Def Side</th>
                  <th className={`${th} bg-[#701330]`}>Atk Side</th>
                  <th className={`${th} bg-[#311517] text-red-400`}>
                    <div>Bans <span className="text-[10.5px] text-red-700 normal-case font-normal">(1st / 2nd)</span></div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Ban · Rival</div>
                  </th>
                  <th className={`${th} bg-[#11251C] text-green-400`}>
                    <div>Picks <span className="text-[10.5px] text-green-600 normal-case font-normal">(1st / 2nd)</span></div>
                    <div className="text-[10.5px] text-gray-500 normal-case font-normal">Pick · Rival</div>
                  </th>
                  <th className={`${th} bg-[#141D38] text-blue-400`}>Decider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map(([mapName, { a, b }]) => {
                  const sa = a ?? EMPTY;
                  const sb = b ?? EMPTY;
                  const isExpanded = expandedMap === mapName;
                  return (
                    <Fragment key={mapName}>
                      <tr
                        onClick={() => setExpandedMap(prev => prev === mapName ? null : mapName)}
                        className={`transition-colors cursor-pointer ${isExpanded ? 'bg-[#252a33]' : 'hover:bg-[#252a33]'}`}
                      >
                        {/* Team A */}
                        <td className="p-3 text-center text-blue-400 font-bold bg-blue-900/10">
                          {sa.deciders || <span className="text-gray-600">-</span>}
                        </td>
                        <td className="p-3 text-center bg-green-900/10">
                          <div className="font-bold text-green-400">
                            {sa.picks}{sa.picks > 0 && <span className="font-normal text-green-600 ml-1">({sa.pick1}/{sa.pick2})</span>}
                          </div>
                          <div className="text-[11.5px] text-gray-500">{sa.rivalPicks}</div>
                        </td>
                        <td className="p-3 text-center bg-red-900/10">
                          <div className="font-bold text-red-400">
                            {sa.bans}{sa.bans > 0 && <span className="font-normal text-red-700 ml-1">({sa.ban1}/{sa.ban2})</span>}
                          </div>
                          <div className="text-[11.5px] text-gray-500">{sa.rivalBans}</div>
                        </td>
                        <td className="p-3 text-center">
                          <SideCell wins={sa.attWins} total={sa.attTotal} />
                        </td>
                        <td className="p-3 text-center">
                          <SideCell wins={sa.defWins} total={sa.defTotal} />
                        </td>
                        <td className="p-3 text-center">
                          <WrCell wins={sa.wins} played={sa.played} />
                        </td>

                        {/* Map name (center) */}
                        <td className="p-3 text-center font-bold text-white bg-[#252a33]">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-gray-500 text-[23px]">{isExpanded ? '▾' : '▸'}</span>
                            <span>{mapName}</span>
                          </div>
                        </td>

                        {/* Team B (mirrored) */}
                        <td className="p-3 text-center">
                          <WrCell wins={sb.wins} played={sb.played} />
                        </td>
                        <td className="p-3 text-center">
                          <SideCell wins={sb.defWins} total={sb.defTotal} />
                        </td>
                        <td className="p-3 text-center">
                          <SideCell wins={sb.attWins} total={sb.attTotal} />
                        </td>
                        <td className="p-3 text-center bg-red-900/10">
                          <div className="font-bold text-red-400">
                            {sb.bans}{sb.bans > 0 && <span className="font-normal text-red-700 ml-1">({sb.ban1}/{sb.ban2})</span>}
                          </div>
                          <div className="text-[11.5px] text-gray-500">{sb.rivalBans}</div>
                        </td>
                        <td className="p-3 text-center bg-green-900/10">
                          <div className="font-bold text-green-400">
                            {sb.picks}{sb.picks > 0 && <span className="font-normal text-green-600 ml-1">({sb.pick1}/{sb.pick2})</span>}
                          </div>
                          <div className="text-[11.5px] text-gray-500">{sb.rivalPicks}</div>
                        </td>
                        <td className="p-3 text-center text-blue-400 font-bold bg-blue-900/10">
                          {sb.deciders || <span className="text-gray-600">-</span>}
                        </td>
                      </tr>
                      {isExpanded && (() => {
                        const aComps = compsAByMap[mapName] ?? [];
                        const bComps = compsBByMap[mapName] ?? [];
                        const n = Math.max(aComps.length, bComps.length);
                        if (n === 0) {
                          return (
                            <tr className="bg-[#252a33] border-y border-gray-800">
                              <td colSpan={13} className="p-4 text-center text-gray-600 text-sm italic">No composition data</td>
                            </tr>
                          );
                        }
                        return Array.from({ length: n }).map((_, i) => {
                          const a = aComps[i] ?? null;
                          const b = bComps[i] ?? null;
                          return (
                            <tr
                              key={`${mapName}-exp-${i}`}
                              className={`bg-[#252a33] ${i === 0 ? 'border-t-2 border-t-gray-700' : ''} ${i === n - 1 ? 'border-b-2 border-b-gray-700' : ''}`}
                            >
                              <CompCells c={a} agentImages={agentImages} side="a" />
                              <td className="bg-[#252a33]" />
                              <CompCells c={b} agentImages={agentImages} side="b" />
                            </tr>
                          );
                        });
                      })()}
                    </Fragment>
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
