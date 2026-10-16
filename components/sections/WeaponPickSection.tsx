'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { STATS_RANK_DEFAULT_TEAMS, WeaponPickBank, WeaponPickCost, WeaponPickData, WeaponPickLoadout, WeaponPickRound } from '@/lib/types';
import { useNavigation } from '../NavigationContext';
import { useUrlSet } from '@/hooks/useUrlSet';
import { TeamChipsPanel } from '../TeamChipsPanel';
import { Tooltip } from '../Tooltip';

interface Props {
  stats: WeaponPickData['stats'] | null;
  maps: string[];
  teamLogos?: Record<string, string>;
  teamRegions?: Record<string, string>;
  mapImages?: Record<string, string>;
  hasTour?: boolean;
  defaultHiddenMaps?: string[];
}

type Side = 'all' | 'atk' | 'def';
const SIDES: { key: Side; label: string }[] = [
  { key: 'all', label: 'Both' },
  { key: 'atk', label: 'ATK' },
  { key: 'def', label: 'DEF' },
];

const TOP_LOADOUTS = 5;

// Armor filter, read from the armor part of the loadout key: "5 Heavy", "5 Light", "5 None" or anything else
type Armor = 'all' | 'heavy' | 'light' | 'mixed' | 'none';
// icons (public/weapons) replace the text in the chip box; several are shown small side by side
const ARMORS: { key: Armor; label: string; short: string; icons?: string[] }[] = [
  { key: 'all', label: 'All', short: 'ALL' },
  { key: 'heavy', label: 'Heavy', short: '5H', icons: ['/weapons/heavy.png'] },
  { key: 'light', label: 'Light', short: '5L', icons: ['/weapons/light.png'] },
  { key: 'mixed', label: 'Mixed', short: 'MIX', icons: ['/weapons/heavy.png', '/weapons/regen.png', '/weapons/light.png'] },
  { key: 'none', label: 'None', short: '0' },
];
function armorOf(loadout: string): Armor {
  const armor = loadout.split(' · ')[1];
  return armor === '5 Heavy' ? 'heavy' : armor === '5 Light' ? 'light' : armor === '5 None' ? 'none' : 'mixed';
}

// Merge armors: Heavy, Regen and Light count as "Armor", e.g. "3 Heavy + Light + None" -> "4 Armor + None"
function mergeArmor(loadout: string): string {
  const [weapons, armor] = loadout.split(' · ');
  let withArmor = 0, without = 0;
  for (const part of armor.split(' + ')) {
    const [n, type] = part.includes(' ') ? [Number(part.split(' ')[0]), part.split(' ')[1]] : [1, part];
    if (type === 'None') without += n; else withArmor += n;
  }
  const fmt = (n: number, k: string) => n > 1 ? `${n} ${k}` : k;
  const merged = [withArmor && fmt(withArmor, 'Armor'), without && fmt(without, 'None')].filter(Boolean).join(' + ');
  return `${weapons} · ${merged}`;
}

// Team loadout value (same bins as Economy) and team bank left after buying
type Cost = 'all' | Exclude<WeaponPickCost, 'na'>;
const COSTS: { key: Cost; label: string; short: string }[] = [
  { key: 'all', label: 'All', short: 'ALL' },
  { key: 'eco', label: 'Eco', short: '<5k' },
  { key: 'semiEco', label: 'Semi-eco', short: '5–15k' },
  { key: 'semiBuy', label: 'Semi-buy', short: '15–20k' },
  { key: 'fullBuy', label: 'Full buy', short: '20k+' },
];
type Bank = 'all' | Exclude<WeaponPickBank, 'na'>;
const BANKS: { key: Bank; label: string; short: string }[] = [
  { key: 'all', label: 'All', short: 'ALL' },
  { key: 'b0', label: '<2k', short: '<2k' },
  { key: 'b2', label: '2–6k', short: '2–6k' },
  { key: 'b6', label: '6–10k', short: '6–10k' },
  { key: 'b10', label: '10k+', short: '10k+' },
];
type RoundGroup = 'all' | Exclude<WeaponPickRound, 'other'>;
const ROUNDS: { key: RoundGroup; label: string; short: string }[] = [
  { key: 'all', label: 'All', short: 'ALL' },
  { key: 'r1', label: 'R1 + R13', short: '1·13' },
  { key: 'r3', label: 'R3 + R15', short: '3·15' },
];

