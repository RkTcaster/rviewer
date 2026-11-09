"use client";
// Main filter of Stats Rank v2: Year → Region → Subregion → Tournament chips in cascade, plus
// From / To, Bo3 / Bo5 and Relevant / All teams. The only selection is the tournament list
// (URL `tour`); the upper levels are bulk toggles over the tournaments under them, painted
// active (all selected), partial (some) or off. Each row only shows what hangs from an active
// chip above, so what is visible is what is selected. Subregions have no row of their own: they
// live in a menu opened from the ▾ of their region chip.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Region, TournamentNode } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';

interface Props {
  tree: TournamentNode[];
  regions: Region[];
  selected: string[];
}

const REGION_ORDER = ['americas', 'emea', 'pacific', 'china', 'global'];
const REGION_LABELS: Record<string, string> = {
  americas: 'Americas', emea: 'EMEA', pacific: 'Pacific', china: 'China', global: 'International',
};
// Chronological order inside a season; unknown stages go last
const STAGE_ORDER = ['open_qualifier', 'closed_qualifier', 'kickoff', 'masters', 'stage_1', 'stage_2', 'ewc', 'champions', 'game_changers'];
const STAGE_LABELS: Record<string, string> = {
  open_qualifier: 'Open Qualifier', closed_qualifier: 'Closed Qualifier', kickoff: 'Kickoff',
  stage_1: 'Stage 1', stage_2: 'Stage 2', ewc: 'EWC', champions: 'Champions', game_changers: 'Game Changers',
};
const orderIn = (list: string[], v: string | null) => {
  const i = v ? list.indexOf(v) : -1;
  return i === -1 ? list.length : i;
};
const capitalize = (s: string) => s.replace(/\b\w/g, c => c.toUpperCase());
// Masters take the city from the event ("valorant masters london 2026" → "Masters London");
// a stage without a label falls back to the event name
function tourLabel(t: TournamentNode): string {
  if (t.stage === 'masters') return capitalize(t.event.match(/masters \S+/)?.[0] ?? 'masters');
  const stage = (t.stage && STAGE_LABELS[t.stage]) || capitalize(t.event);
  return t.subregion ? `${t.subregion} ${stage}` : stage;
}

const CHIP = 'px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-wide transition-colors border';
const TONE = {
  on: 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60',
  partial: 'bg-blue-900/15 border-blue-800 border-dashed text-blue-300/80 hover:bg-blue-900/30',
  off: 'bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300',
};

