"use client";
// Compare Maps on the new main filter (ROADMAP Phase 12): one tournament cascade per team (Left
// writes tour / dateFrom / dateTo / team / teamId, Right the same with the 2 suffix). Serie,
// Last X and Relevant / All show on both sides and are the same control.
import { Region, TeamOption, TournamentNode } from '@/lib/types';
import { TournamentTreeFilter } from './TournamentTreeFilter';
import { TeamTreeControls, LastXSelect } from './TeamTreeControls';

interface Side { selected: string[]; options: TeamOption[]; team: TeamOption | null }
interface Props {
  tree: TournamentNode[];
  regions: Region[];
  left: Side;
  right: Side;
  teamLogos: Record<string, string>;
}

export function CompareFilters({ tree, regions, left, right, teamLogos }: Props) {
  const title = (name: string, color: string) => (
    <span className={`text-[12px] font-black uppercase tracking-widest ${color}`}>{name}</span>
  );
  return (
    <div className="flex flex-col [&>div]:mb-3 mb-5">
      <TournamentTreeFilter tree={tree} regions={regions} selected={left.selected} title={title('Team Left', 'text-blue-400')} topControls={<LastXSelect />}>
        <TeamTreeControls label="Team Left" options={left.options} selected={left.team} teamLogos={teamLogos} />
      </TournamentTreeFilter>
      <TournamentTreeFilter tree={tree} regions={regions} selected={right.selected} suffix="2" title={title('Team Right', 'text-orange-400')} topControls={<LastXSelect />}>
        <TeamTreeControls label="Team Right" suffix="2" options={right.options} selected={right.team} teamLogos={teamLogos} />
      </TournamentTreeFilter>
    </div>
  );
}