// "12.3k"
function money(sum: number, n: number): string {
  return n > 0 ? `${(sum / n / 1000).toFixed(1)}k` : '—';
}

const LEGEND = (
  <div className="flex flex-col gap-1.5 text-[12px] leading-snug max-w-[360px]">
    <p><b>Loadout</b>: what the 5 players hold at the start of the round (bought, kept or dropped), weapons by category plus armor.</p>
    <p><b>Rifle</b> Vandal, Phantom · <b>SMG</b> Spectre, Stinger · <b>Shotgun</b> Bucky, Judge · <b>Pistol</b> Shorty, Frenzy, Ghost.</p>
    <p>On their own: Bulldog, Guardian, Op, Outlaw, Marshal, Odin, Ares, Sheriff, Bandit, Classic.</p>
    <p>After the ·, armor: <b>Heavy</b>, <b>Regen</b>, <b>Light</b> shields or <b>None</b>.</p>
    <p>Armor filter: <b>Heavy</b> all 5 with Heavy · <b>Light</b> all 5 with Light · <b>None</b> all 5 without armor · <b>Mixed</b> anything else. With a filter on, % is over the rounds that pass it.</p>
    <p><b>Cost</b>: the team&apos;s loadout value that round (what the 5 hold, kept items included), same ranges as Economy. <b>Bank</b>: the team&apos;s money left after buying. Rounds without economy data only show with both on All.</p>
    <p><b>Merge armors</b>: Heavy, Regen and Light count as <b>Armor</b>, so loadouts only split by how many players have armor or <b>None</b>.</p>
    <p><b>Round</b>: only the rounds picked, <b>R1 + R13</b> (pistols) or <b>R3 + R15</b>.</p>
    <p><b>Rounds</b>: rounds the team fielded that loadout. <b>%</b>: of the team&apos;s rounds on the visible maps and side. <b>WR</b>: rounds won with it. <b>Cost</b> / <b>Bank</b>: averages over its rounds. <b>Enemy loadout</b>: the rival&apos;s average loadout value in those rounds.</p>
  </div>
);

// Same palette as Operator Use
function heatmapBg(pct: number | null): string {
  if (pct === null) return 'transparent';
  const t = Math.min(1, Math.max(0, pct / 100));
  return `hsl(${220 - t * 80}, 55%, ${18 + t * 28}%)`;
}

