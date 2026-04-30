'use client';

import { useMemo, useState } from 'react';
import { KPICard } from '@/components/KPICard';
import { SearchableSelect } from '@/components/SearchableSelect';
import { StringMultiSelect } from '@/components/StringMultiSelect';
import { SimulationRow } from '@/lib/types';

interface Props {
  scenarios: SimulationRow[];
}

const MATCH_KEYS = [
  'week1_match_1', 'week1_match_2', 'week1_match_3',
  'week2_match_1', 'week2_match_2', 'week2_match_3',
] as const;
type MatchKey = typeof MATCH_KEYS[number];

const POS_KEYS = ['pos1', 'pos2', 'pos3', 'pos4', 'pos5', 'pos6'] as const;

const MATCH_LABEL: Record<MatchKey, string> = {
  week1_match_1: 'Match 1',
  week1_match_2: 'Match 2',
  week1_match_3: 'Match 3',
  week2_match_1: 'Match 1',
  week2_match_2: 'Match 2',
  week2_match_3: 'Match 3',
};

const WEEK1_KEYS: MatchKey[] = ['week1_match_1', 'week1_match_2', 'week1_match_3'];
const WEEK2_KEYS: MatchKey[] = ['week2_match_1', 'week2_match_2', 'week2_match_3'];

function parseMatchup(value: string): { teamA: string; score: string; teamB: string } | null {
  const m = value.match(/^(.+?)_(\d-\d)_(.+)$/);
  if (!m) return null;
  return { teamA: m[1], score: m[2], teamB: m[3] };
}

function matchTeams(rows: SimulationRow[], key: MatchKey): { teamA: string; teamB: string } {
  const sample = rows[0]?.[key];
  if (!sample) return { teamA: '', teamB: '' };
  const p = parseMatchup(sample);
  return p ? { teamA: p.teamA, teamB: p.teamB } : { teamA: '', teamB: '' };
}

function uniqueValues(rows: SimulationRow[], key: MatchKey): string[] {
  return Array.from(new Set(rows.map(r => r[key]))).sort();
}

function teamsFromRows(rows: SimulationRow[]): string[] {
  if (rows.length === 0) return [];
  const set = new Set<string>();
  for (const k of POS_KEYS) set.add(rows[0][k]);
  return Array.from(set).sort();
}

