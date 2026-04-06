'use client';

import { useState } from 'react';
import { LongestMapEntry, TopPlayerPerformance } from '@/lib/types';

type MapSort = 'duration' | 'rounds';
type PerfSort = 'acs' | 'kills' | 'kd' | 'kast' | 'adr' | 'hs' | 'fkfd';

const PERF_SORT_LABELS: { key: PerfSort; label: string }[] = [
  { key: 'acs',   label: 'ACS' },
  { key: 'kills', label: 'Kills' },
  { key: 'kd',    label: 'K-D' },
  { key: 'kast',  label: 'KAST' },
  { key: 'adr',   label: 'ADR' },
  { key: 'hs',    label: 'HS' },
  { key: 'fkfd',  label: 'FK-FD' },
];

function fmt(n: number, decimals = 0) {
  return n.toFixed(decimals);
}

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RelevantInfoSection({
  maps,
  performances,
}: {
  maps: LongestMapEntry[];
  performances: TopPlayerPerformance[];
}) {
  const [mapSort, setMapSort]   = useState<MapSort>('duration');
  const [perfSort, setPerfSort] = useState<PerfSort>('acs');

  const toSeconds = (s: string): number => {
    const parts = s.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const sortedMaps = [...maps].sort((a, b) =>
    mapSort === 'rounds'
      ? b.rounds - a.rounds
      : toSeconds(b.duration) - toSeconds(a.duration)
  );

  const sortedPerfs = [...performances]
    .sort((a, b) => b[perfSort] - a[perfSort])
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-10">

      {/* ── TOP 3 LONGEST MAPS ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
            Top 5 Longest Maps
          </h2>
          <SortButtons<MapSort>
            options={[{ key: 'duration', label: 'Duration' }, { key: 'rounds', label: 'Rounds' }]}
            active={mapSort}
            onChange={setMapSort}
          />
        </div>

        {maps.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-widest bg-[#1a1d23] border-b border-gray-800">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3">Map</th>
                  <th className="px-4 py-3">OT</th>
                  <th className={`px-4 py-3 ${mapSort === 'rounds' ? 'text-blue-400' : ''}`}>Rounds</th>
                  <th className={`px-4 py-3 ${mapSort === 'duration' ? 'text-blue-400' : ''}`}>Duration</th>
                  <th className="px-4 py-3">Teams</th>
                  <th className="px-4 py-3">Tournament</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {sortedMaps.map((m, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1a1d23]/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-bold">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-100">{m.map}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{m.rounds > 24 ? (m.rounds - 24) / 2 : '—'}</td>
                    <td className={`px-4 py-3 font-mono ${mapSort === 'rounds' ? 'text-blue-400 font-semibold' : 'text-gray-300'}`}>{m.rounds || '—'}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${mapSort === 'duration' ? 'text-blue-400' : 'text-gray-300'}`}>{m.duration}</td>
                    <td className="px-4 py-3 text-gray-300">
                      <span className="text-gray-100 font-semibold">{m.teamA}</span>
                      <span className="text-gray-600 mx-1">vs</span>
                      <span className="text-gray-100 font-semibold">{m.teamB}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{m.event || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(m.date)}</td>
                    <td className="px-4 py-3 text-right">
                      {m.sourceUrl
                        ? <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-xs">VLR</a>
                        : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── TOP 5 PLAYER PERFORMANCES ── */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
            Top 5 Player Performances
          </h2>
          <SortButtons<PerfSort>
            options={PERF_SORT_LABELS}
            active={perfSort}
            onChange={setPerfSort}
          />
        </div>

        {performances.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-widest bg-[#1a1d23] border-b border-gray-800">
                  <th className="px-4 py-3 w-8">#</th>
                  <th className="px-4 py-3">Player</th>
                  {(['acs','kills','deaths','assists','kd','kast','adr','hs','fk','fd','fkfd'] as const).map(col => (
                    <th key={col} className={`px-3 py-3 text-right ${perfSort === col ? 'text-blue-400' : ''}`}>
                      {col === 'deaths' ? 'Dead' : col === 'kd' ? 'K-D' : col === 'fkfd' ? 'FK-FD' : col.toUpperCase()}
                    </th>
                  ))}
                  <th className="px-4 py-3">Map</th>
                  <th className="px-4 py-3">Tournament</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {sortedPerfs.map((p, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-[#1a1d23]/60 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-bold">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-100">{p.player}</div>
                      <div className="text-[11px] text-gray-500">{p.team}</div>
                    </td>
                    {(['acs','kills','deaths','assists','kd','kast','adr','hs','fk','fd','fkfd'] as const).map(col => {
                      const val = p[col];
                      const isActive = perfSort === col;
                      const display = col === 'kd' ? fmt(val, 2) : col === 'kast' ? `${fmt(val * 100, 0)}%` : col === 'hs' ? `${fmt(val * 100, 0)}%` : String(val);
                      return (
                        <td key={col} className={`px-3 py-3 text-right font-mono ${isActive ? 'text-blue-400 font-semibold' : 'text-gray-300'}`}>
                          {display}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-gray-400">{p.map || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{p.event || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">{fmtDate(p.date)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.sourceUrl
                        ? <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 text-xs">VLR</a>
                        : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}

function SortButtons<T extends string>({
  options,
  active,
  onChange,
}: {
  options: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-gray-700 overflow-hidden text-xs font-bold uppercase tracking-wider">
      {options.map(({ key, label }, i) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-gray-700' : ''} ${active === key ? 'bg-blue-600 text-white' : 'bg-[#1a1d23] text-gray-400 hover:text-gray-200'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center border-2 border-dashed border-gray-800 rounded-2xl text-gray-400">
      No data available.
    </div>
  );
}
