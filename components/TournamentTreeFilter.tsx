"use client";
// Main filter of Stats Rank v2: Year → Region → Subregion → Tournament chips in cascade, plus
// the date range (DateFilter), Bo3 / Bo5 and Relevant / All teams. The only selection is the tournament list
// (URL `tour`); the upper levels are bulk toggles over the tournaments under them, painted
// active (all selected), partial (some) or off. Each row only shows what hangs from an active
// chip above, so what is visible is what is selected. Subregions have no row of their own: they
// live in a menu opened from the ▾ of their region chip.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Region, TeamOption, TournamentNode } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';
import { DateFilter } from './DateFilter';
import { AddTeamsSelect } from './AddTeamsSelect';

interface Props {
  tree: TournamentNode[];
  regions: Region[];
  selected: string[];
  // Meta Shift renders one filter per side: `suffix` '2' writes tour2 / dateFrom2 / dateTo2,
  // `title` names the side; `children` get a row of their own at the bottom (that side's Team /
  // Exclude Teams) and `topControls` go between the dates and Serie (Last X).
  // Serie and Teams have no suffix: both sides show them and write the same `bo` / `allTeams`
  suffix?: string;
  title?: React.ReactNode;
  topControls?: React.ReactNode;
  // Series Outcomes is Bo3 by definition: no Serie chips
  hideSerie?: boolean;
  // Operator Use, Weapon Pick and Time & Site only work with the relevant teams: no Relevant / All chips
  hideTeams?: boolean;
  // Teams the visitor can add to Relevant (URL `addTeams`, shared by both sides like `allTeams`)
  addTeams?: TeamOption[];
  // Tricodes of the teams marked relevant that played the selected tournaments: tooltip of Relevant
  relevantTags?: string[];
  children?: React.ReactNode;
}

const REGION_ORDER = ['americas', 'emea', 'pacific', 'china', 'global'];
const REGION_LABELS: Record<string, string> = {
  americas: 'Americas', emea: 'EMEA', pacific: 'Pacific', china: 'China', global: 'International',
};
// Chronological order inside a season; unknown stages go last
const STAGE_ORDER = ['open_qualifier', 'closed_qualifier', 'kickoff', 'masters', 'stage_1', 'stage_2', 'ewc', 'champions', 'game_changers'];
const STAGE_LABELS: Record<string, string> = {
  open_qualifier: 'Open', closed_qualifier: 'Closed', kickoff: 'Kickoff',
  stage_1: 'Stage 1', stage_2: 'Stage 2', ewc: 'EWC', champions: 'Champions', game_changers: 'Game Changers',
};
const orderIn = (list: string[], v: string | null) => {
  const i = v ? list.indexOf(v) : -1;
  return i === -1 ? list.length : i;
};
// First letter of each word; split on spaces, since \b breaks inside "türkiye" (ü is not \w)
const capitalize = (s: string) => s.replace(/(^|\s)\S/g, c => c.toUpperCase());
// Masters take the city from the event ("valorant masters london 2026" → "Masters London");
// a stage without a label falls back to the event name
function tourLabel(t: TournamentNode): string {
  if (t.stage === 'masters') return capitalize(t.event.match(/masters \S+/)?.[0] ?? 'masters');
  const stage = (t.stage && STAGE_LABELS[t.stage]) || capitalize(t.event);
  return t.subregion ? `${t.subregion} ${stage}` : stage;
}
// Stages whose tournaments of one year share a single chip, labeled by the stage alone ("Open"),
// with a ▾ menu of its regions (logo + name) like the region chips. The chip and each menu entry
// toggle every tournament of that stage in the year (all regions / one region), whatever the
// Region row and the subregion menus say, the same way a region chip toggles the whole region
const GROUPED_STAGES = ['open_qualifier'];
// Flag in public/flags/ per subregion (tournament.subregion, compared without case or spaces)
const SUBREGION_FLAGS: Record<string, string> = {
  brazil: 'br', china: 'cn', europe: 'eu', japan: 'jp', korea: 'kr', mena: 'mena', northamerica: 'na',
  latamnorth: 'latamnorth', latamsouth: 'latamsouth', latamnorthsouth: 'latamnorthsouth', latam: 'latamnorthsouth',
  sea: 'sea', southeastasia: 'sea', turkey: 'turrkiye', turkiye: 'turrkiye', türkiye: 'turrkiye',
};
const subregionFlag = (subregion: string | null) => {
  const file = subregion && SUBREGION_FLAGS[subregion.toLowerCase().replace(/[^a-zü]/g, '')];
  return file ? <img src={`/flags/${file}.png`} alt="" className="w-[18px] h-3 object-cover rounded-[2px] shrink-0" /> : null;
};
// Circuit stage a qualifier feeds, from the event before " - " minus season and region:
// "vct 2027 america kickoff - north america open qualifier" → "Kickoff" (later "Cup 1"…).
// '' when the name doesn't follow that shape.
const qualifierTarget = (t: TournamentNode) =>
  capitalize(t.event.match(/^vct \d{4}:? \S+ (.+?) - /i)?.[1]?.toLowerCase() ?? '');