function heatmapBg(pct: number): string {
  if (pct === 0) return 'rgba(31,41,55,0.4)';
  const t = Math.min(1, Math.max(0, pct / 100));
  const hue = 220 - t * 80;
  const sat = 55;
  const light = 18 + t * 28;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

const EMPTY_PER_MATCH: Record<MatchKey, string[]> = {
  week1_match_1: [], week1_match_2: [], week1_match_3: [],
  week2_match_1: [], week2_match_2: [], week2_match_3: [],
};

export function PlayoffPctSection({ scenarios }: Props) {
  const [regionPick, setRegionPick] = useState<string>('');
  const [tournamentPick, setTournamentPick] = useState<string>('');
  const [groupPick, setGroupPick] = useState<string>('');
  const [perMatch, setPerMatch] = useState<Record<MatchKey, string[]>>(() => ({ ...EMPTY_PER_MATCH }));
  const [team, setTeam] = useState<string>('');
  const [positions, setPositions] = useState<string[]>([]);

  const regions = useMemo(
    () => Array.from(new Set(scenarios.map(r => r.region))).sort(),
    [scenarios]
  );

  const region = regionPick && regions.includes(regionPick) ? regionPick : (regions[0] ?? '');

  const tournaments = useMemo(() => {
    if (!region) return [];
    return Array.from(
      new Set(scenarios.filter(r => r.region === region).map(r => r.tournament))
    ).sort();
  }, [scenarios, region]);

  const tournament = tournamentPick && tournaments.includes(tournamentPick) ? tournamentPick : (tournaments[0] ?? '');

  const groups = useMemo(() => {
    if (!region || !tournament) return [];
    return Array.from(
      new Set(
        scenarios
          .filter(r => r.region === region && r.tournament === tournament)
          .map(r => r.group)
      )
    ).sort();
  }, [scenarios, region, tournament]);

  const group = groupPick && groups.includes(groupPick) ? groupPick : (groups[0] ?? '');

  const slice = useMemo(
    () => scenarios.filter(r => r.region === region && r.tournament === tournament && r.group === group),
    [scenarios, region, tournament, group]
  );

  function resetDownstreamFilters() {
    setPerMatch({ ...EMPTY_PER_MATCH });
    setTeam('');
    setPositions([]);
  }

  function changeRegion(v: string) {
    if (v === region) return;
    setRegionPick(v);
    setTournamentPick('');
    setGroupPick('');
    resetDownstreamFilters();
  }

  function changeTournament(v: string) {
    if (v === tournament) return;
    setTournamentPick(v);
    setGroupPick('');
    resetDownstreamFilters();
  }

  function changeGroup(v: string) {
    if (v === group) return;
    setGroupPick(v);
    resetDownstreamFilters();
  }

  const teams = useMemo(() => teamsFromRows(slice), [slice]);
  const matchTeamsByKey = useMemo(() => {
    const out = {} as Record<MatchKey, { teamA: string; teamB: string }>;
    for (const k of MATCH_KEYS) out[k] = matchTeams(slice, k);
    return out;
  }, [slice]);

  const matchOptions = useMemo(() => {
    const out = {} as Record<MatchKey, string[]>;
    for (const k of MATCH_KEYS) out[k] = uniqueValues(slice, k);
    return out;
  }, [slice]);

  const filtered = useMemo(() => {
    return slice.filter(row => {
      for (const k of MATCH_KEYS) {
        const sel = perMatch[k];
        if (sel.length > 0 && !sel.includes(row[k])) return false;
      }
      if (team && positions.length > 0) {
        const teamPos = POS_KEYS.find(p => row[p] === team);
        if (!teamPos) return false;
        const posIdx = (Number(teamPos.replace('pos', ''))).toString();
        if (!positions.includes(posIdx)) return false;
      }
      return true;
    });
  }, [slice, perMatch, team, positions]);

  const total = filtered.length;

  const firstPlaceCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of teams) out[t] = 0;
    for (const r of filtered) out[r.pos1] = (out[r.pos1] ?? 0) + 1;
    return out;
  }, [filtered, teams]);

  const bestPosByTeam = useMemo(() => {
    const out: Record<string, { pos: number; count: number } | null> = {};
    for (const t of teams) {
      let best: { pos: number; count: number } | null = null;
      const counts = [0, 0, 0, 0, 0, 0];
      for (const r of filtered) {
        const idx = POS_KEYS.findIndex(p => r[p] === t);
        if (idx >= 0) counts[idx]++;
      }
      for (let i = 0; i < counts.length; i++) {
        if (counts[i] > 0) { best = { pos: i + 1, count: counts[i] }; break; }
      }
      out[t] = best;
    }
    return out;
  }, [filtered, teams]);

  const teamPositionDistribution = useMemo(() => {
    if (!team) return null;
    const counts = [0, 0, 0, 0, 0, 0];
    for (const r of filtered) {
      const idx = POS_KEYS.findIndex(p => r[p] === team);
      if (idx >= 0) counts[idx]++;
    }
    return counts;
  }, [filtered, team]);

  const heatmap = useMemo(() => {
    const matrix: Record<string, number[]> = {};
    for (const t of teams) matrix[t] = [0, 0, 0, 0, 0, 0];
    for (const r of filtered) {
      for (let i = 0; i < POS_KEYS.length; i++) {
        const t = r[POS_KEYS[i]];
        if (matrix[t]) matrix[t][i]++;
      }
    }
    return matrix;
  }, [filtered, teams]);

  const sortedTeamsByFirst = useMemo(() => {
    return [...teams].sort((a, b) => (firstPlaceCounts[b] ?? 0) - (firstPlaceCounts[a] ?? 0));
  }, [teams, firstPlaceCounts]);

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 10000) / 100 : 0;
  const fmt = (n: number) => n.toFixed(2);

  function resetFilters() {
    setPerMatch({ ...EMPTY_PER_MATCH });
    setTeam('');
    setPositions([]);
  }

  const hasAnyFilter =
    Object.values(perMatch).some(v => v.length > 0) || !!team || positions.length > 0;

  if (scenarios.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400 m-4">
        No simulation data available.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tournament selection</p>
        <div className="flex flex-wrap gap-3 items-end">
          <SearchableSelect
            label="Region"
            options={regions}
            selected={region}
            onChange={changeRegion}
            placeholder="Select region"
          />
          <SearchableSelect
            label="Tournament"
            options={tournaments}
            selected={tournament}
            onChange={changeTournament}
            placeholder="Select tournament"
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Group</label>
            <div className="flex items-center gap-2">
              {groups.map(g => (
                <button
                  key={g}
                  onClick={() => changeGroup(g)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${group === g ? 'bg-blue-600 text-white' : 'bg-[#1a1d23] text-gray-400 hover:text-gray-200 border border-gray-800'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-gray-400">
            {total.toLocaleString()} / {slice.length.toLocaleString()} scenarios
          </span>
          {hasAnyFilter && (
            <button
              onClick={resetFilters}
              className="text-[10px] font-bold text-red-400 hover:underline uppercase tracking-widest"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-4 flex flex-col gap-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Match results</p>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-2">Week 4</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {WEEK1_KEYS.map(k => {
              const tt = matchTeamsByKey[k];
              return (
                <StringMultiSelect
                  key={k}
                  label={`${MATCH_LABEL[k]} — ${tt.teamA} vs ${tt.teamB}`}
                  options={matchOptions[k]}
                  selected={perMatch[k]}
                  onChange={(vals) => setPerMatch(prev => ({ ...prev, [k]: vals }))}
                  placeholder="All results"
                  selectedLabel={(n) => `${n} result${n === 1 ? '' : 's'}`}
                  renderOption={(opt) => {
                    const p = parseMatchup(opt);
                    return p ? `${p.teamA} ${p.score} ${p.teamB}` : opt;
                  }}
                />
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-2">Week 5</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {WEEK2_KEYS.map(k => {
              const tt = matchTeamsByKey[k];
              return (
                <StringMultiSelect
                  key={k}
                  label={`${MATCH_LABEL[k]} — ${tt.teamA} vs ${tt.teamB}`}
                  options={matchOptions[k]}
                  selected={perMatch[k]}
                  onChange={(vals) => setPerMatch(prev => ({ ...prev, [k]: vals }))}
                  placeholder="All results"
                  selectedLabel={(n) => `${n} result${n === 1 ? '' : 's'}`}
                  renderOption={(opt) => {
                    const p = parseMatchup(opt);
                    return p ? `${p.teamA} ${p.score} ${p.teamB}` : opt;
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <SearchableSelect
          label="Team"
          options={teams}
          selected={team}
          onChange={(v) => { setTeam(v); if (!v) setPositions([]); }}
          placeholder="All teams"
        />
        <StringMultiSelect
          label="Position"
          options={['1', '2', '3', '4', '5', '6']}
          selected={positions}
          onChange={setPositions}
          disabled={!team}
          placeholder={team ? 'All positions' : 'Pick a team first'}
          selectedLabel={(n) => `${n} position${n === 1 ? '' : 's'}`}
          renderOption={(opt) => `P${opt}`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {team && teamPositionDistribution
          ? POS_KEYS.map((_, i) => {
              const count = teamPositionDistribution[i];
              const p = pct(count);
              const variant = i === 0 && count > 0 ? 'success' : count === 0 ? 'danger' : 'neutral';
              return (
                <KPICard
                  key={i}
                  title={`${team} · P${i + 1}`}
                  value={total > 0 ? `${fmt(p)}%` : '-'}
                  label={`${count} / ${total}`}
                  variant={variant}
                />
              );
            })
          : sortedTeamsByFirst.map((t, idx) => {
              const count = firstPlaceCounts[t] ?? 0;
              const p = pct(count);
              if (count === 0) {
                const best = bestPosByTeam[t];
                return (
                  <KPICard
                    key={t}
                    title={t}
                    value={best ? `Best P${best.pos}` : '—'}
                    label={best ? `${fmt(pct(best.count))}% (${best.count} / ${total})` : '0 scenarios'}
                    variant="danger"
                  />
                );
              }
              const variant = idx === 0 ? 'success' : 'neutral';
              return (
                <KPICard
                  key={t}
                  title={t}
                  value={total > 0 ? `${fmt(p)}%` : '-'}
                  label={`${count} / ${total}`}
                  variant={variant}
                />
              );
            })}
      </div>

      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
        <div className="p-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-300">Position distribution</p>
          <p className="text-[10px] text-gray-500">% of {total.toLocaleString()} scenarios</p>
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-[#0f1115] text-gray-400 text-[11px] uppercase tracking-widest">
            <tr>
              <th className="p-3 border-b border-gray-800">Team</th>
              {[1, 2, 3, 4, 5, 6].map(p => (
                <th key={p} className="p-3 text-center border-b border-gray-800">P{p}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sortedTeamsByFirst.map(t => (
              <tr key={t}>
                <td className="p-3 font-bold text-white bg-[#1a1d23]">{t}</td>
                {heatmap[t].map((count, i) => {
                  const p = pct(count);
                  return (
                    <td
                      key={i}
                      className="text-center p-3 align-middle"
                      style={{ backgroundColor: heatmapBg(p) }}
                    >
                      <div className="text-sm font-bold text-white">{fmt(p)}%</div>
                      <div className="text-[10px] text-gray-300/80">{count}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {team && positions.length > 0 && (
        <div className="bg-[#1a1d23] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-3 border-b border-gray-800 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-300">
              Scenarios where {team} finishes {positions.map(p => `P${p}`).join(' / ')}
            </p>
            <p className="text-[10px] text-gray-500">{filtered.length.toLocaleString()} rows</p>
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#0f1115] text-gray-400 text-[10px] uppercase tracking-widest sticky top-0">
                <tr>
                  <th className="p-2 border-b border-gray-800 text-center">#</th>
                  {MATCH_KEYS.map(k => (
                    <th key={k} className="p-2 border-b border-gray-800 text-center">{MATCH_LABEL[k]}</th>
                  ))}
                  <th className="p-2 border-b border-gray-800 text-center text-blue-400">Pos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map((row, idx) => {
                  const teamPosKey = POS_KEYS.find(p => row[p] === team);
                  const teamPos = teamPosKey ? Number(teamPosKey.replace('pos', '')) : null;
                  return (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-[#1a1d23]' : 'bg-[#161920]'}>
                      <td className="p-2 text-center text-gray-500">{idx + 1}</td>
                      {MATCH_KEYS.map(k => {
                        const p = parseMatchup(row[k]);
                        return (
                          <td key={k} className="p-2 text-center text-gray-200 font-mono">
                            {p ? (
                              <>
                                <span className={p.score.startsWith('2') ? 'text-emerald-400 font-bold' : 'text-gray-500'}>{p.teamA}</span>
                                <span className="mx-1 text-gray-400">{p.score}</span>
                                <span className={p.score.endsWith('2') && !p.score.startsWith('2') ? 'text-emerald-400 font-bold' : 'text-gray-500'}>{p.teamB}</span>
                              </>
                            ) : row[k]}
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-bold text-blue-400">P{teamPos}</td>
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
