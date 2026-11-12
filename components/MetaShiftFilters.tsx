"use client";
// Meta Shift on the new main filter (ROADMAP Phase 12): one tournament cascade per side (A writes
// tour / dateFrom / dateTo, B the same with the 2 suffix), each with its Team and Exclude Teams.
// Serie and Relevant / All show on both sides and are the same control (`bo` / `allTeams`).
import { Region, TournamentNode } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';
import { TournamentTreeFilter } from './TournamentTreeFilter';
import { SearchableSelect } from './SearchableSelect';
import { StringMultiSelect } from './StringMultiSelect';

interface Props {
  tree: TournamentNode[];
  regions: Region[];
  selectedA: string[];
  selectedB: string[];
  teamsA: string[];
  teamsB: string[];
  teamLogos: Record<string, string>;
}

const RESET_KEYS = ['team', 'tour', 'excA', 'dateFrom', 'dateTo', 'team2', 'tour2', 'excB', 'dateFrom2', 'dateTo2', 'bo', 'allTeams'];

export function MetaShiftFilters({ tree, regions, selectedA, selectedB, teamsA, teamsB, teamLogos }: Props) {
  const { commitParams, flush } = useNavigation();
  const filterParams = useFilterParams();

  const setParam = (key: string, value: string, alsoDelete?: string) => {
    const params = new URLSearchParams(filterParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (alsoDelete && value) params.delete(alsoDelete);
    commitParams(params);
  };
  const reset = () => {
    const params = new URLSearchParams(filterParams.toString());
    RESET_KEYS.forEach(k => params.delete(k));
    commitParams(params, { immediate: true });
  };
  const withLogo = (team: string) => (
    <span className="flex items-center gap-2">
      {teamLogos[team] && <img src={teamLogos[team]} alt="" className="w-5 h-5 object-contain shrink-0" />}
      {team}
    </span>
  );

  const side = (name: 'A' | 'B', teamKey: string, excKey: string, teams: string[], color: string) => (
    <>
      <SearchableSelect onClose={flush}
        label={`Team ${name}`}
        options={teams}
        selected={filterParams.get(teamKey) || ''}
        onChange={val => setParam(teamKey, val, excKey)}
        placeholder="All teams"
        logos={teamLogos}
      />
      {!filterParams.get(teamKey) && (
        <StringMultiSelect onClose={flush}
          label={`Exclude Teams ${name}`}
          options={teams}
          selected={filterParams.get(excKey)?.split(',').filter(Boolean) || []}
          onChange={values => setParam(excKey, values.join(','))}
          placeholder="Exclude teams..."
          renderOption={withLogo}
          labelColor={color}
        />
      )}
    </>
  );
  const title = (name: 'A' | 'B', color: string, extra?: React.ReactNode) => (
    <div className="flex items-center justify-between">
      <span className={`text-[12px] font-black uppercase tracking-widest ${color}`}>Side {name}</span>
      {extra}
    </div>
  );

  return (
    <div className="flex flex-col [&>div]:mb-3 mb-5">
      <TournamentTreeFilter tree={tree} regions={regions} selected={selectedA}
        title={title('A', 'text-blue-400', (
          <button onClick={reset} className="mr-24 text-[10px] font-bold text-red-500 hover:text-red-400 hover:underline uppercase tracking-wider">
            Reset filters
          </button>
        ))}
      >
        {side('A', 'team', 'excA', teamsA, 'text-blue-400')}
      </TournamentTreeFilter>
      <TournamentTreeFilter tree={tree} regions={regions} selected={selectedB} suffix="2" title={title('B', 'text-orange-400')}>
        {side('B', 'team2', 'excB', teamsB, 'text-orange-400')}
      </TournamentTreeFilter>
    </div>
  );
}