// Circuit order of those targets: Kickoff, then Cup 1, Cup 2…; anything else after them
const targetOrder = (target: string) =>
  target === 'Kickoff' ? 0 : Number(target.match(/^Cup (\d+)$/)?.[1] ?? 1000);

const LABEL = 'text-[11px] font-bold text-gray-200 uppercase tracking-wider';
// Every chip of the filter (years, Serie, Teams, regions, tournaments) is as tall as a select
const CHIP = 'h-[38px] px-4 rounded-xl text-[13px] font-bold uppercase tracking-wide transition-colors border';
const TONE = {
  on: 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60',
  partial: 'bg-blue-900/15 border-blue-800 border-dashed text-blue-300/80 hover:bg-blue-900/30',
  off: 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300',
};

export function TournamentTreeFilter({ tree, regions, selected, suffix = '', title, topControls, hideSerie, hideTeams, addTeams, relevantTags = [], children }: Props) {
  const { commitParams, hasPendingEdits } = useNavigation();
  const filterParams = useFilterParams();
  const sel = new Set(selected);
  // Chip whose ▾ menu is open (a region's subregions or a grouped stage's regions), one at a time;
  // closes on click outside or Esc
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Path of menu items whose side panels are open, one key per depth (Open 1 → Americas → its
  // opens); set on hover or click on ▶
  const [flyout, setFlyout] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openMenu) return;
    const close = () => { setOpenMenu(null); setFlyout([]); };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openMenu]);

  const regionKey = (regId: string) => regions.find(r => r.reg_id === regId)?.region.toLowerCase() ?? regId;
  const tours = [...tree].sort((a, b) =>
    (b.year ?? 0) - (a.year ?? 0)
    || orderIn(REGION_ORDER, regionKey(a.reg_id)) - orderIn(REGION_ORDER, regionKey(b.reg_id))
    || orderIn(STAGE_ORDER, a.stage) - orderIn(STAGE_ORDER, b.stage)
    || tourLabel(a).localeCompare(tourLabel(b)));

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(filterParams.toString());
    if (value === null) params.delete(key); else params.set(key, value);
    commitParams(params);
  };
  // Empty is written as `tour=` (nothing): a missing param would bring the default year back
  const writeTours = (ids: Set<string>) => setParam(`tour${suffix}`, tours.filter(t => ids.has(t.tour_id)).map(t => t.tour_id).join(','));

  const state = (group: TournamentNode[]): keyof typeof TONE => {
    const n = group.filter(t => sel.has(t.tour_id)).length;
    return n === 0 ? 'off' : n === group.length ? 'on' : 'partial';
  };
  // Bulk toggle: fully on → clear the group; off or partial → select all of it
  const toggleGroup = (group: TournamentNode[]) => {
    const next = new Set(sel);
    const allOn = state(group) === 'on';
    for (const t of group) { if (allOn) next.delete(t.tour_id); else next.add(t.tour_id); }
    writeTours(next);
  };
  const isActive = (group: TournamentNode[]) => state(group) !== 'off';

  // Cascade: each level only over the active chips of the level above
  const years = [...new Set(tours.map(t => t.year))];
  const activeYears = years.filter(y => isActive(tours.filter(t => t.year === y)));
  const inYears = tours.filter(t => activeYears.includes(t.year));
  const regionIds = [...new Set(inYears.map(t => t.reg_id))];
  const activeRegions = regionIds.filter(r => isActive(inYears.filter(t => t.reg_id === r)));
  const inRegions = inYears.filter(t => activeRegions.includes(t.reg_id));
  const subregions = [...new Set(inRegions.map(t => t.subregion).filter((s): s is string => !!s))];
  const activeSubs = subregions.filter(s => isActive(inRegions.filter(t => t.subregion === s)));
  const visibleTours = inRegions.filter(t => !t.subregion || activeSubs.includes(t.subregion));
  const multiYear = activeYears.length > 1;
  // One chip per visible tournament, except GROUPED_STAGES: one per year + stage over every
  // tournament of the active years, placed where its first tournament sorts
  const isGrouped = (t: TournamentNode) => !!t.stage && GROUPED_STAGES.includes(t.stage);
  const tourChips: { key: string; group: TournamentNode[] }[] = [];
  for (const t of inYears) {
    if (!isGrouped(t) && !visibleTours.includes(t)) continue;
    const key = isGrouped(t) ? `${t.year}|${t.stage}` : t.tour_id;
    const chip = tourChips.find(c => c.key === key);
    if (chip) chip.group.push(t); else tourChips.push({ key, group: [t] });
  }

  const row = (label: string, children: React.ReactNode) => (
    <div className="flex items-start gap-4">
      <span className={`w-24 shrink-0 pt-[11px] ${LABEL}`}>{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
  const regionLogo = (regId: string) => {
    const key = regionKey(regId);
    return REGION_ORDER.includes(key)
      ? <img src={`/region/${key}.png`} alt="" className="w-4 h-4 object-contain shrink-0" />
      : null;
  };
  const regionLabel = (regId: string) => REGION_LABELS[regionKey(regId)] ?? regionKey(regId);

  // Chip that toggles its whole group, plus a ▾ a/b menu with a checkbox per item (a region's
  // subregions, a grouped stage's regions). Without items it is a plain chip. An item with
  // `children` gets an a/b ▶ and a side panel with them, nested as deep as the items go (Open 1 →
  // a region → each of its opens), opened on hover or on click of the ▶; its own name still
  // toggles the whole item.
  type MenuItem = { key: string; label: string; logo?: React.ReactNode; group: TournamentNode[]; children?: MenuItem[] };
  const menuItem = (i: MenuItem, onEnter?: () => void, arrow?: React.ReactNode) => {
    const st = state(i.group);
    return (
      <div key={i.key} onMouseEnter={onEnter} className="flex items-stretch hover:bg-gray-700/50">
        <button
          onClick={() => toggleGroup(i.group)}
          title={i.group.map(g => g.event).join('\n')}
          className="flex-1 flex items-center gap-2 px-3 py-1.5 text-left text-[12px] font-semibold text-gray-200"
        >
          <span className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center text-[10px] leading-none ${
            st === 'on' ? 'bg-blue-600 border-blue-500 text-white' : st === 'partial' ? 'border-blue-500 text-blue-400' : 'border-gray-500'
          }`}>
            {st === 'on' ? '✓' : st === 'partial' ? '–' : ''}
          </span>
          {i.logo}
          {i.label}
        </button>
        {arrow}
      </div>
    );
  };
  const menuList = (items: MenuItem[], depth: number): React.ReactNode => items.map(i => {
    const upTo = flyout.slice(0, depth);
    if (!i.children?.length) return menuItem(i, () => setFlyout(upTo));
    const fly = flyout[depth] === i.key;
    return (
      <div key={i.key} className="relative">
        {menuItem(i, () => setFlyout([...upTo, i.key]), (
          <button
            onClick={() => setFlyout(fly ? upTo : [...upTo, i.key])}
            className="flex items-center gap-0.5 pl-1 pr-2.5 text-[11px] font-bold text-gray-400"
          >
            {i.children.filter(c => isActive(c.group)).length}/{i.children.length}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ))}
        {fly && (
          <div className="absolute left-full top-0 -mt-1 ml-1 z-30 min-w-[180px] bg-[#252a33] border border-gray-700 rounded-lg shadow-xl py-1">
            {menuList(i.children, depth + 1)}
          </div>
        )}
      </div>
    );
  });
  const menuChip = (id: string, group: TournamentNode[], label: React.ReactNode, menuTitle: string, items: MenuItem[]) => {
    const open = openMenu === id;
    return (
      <div key={id} ref={open ? menuRef : undefined} className="relative">
        <div className={`h-[38px] rounded-xl text-[13px] font-bold tracking-wide transition-colors border ${TONE[state(group)]} flex items-stretch overflow-hidden`}>
          <button onClick={() => toggleGroup(group)} className="flex items-center gap-1.5 pl-4 pr-1 uppercase">
            {label}
          </button>
          {items.length > 0 ? (
            <button
              onClick={() => { setOpenMenu(open ? null : id); setFlyout([]); }}
              title={menuTitle}
              className="flex items-center gap-0.5 pl-2 pr-3 border-l border-gray-600/60 text-[12px]"
            >
              {items.filter(i => isActive(i.group)).length}/{items.length}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          ) : <span className="pr-3" />}
        </div>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-20 min-w-[200px] bg-[#252a33] border border-gray-700 rounded-lg shadow-xl py-1">
            {menuList(items, 0)}
          </div>
        )}
      </div>
    );
  };

  const bo = filterParams.get('bo') || 'all';
  const allTeams = filterParams.get('allTeams') === '1';
  // Chips of the Year row (years, Serie, Teams): as tall as a select
  const pill = (active: boolean) => `${CHIP} ${active ? TONE.on : TONE.off}`;

  return (
    <div className="flex flex-col gap-3 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl relative">
      {hasPendingEdits && (
        <span className="absolute top-1 right-4 text-[10px] font-bold uppercase tracking-wider text-blue-400/80 animate-pulse pointer-events-none">
          Loading...
        </span>
      )}

      {title}

      {/* Year row, one after the other: the year chips, Serie, Teams, the date and Last X.
          Everything is as tall as a select (38px); Serie and Teams are chips like the years,
          each pair with its label on the left like Year */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-4">
          <span className={`w-24 shrink-0 ${LABEL}`}>Year</span>
          <div className="flex flex-wrap gap-2">
            {years.map(y => {
              const group = tours.filter(t => t.year === y);
              return (
                <button key={y ?? 'none'} onClick={() => toggleGroup(group)} className={`${CHIP} ${TONE[state(group)]}`}>
                  {y ?? 'No year'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Both formats when there is no param; with one on, any click goes back to both */}
        {!hideSerie && <div className="flex items-center gap-2">
          <span className={LABEL}>Serie</span>
          <div className="flex gap-2">
            {['3', '5'].map(v => (
              <button key={v} onClick={() => setParam('bo', bo === 'all' ? v : null)} className={pill(bo === 'all' || bo === v)}>
                BO{v}
              </button>
            ))}
          </div>
        </div>}

        {(!hideTeams || addTeams) && <div className="flex items-center gap-2">
          <span className={LABEL}>Teams</span>
          <div className="flex gap-2">
            {!hideTeams && <>
              <button onClick={() => setParam('allTeams', null)} className={pill(!allTeams)} title={`Teams: ${relevantTags.join(', ') || 'none in this selection'}`}>
                Relevant
              </button>
              <button onClick={() => setParam('allTeams', '1')} className={pill(allTeams)}>
                All
              </button>
            </>}
            {addTeams && (hideTeams || !allTeams) && <AddTeamsSelect options={addTeams} chipClass={pill} />}
          </div>
        </div>}

        <DateFilter fromKey={`dateFrom${suffix}`} toKey={`dateTo${suffix}`} />
        {topControls}
      </div>

      {regionIds.length > 0 && row('Region', regionIds.map(r => {
        const group = inYears.filter(t => t.reg_id === r);
        const subs = [...new Set(group.map(t => t.subregion).filter((s): s is string => !!s))].sort();
        return menuChip(`region:${r}`, group, <>{regionLogo(r)}{regionLabel(r)}</>, 'Subregions',
          subs.map(s => ({ key: s, logo: subregionFlag(s), label: s, group: group.filter(t => t.subregion === s) })));
      }))}

      {tourChips.length > 0 && row('Tournament', tourChips.map(({ key, group }) => {
        const t = group[0];
        const yearPrefix = multiYear && t.year ? `${t.year} ` : '';
        if (isGrouped(t)) {
          const stageLabel = STAGE_LABELS[t.stage!] ?? t.stage!;
          // Menu: one entry per circuit stage the qualifiers feed, numbered in circuit order
          // ("Kickoff Open 1", later "Cup 1 Open 2"…) → regions → each tournament
          const targets = [...new Set(group.map(qualifierTarget))]
            .sort((a, b) => targetOrder(a) - targetOrder(b) || a.localeCompare(b));
          const numItems = targets.map((target, i) => {
            const numGroup = group.filter(g => qualifierTarget(g) === target);
            const regs = [...new Set(numGroup.map(g => g.reg_id))];
            return {
              key: `target:${target}`, label: `${target ? `${target} ` : ''}${stageLabel} ${i + 1}`, group: numGroup,
              children: regs.map(r => {
                const regGroup = numGroup.filter(g => g.reg_id === r);
                return {
                  key: r, logo: regionLogo(r), label: regionLabel(r), group: regGroup,
                  children: regGroup.map(g => ({ key: g.tour_id, logo: subregionFlag(g.subregion), label: g.subregion ?? tourLabel(g), group: [g] })),
                };
              }),
            };
          });
          // The four team regions' logos, toned by what is selected in each (like the Quick
          // Tournament chips): full on, faded partial, grey off or with no tournament of the stage
          const logos = REGION_ORDER.filter(k => k !== 'global').map(k => {
            const st = state(group.filter(g => regionKey(g.reg_id) === k));
            const tone = st === 'on' ? '' : st === 'partial' ? 'opacity-70' : 'opacity-40 grayscale';
            return <img key={k} src={`/region/${k}.png`} alt={k} className={`w-4 h-4 object-contain shrink-0 transition-opacity ${tone}`} />;
          });
          return menuChip(`stage:${key}`, group, <>{logos}<span className="ml-0.5">{yearPrefix}{stageLabel}</span></>, stageLabel, numItems);
        }
        return (
          <button
            key={key}
            onClick={() => toggleGroup(group)}
            title={t.event}
            className={`${CHIP} ${TONE[state(group)]} flex items-center gap-1.5`}
          >
            {regionLogo(t.reg_id)}
            {yearPrefix}{tourLabel(t)}
          </button>
        );
      }))}

      {children && (
        <div className="flex flex-wrap items-end gap-6 pt-3 border-t border-gray-800">
          {children}
        </div>
      )}
    </div>
  );
}
