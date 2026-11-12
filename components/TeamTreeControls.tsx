"use client";
// Team and Last X of the team pages on the new main filter, rendered inside TournamentTreeFilter:
// the team select in its bottom row (`children`), Last X next to the dates (`topControls`).
// The team is a vlr id (`teamId`); `team` keeps its tricode in the URL for the
// team pages still on the old filter. Compare's right side passes `suffix` '2' (team2 / teamId2);
// Last X has no suffix, both sides write the same `last`.
import { TeamOption } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';
import { SearchableSelect } from './SearchableSelect';

interface Props {
  options: TeamOption[];
  selected: TeamOption | null;
  teamLogos: Record<string, string>;
  label?: string;
  suffix?: string;
}

export function TeamTreeControls({ options, selected, teamLogos, label = 'Team', suffix = '' }: Props) {
  const teamKey = `team${suffix}`, idKey = `teamId${suffix}`;
  const { commitParams, flush } = useNavigation();
  const filterParams = useFilterParams();

  const setTeam = (label: string) => {
    const params = new URLSearchParams(filterParams.toString());
    const option = options.find(o => o.label === label);
    if (option) { params.set(teamKey, option.tag); params.set(idKey, option.id); }
    else { params.delete(teamKey); params.delete(idKey); }
    commitParams(params);
  };
  // The select shows the server's selection until an edit is pending
  const pendingId = filterParams.get(idKey);
  const current = options.find(o => o.id === pendingId) ?? (filterParams.get(teamKey) ? selected : null);

  return (
      <SearchableSelect onClose={flush}
        label={label}
        options={options.map(o => o.label)}
        selected={current?.label ?? ''}
        onChange={setTeam}
        placeholder="Choose a team"
        logos={Object.fromEntries(options.filter(o => teamLogos[o.tag]).map(o => [o.label, teamLogos[o.tag]]))}
      />
  );
}

export function LastXSelect() {
  const { commitParams } = useNavigation();
  const filterParams = useFilterParams();
  const setLast = (value: string) => {
    const params = new URLSearchParams(filterParams.toString());
    if (value !== 'all') params.set('last', value); else params.delete('last');
    commitParams(params);
  };
  return (
      <div className="flex items-center gap-2">
        <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Last X</label>
        <select
          value={filterParams.get('last') || 'all'}
          onChange={e => setLast(e.target.value)}
          className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[130px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="all">All matches</option>
          <option value="1">Last Match</option>
          <option value="3">Last 3</option>
          <option value="5">Last 5</option>
          <option value="10">Last 10</option>
        </select>
      </div>
  );
}