export function TournamentTreeFilter({ tree, regions, selected }: Props) {
  const { commitParams, hasPendingEdits } = useNavigation();
  const filterParams = useFilterParams();
  const sel = new Set(selected);
  // Region whose subregion menu is open (one at a time); closes on click outside or Esc
  const [openRegion, setOpenRegion] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openRegion) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenRegion(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenRegion(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [openRegion]);

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
  const writeTours = (ids: Set<string>) => setParam('tour', tours.filter(t => ids.has(t.tour_id)).map(t => t.tour_id).join(','));

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
  const toggleTour = (id: string) => {
    const next = new Set(sel);
    if (next.has(id)) next.delete(id); else next.add(id);
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

  const row = (label: string, children: React.ReactNode) => (
    <div className="flex items-start gap-4">
      <span className="w-24 shrink-0 pt-2 text-[11px] font-bold text-gray-200 uppercase tracking-wider">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
  const regionLogo = (regId: string) => {
    const key = regionKey(regId);
    return REGION_ORDER.includes(key)
      ? <img src={`/region/${key}.png`} alt="" className="w-4 h-4 object-contain shrink-0" />
      : null;
  };

  const bo = filterParams.get('bo') || 'all';
  const allTeams = filterParams.get('allTeams') === '1';
  const dateInput = (key: string, label: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{label}</label>
      <input
        type="date"
        value={filterParams.get(key) || ''}
        onChange={e => setParam(key, e.target.value || null)}
        className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
      />
    </div>
  );
  const pill = (active: boolean) =>
    `px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${active ? TONE.on : TONE.off}`;

  return (
    <div className="flex flex-col gap-3 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl relative">
      {hasPendingEdits && (
        <span className="absolute top-3 right-4 text-[10px] font-bold uppercase tracking-wider text-blue-400/80 animate-pulse pointer-events-none">
          Loading...
        </span>
      )}

      {row('Year', years.map(y => {
        const group = tours.filter(t => t.year === y);
        return (
          <button key={y ?? 'none'} onClick={() => toggleGroup(group)} className={`${CHIP} ${TONE[state(group)]}`}>
            {y ?? 'No year'}
          </button>
        );
      }))}

      {regionIds.length > 0 && row('Region', regionIds.map(r => {
        const group = inYears.filter(t => t.reg_id === r);
        const subs = [...new Set(group.map(t => t.subregion).filter((s): s is string => !!s))].sort();
        const subGroup = (s: string) => group.filter(t => t.subregion === s);
        const activeCount = subs.filter(s => isActive(subGroup(s))).length;
        const open = openRegion === r;
        return (
          <div key={r} ref={open ? menuRef : undefined} className="relative">
            <div className={`rounded-xl text-[12px] font-bold tracking-wide transition-colors border ${TONE[state(group)]} flex items-stretch overflow-hidden`}>
              <button onClick={() => toggleGroup(group)} className="flex items-center gap-1.5 pl-3 pr-1 py-1.5 uppercase">
                {regionLogo(r)}
                {REGION_LABELS[regionKey(r)] ?? regionKey(r)}
              </button>
              {subs.length > 0 ? (
                <button
                  onClick={() => setOpenRegion(open ? null : r)}
                  title="Subregions"
                  className="flex items-center gap-0.5 pl-1.5 pr-2.5 py-1.5 border-l border-gray-600/60 text-[11px]"
                >
                  {activeCount}/{subs.length}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              ) : <span className="pr-2" />}
            </div>
            {open && (
              <div className="absolute top-full left-0 mt-1 z-20 min-w-[200px] bg-[#252a33] border border-gray-700 rounded-lg shadow-xl py-1">
                {subs.map(s => {
                  const st = state(subGroup(s));
                  return (
                    <button
                      key={s}
                      onClick={() => toggleGroup(subGroup(s))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[12px] font-semibold text-gray-200 hover:bg-gray-700/50"
                    >
                      <span className={`w-3.5 h-3.5 shrink-0 rounded-sm border flex items-center justify-center text-[10px] leading-none ${
                        st === 'on' ? 'bg-blue-600 border-blue-500 text-white' : st === 'partial' ? 'border-blue-500 text-blue-400' : 'border-gray-500'
                      }`}>
                        {st === 'on' ? '✓' : st === 'partial' ? '–' : ''}
                      </span>
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      }))}

      {visibleTours.length > 0 && row('Tournament', visibleTours.map(t => (
        <button
          key={t.tour_id}
          onClick={() => toggleTour(t.tour_id)}
          title={t.event}
          className={`${CHIP} ${sel.has(t.tour_id) ? TONE.on : TONE.off} flex items-center gap-1.5`}
        >
          {regionLogo(t.reg_id)}
          {multiYear && t.year ? `${t.year} ` : ''}{tourLabel(t)}
        </button>
      )))}

      <div className="flex flex-wrap items-end gap-6 pt-3 border-t border-gray-800">
        {dateInput('dateFrom', 'From')}
        {dateInput('dateTo', 'To')}

        {/* Both formats when there is no param; with one on, any click goes back to both */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Serie</label>
          <div className="flex gap-2 pb-1.5">
            {['3', '5'].map(v => (
              <button key={v} onClick={() => setParam('bo', bo === 'all' ? v : null)} className={pill(bo === 'all' || bo === v)}>
                BO{v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Teams</label>
          <div className="flex gap-2 pb-1.5">
            <button onClick={() => setParam('allTeams', null)} className={pill(!allTeams)} title="Teams marked relevant in Supabase">
              Relevant
            </button>
            <button onClick={() => setParam('allTeams', '1')} className={pill(allTeams)}>
              All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