export function WeaponPickSection({ stats, maps, teamLogos = {}, teamRegions = {}, mapImages = {}, hasTour = false, defaultHiddenMaps = [] }: Props) {
  const { navigate } = useNavigation();
  const [side, setSide] = useState<Side>('all');
  const [showAll, setShowAll] = useState<Set<string>>(new Set());
  const [armor, setArmor] = useState<Armor>('all');
  const [cost, setCost] = useState<Cost>('all');
  const [bank, setBank] = useState<Bank>('all');
  const [round, setRound] = useState<RoundGroup>('all');
  const [mergeArmors, setMergeArmors] = useState(false);

  const allTeams = Object.keys(stats ?? {}).sort();
  const [selectedTeams, setSelectedTeams] = useUrlSet('teams', allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t)));
  const teams = allTeams.filter(t => selectedTeams.has(t));

  // Hidden maps filter which rounds are summed per team
  const [hiddenMaps, setHiddenMaps] = useUrlSet('hideMaps', maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase())));
  const visibleMaps = maps.filter(m => !hiddenMaps.has(m));

  function toggleMap(map: string) {
    setHiddenMaps(prev => {
      const next = new Set(prev);
      if (next.has(map)) next.delete(map); else next.add(map);
      return next;
    });
  }

  function toggleShowAll(team: string) {
    setShowAll(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  }

  function resetFilters() {
    setSelectedTeams(new Set(allTeams.filter(t => STATS_RANK_DEFAULT_TEAMS.includes(t))));
    setHiddenMaps(new Set(maps.filter(m => defaultHiddenMaps.includes(m.toLowerCase()))));
    setSide('all');
    setArmor('all');
    setCost('all');
    setBank('all');
    setRound('all');
    setMergeArmors(false);
    setShowAll(new Set());
    navigate('?section=weapon-pick');
  }

  if (allTeams.length === 0 || maps.length === 0) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        {hasTour ? 'No buy data for the selected filters' : 'Select a tournament to see weapon picks...'}
      </div>
    );
  }

  // A team's loadouts summed over the visible maps and the chosen side, most fielded first
  function teamLoadouts(team: string): [string, WeaponPickLoadout][] {
    const tot: Record<string, WeaponPickLoadout> = {};
    for (const m of visibleMaps) {
      const s = stats?.[team]?.[m];
      if (!s) continue;
      for (const sd of side === 'all' ? (['atk', 'def'] as const) : [side]) {
        for (const [key, lo] of Object.entries(s[sd])) {
          // key is `${loadout}|${cost}|${bank}|${round}`
          const [loadout, c, b, r] = key.split('|');
          if (armor !== 'all' && armorOf(loadout) !== armor) continue;
          if (cost !== 'all' && c !== cost) continue;
          if (bank !== 'all' && b !== bank) continue;
          if (round !== 'all' && r !== round) continue;
          const t = (tot[mergeArmors ? mergeArmor(loadout) : loadout] ??= { rounds: 0, decided: 0, wins: 0, valued: 0, costSum: 0, bankSum: 0, enemyValued: 0, enemyCostSum: 0 });
          t.rounds += lo.rounds; t.decided += lo.decided; t.wins += lo.wins;
          t.valued += lo.valued; t.costSum += lo.costSum; t.bankSum += lo.bankSum;
          t.enemyValued += lo.enemyValued; t.enemyCostSum += lo.enemyCostSum;
        }
      }
    }
    return Object.entries(tot).sort((a, b) => b[1].rounds - a[1].rounds || a[0].localeCompare(b[0]));
  }

  const chipCls = (active: boolean) => `px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${
    active
      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
      : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
  }`;

  // Single-select chips with a 50×40 box, like the map chips
  function chipGroup<K extends string>(title: string, opts: { key: K; label: string; short: string; icons?: string[] }[], value: K, set: (k: K) => void) {
    return (
      <div className="flex flex-col gap-2">
        <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">{title}</span>
        <div className="flex gap-2 px-1">
          {opts.map(({ key, label, short, icons }) => {
            const active = value === key;
            return (
              <button
                key={key}
                onClick={() => set(key)}
                className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                  active
                    ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                    : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                }`}
              >
                <div className="w-[50px] h-[40px] rounded shrink-0 flex items-center justify-center gap-0.5 bg-[#252a33] text-gray-400 normal-case">
                  {icons
                    ? icons.map(src => (
                        <img
                          key={src}
                          src={src}
                          alt=""
                          className={`${icons.length > 1 ? 'w-[15px] h-[15px]' : 'w-[30px] h-[30px]'} object-contain transition-opacity ${active ? '' : 'opacity-50'}`}
                        />
                      ))
                    : short}
                </div>
                <span className="whitespace-nowrap">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Filters: teams on the left + maps on the right */}
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <TeamChipsPanel
          allTeams={allTeams}
          selectedTeams={selectedTeams}
          setSelectedTeams={setSelectedTeams}
          teamLogos={teamLogos}
          teamRegions={teamRegions}
        />

        <div className="flex flex-col gap-2">
          <span className="px-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">Maps</span>
          <div className="flex gap-2 px-1 overflow-x-auto">
            {maps.map(map => {
              const active = !hiddenMaps.has(map);
              const img = mapImages[map];
              return (
                <button
                  key={map}
                  onClick={() => toggleMap(map)}
                  className={`shrink-0 flex flex-col items-center gap-1 p-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                  }`}
                >
                  {img && (
                    <img
                      src={img}
                      alt={map}
                      className={`w-[50px] h-[40px] object-cover rounded shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
                    />
                  )}
                  <span className={active ? '' : 'line-through'}>{map}</span>
                </button>
              );
            })}
          </div>

          {/* Armor, cost and bank: same chip size as the maps; the armor box will hold its icon */}
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
            {chipGroup('Armor', ARMORS, armor, setArmor)}
            {chipGroup('Cost', COSTS, cost, setCost)}
            {chipGroup('Bank', BANKS, bank, setBank)}
            {chipGroup('Round', ROUNDS, round, setRound)}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-start items-center gap-3 px-1">
        <div className="flex gap-1.5">
          {SIDES.map(({ key, label }) => (
            <button key={key} onClick={() => setSide(key)} className={chipCls(side === key)}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setMergeArmors(v => !v)} className={chipCls(mergeArmors)}>
          Merge armors
        </button>
        <button
          onClick={resetFilters}
          className="px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border bg-transparent border-gray-700 text-red-400 hover:border-red-500 hover:text-red-300"
        >
          Reset filters
        </button>
        <Tooltip content={LEGEND} className="items-center">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-200 hover:text-white transition-colors cursor-help">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Legend
          </span>
        </Tooltip>
      </div>

      {teams.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
          Select at least one team to see weapon picks...
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(520px, 1fr))' }}>
          {teams.map(team => {
            const loadouts = teamLoadouts(team);
            const total = loadouts.reduce((a, [, lo]) => a + lo.rounds, 0);
            const open = showAll.has(team);
            const shown = open ? loadouts : loadouts.slice(0, TOP_LOADOUTS);
            return (
              <div key={team} className="bg-[#1a1d23] rounded-xl border border-gray-800 p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {teamLogos[team] && <img src={teamLogos[team]} alt={team} className="w-5 h-5 object-contain shrink-0" />}
                  <span className="text-sm font-bold text-gray-200">{team}</span>
                  <span className="text-[11px] text-gray-500">{total} rounds</span>
                </div>
                {loadouts.length === 0 ? (
                  <span className="text-sm text-gray-600">No rounds for the current filters</span>
                ) : (
                  <table className="border-separate" style={{ borderSpacing: '0 2px' }}>
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="text-left pb-1">Loadout</th>
                        <th className="text-right pb-1 px-2">Rounds</th>
                        <th className="text-center pb-1 px-2 w-[56px]">%</th>
                        <th className="text-center pb-1 px-2 w-[56px]">WR</th>
                        <th className="text-right pb-1 px-2">Cost</th>
                        <th className="text-right pb-1 px-2">Bank</th>
                        <th className="text-right pb-1 pl-2">Enemy loadout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map(([key, lo]) => {
                        const share = total > 0 ? Math.round(lo.rounds / total * 100) : null;
                        const wr = lo.decided > 0 ? Math.round(lo.wins / lo.decided * 100) : null;
                        const [weapons, armor] = key.split(' · ');
                        return (
                          <tr key={key} className="text-[12px]">
                            <td className="py-1 pr-2">
                              <span className="text-gray-200 font-bold">{weapons}</span>
                              <span className="text-gray-500"> · {armor}</span>
                            </td>
                            <td className="py-1 px-2 text-right text-gray-300">{lo.rounds}</td>
                            <td className="py-1 px-2 text-center font-bold text-gray-100 rounded" style={{ backgroundColor: heatmapBg(share) }}>
                              {share}%
                            </td>
                            <td className={`py-1 px-2 text-center font-bold ${wr === null ? 'text-gray-700' : wr >= 55 ? 'text-green-400' : wr <= 45 ? 'text-red-400' : 'text-gray-300'}`}>
                              {wr === null ? '—' : `${wr}%`}
                            </td>
                            <td className="py-1 px-2 text-right text-gray-300">{money(lo.costSum, lo.valued)}</td>
                            <td className="py-1 px-2 text-right text-gray-300">{money(lo.bankSum, lo.valued)}</td>
                            <td className="py-1 pl-2 text-right text-gray-300">{money(lo.enemyCostSum, lo.enemyValued)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {loadouts.length > TOP_LOADOUTS && (
                  <button
                    onClick={() => toggleShowAll(team)}
                    className="self-start text-[11px] font-bold uppercase tracking-wide text-blue-400 hover:text-blue-300"
                  >
                    {open ? 'Show top 5' : `Show all (${loadouts.length})`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
