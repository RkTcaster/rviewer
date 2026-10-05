"use client";
import { Region, Tournament, DEFAULT_TOURS, sectionUsesDefaultTours } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';
import { MultiSelect } from "./MultiSelect";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { StringMultiSelect } from "./StringMultiSelect";
import { RegionChips } from "./RegionChips";

interface FiltersProps {
  regions: Region[];
  teams: string[];
  tours: Tournament[];
  tours2?: Tournament[];
  teams2?: string[];
  teamLogos?: Record<string, string>;
  mode?: 'team' | 'overall' | 'meta-shift' | 'economy' | 'stats-rank';
}

export function Filters({ regions, teams, tours, tours2 = [], teams2 = [], teamLogos, mode = 'team' }: FiltersProps) {
  const { commitParams, flush, hasPendingEdits } = useNavigation();
  const filterParams = useFilterParams();

  // Option renderer for the Exclude Teams multiselects (same logo markup as SearchableSelect)
  const withLogo = (team: string) => (
    <span className="flex items-center gap-2">
      {teamLogos?.[team] && <img src={teamLogos[team]} alt="" className="w-5 h-5 object-contain shrink-0" />}
      {team}
    </span>
  );

  const section = filterParams.get('section') || 'compare-maps';
  const isCompare = section === 'compare-maps' || section === 'compare-stats' || section === 'compare-economy';
  const isOverall = mode === 'overall';
  const isMetaShift = mode === 'meta-shift';
  const isEconomy = mode === 'economy';
  const isStatsRank = mode === 'stats-rank';
  const isRelevantInfo = section === 'relevant-info';
  // Series Outcomes ignores both: its series blocks are Bo3 by definition and it has no
  // team selected, so Bo5 and Last X are shown greyed out instead of pretending to work.
  const isSeriesOutcomes = section === 'series-outcomes';
  const usesDefaultTours = sectionUsesDefaultTours(section);
  // Team sections list only the tournaments the selected team played
  const tourNeedsTeam = !isOverall && !isEconomy && !isRelevantInfo && !isStatsRank;

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(filterParams.toString());
    if (value) params.set(key, value); else params.delete(key);

    if (key === 'reg') { params.delete('team'); params.delete('tour'); params.delete('team2'); params.delete('tour2'); params.delete('excA'); }
    if (key === 'reg2') { params.delete('team2'); params.delete('tour2'); params.delete('excB'); }
    if (key === 'team') { params.delete('tour'); if (value) params.delete('excA'); }
    if (key === 'team2') { params.delete('tour2'); if (value) params.delete('excB'); }

    commitParams(params);
  };

  const updateRegFilter = (key: 'reg' | 'reg2', values: string[]) => {
    const params = new URLSearchParams(filterParams.toString());
    if (values.length > 0) params.set(key, values.join(',')); else params.delete(key);
    if (key === 'reg') { params.delete('team'); params.delete('tour'); params.delete('team2'); params.delete('tour2'); params.delete('excA'); }
    if (key === 'reg2') { params.delete('team2'); params.delete('tour2'); params.delete('excB'); }
    commitParams(params);
  };

  const updateMultiFilter = (key: string, values: string[]) => {
    const params = new URLSearchParams(filterParams.toString());
    if (values.length > 0) {
      params.set(key, values.join(',')); // Guardamos como "id1,id2,id3"
    } else if (usesDefaultTours && (key === 'tour' || key === 'tour2')) {
      params.set(key, ''); // explicit "all tournaments": a missing param would bring the defaults back
    } else {
      params.delete(key);
    }
    commitParams(params);
  };

  // Quick tournament chips: toggles that overwrite tour and tour2 with the union of the active
  // chips, matched against each side's tour options (so in Compare, Stage 2 lands on each team's
  // region). If a side played none of them, its filter ends up empty.
  // logos: one fills the whole chip; four go in a 2x2 grid (like Post-Pistol Force's By region toggle)
  const quickTours: { label: string; title: string; logos: string[]; match: (id: string) => boolean }[] = [
    { label: 'Champs', title: 'Champions 2026', logos: ['champs'], match: id => id === 'valorant_champions_2026' },
    { label: 'Stage 2', title: 'Stage 2 2026 of each team region', logos: ['americas', 'emea', 'china', 'pacific'], match: id => /^vct_2026_.+_stage_2$/.test(id) },
  ];
  // Without a param the section is on DEFAULT_TOURS (see app/page.tsx), so the chips read those
  const tourSel = (key: 'tour' | 'tour2') => {
    const v = filterParams.get(key);
    return v !== null ? v.split(',').filter(Boolean) : usesDefaultTours ? DEFAULT_TOURS : [];
  };
  const selA = tourSel('tour');
  const selB = tourSel('tour2');
  const idsFor = (list: Tournament[], match: (id: string) => boolean) => list.filter(t => match(t.tour_id)).map(t => t.tour_id);
  // Active when it matches something and everything it matches is already selected on its side.
  const isQuickActive = (match: (id: string) => boolean) => {
    const a = idsFor(tours, match), b = idsFor(tours2, match);
    return a.length + b.length > 0 && a.every(id => selA.includes(id)) && b.every(id => selB.includes(id));
  };
  const toggleQuickTour = (label: string) => {
    const active = quickTours.filter(q => (q.label === label) !== isQuickActive(q.match));
    const params = new URLSearchParams(filterParams.toString());
    const setOrClear = (key: 'tour' | 'tour2', ids: string[]) => {
      if (ids.length > 0) params.set(key, ids.join(','));
      else if (usesDefaultTours) params.set(key, '');
      else params.delete(key);
    };
    setOrClear('tour', active.flatMap(q => idsFor(tours, q.match)));
    // tour2 only exists in Compare and Meta Shift
    if (isCompare || isMetaShift) setOrClear('tour2', active.flatMap(q => idsFor(tours2, q.match)));
    commitParams(params);
  };
  const quickTourChips = (disabled: boolean, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Quick Tournament</label>
      <div className="flex flex-wrap gap-2">
        {quickTours.map(q => {
          const active = isQuickActive(q.match);
          const imgTone = `object-contain transition-opacity ${active ? '' : 'opacity-40 grayscale'}`;
          return (
            <button
              key={q.label}
              disabled={disabled}
              onClick={() => toggleQuickTour(q.label)}
              title={q.title}
              className={`w-[72px] flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-colors border disabled:opacity-50 disabled:cursor-default ${active
                ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200 disabled:hover:border-gray-700 disabled:hover:text-gray-400'}`}
            >
              {q.logos.length === 1
                ? <img src={`/region/${q.logos[0]}.png`} alt={q.title} className={`w-7 h-7 shrink-0 ${imgTone}`} />
                : (
                  <div className="w-7 h-7 shrink-0 grid grid-cols-2 gap-0">
                    {q.logos.map(l => <img key={l} src={`/region/${l}.png`} alt={l} className={`w-3.5 h-3.5 ${imgTone}`} />)}
                  </div>
                )}
              <span>{q.label}</span>
            </button>
          );
        })}
      </div>
      {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
    </div>
  );

  if (isMetaShift) {
    const dateInput = (key: string, label: string, color: string) => (
      <div className="flex flex-col gap-1">
        <label className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{label}</label>
        <input
          type="date"
          value={filterParams.get(key) || ''}
          onChange={(e) => updateFilter(key, e.target.value)}
          className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
        />
      </div>
    );

    const resetAllFilters = () => {
      const params = new URLSearchParams(filterParams.toString());
      ['reg', 'team', 'tour', 'excA', 'dateFrom', 'dateTo', 'reg2', 'team2', 'tour2', 'excB', 'dateFrom2', 'dateTo2'].forEach(k => params.delete(k));
      commitParams(params, { immediate: true });
    };

    return (
      <div className="flex flex-wrap items-start gap-6 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl relative">
        <PendingBadge show={hasPendingEdits} className="top-3 right-28" />
        <button
          onClick={resetAllFilters}
          className="absolute top-3 right-3 text-[10px] font-bold text-red-500 hover:text-red-400 hover:underline uppercase tracking-wider"
        >
          Reset filters
        </button>
        {quickTourChips(false)}

        <div className="self-stretch border-l border-gray-700 mx-1" />

        {/* LEFT side */}
        <div className="flex flex-wrap items-start gap-4">
          <RegionChips
            label="Region A"
            options={regions}
            selected={filterParams.get('reg')?.split(',').filter(Boolean) || []}
            onChange={(values) => updateRegFilter('reg', values)}
            labelColor="text-blue-400"
          />
          <SearchableSelect onClose={flush}
            label="Team A"
            options={teams}
            selected={filterParams.get('team') || ''}
            onChange={(val) => updateFilter('team', val)}
            placeholder="All teams"
            logos={teamLogos}
          />
          {!filterParams.get('team') && (
            <StringMultiSelect onClose={flush}
              label="Exclude Teams A"
              options={teams}
              selected={filterParams.get('excA')?.split(',').filter(x => x !== '') || []}
              onChange={(values) => updateMultiFilter('excA', values)}
              placeholder="Exclude teams..."
              renderOption={withLogo}
              labelColor="text-blue-400"
            />
          )}
          <SearchableMultiSelect onClose={flush}
            label="Tournament A"
            options={tours}
            selected={selA.filter(id => tours.some(t => t.tour_id === id))}
            onChange={(values) => updateMultiFilter('tour', values)}
            disabled={false}
          />
          {dateInput('dateFrom', 'From A', 'text-blue-400')}
          {dateInput('dateTo', 'To A', 'text-blue-400')}
        </div>

        <div className="self-stretch border-l border-gray-700 mx-1" />

        {/* RIGHT side */}
        <div className="flex flex-wrap items-start gap-4">
          <RegionChips
            label="Region B"
            options={regions}
            selected={filterParams.get('reg2')?.split(',').filter(Boolean) || []}
            onChange={(values) => updateRegFilter('reg2', values)}
            labelColor="text-orange-400"
          />
          <SearchableSelect onClose={flush}
            label="Team B"
            options={teams2}
            selected={filterParams.get('team2') || ''}
            onChange={(val) => updateFilter('team2', val)}
            placeholder="All teams"
            logos={teamLogos}
          />
          {!filterParams.get('team2') && (
            <StringMultiSelect onClose={flush}
              label="Exclude Teams B"
              options={teams2}
              selected={filterParams.get('excB')?.split(',').filter(x => x !== '') || []}
              onChange={(values) => updateMultiFilter('excB', values)}
              placeholder="Exclude teams..."
              renderOption={withLogo}
              labelColor="text-orange-400"
            />
          )}
          <SearchableMultiSelect onClose={flush}
            label="Tournament B"
            options={tours2}
            selected={selB.filter(id => tours2.some(t => t.tour_id === id))}
            onChange={(values) => updateMultiFilter('tour2', values)}
            disabled={false}
          />
          {dateInput('dateFrom2', 'From B', 'text-orange-400')}
          {dateInput('dateTo2', 'To B', 'text-orange-400')}
        </div>
      </div>
    );
  }

  const isCompareStats = section === 'compare-stats' || section === 'compare-economy';

  return (
  <div className="flex flex-col gap-4 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl relative">
    <PendingBadge show={hasPendingEdits} className="top-3 right-4" />

    {/* FILA 1: Region, Serie, Last X */}
    <div className="flex flex-wrap items-start gap-6">

      <RegionChips
        label="Region"
        options={regions}
        selected={filterParams.get('reg')?.split(',').filter(Boolean) || []}
        onChange={(values) => updateRegFilter('reg', values)}
      />

      {isCompare
        ? quickTourChips(!filterParams.get('team') && !filterParams.get('team2'), 'First choose the teams')
        : quickTourChips(tourNeedsTeam && !filterParams.get('team'), tourNeedsTeam && !filterParams.get('team') ? 'First choose a team' : undefined)}

      {!isEconomy && (() => {
        // Sin filtro (o 'all') = ambos formatos: los dos chips activos.
        // Con uno solo activo, cualquier click vuelve a 'ambos'.
        const bo = filterParams.get('bo') || 'all';
        const isBoth = bo === 'all';
        return (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Serie</label>
            <div className="flex flex-col gap-2 pt-1">
              {['3', '5'].map(v => {
                const locked = isSeriesOutcomes && v === '5';
                const active = isSeriesOutcomes ? v === '3' : (isBoth || bo === v);
                const tone = locked
                  ? 'bg-transparent border-gray-800 text-gray-600 opacity-50 cursor-default'
                  : active
                    ? `bg-blue-900/40 border-blue-700 text-blue-300 ${isSeriesOutcomes ? 'cursor-default' : 'hover:bg-blue-900/60'}`
                    : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200';
                return (
                  <button
                    key={v}
                    disabled={isSeriesOutcomes}
                    onClick={() => updateFilter('bo', isBoth ? v : '')}
                    title={isSeriesOutcomes ? 'Series Outcomes always uses Bo3 for the series columns; the OT columns cover every format' : undefined}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors border ${tone}`}
                  >
                    BO{v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {isEconomy && (
        <div className="flex flex-col gap-1 justify-end">
          <label className="text-[11px] font-bold text-transparent uppercase tracking-wider">Reset</label>
          <button
            onClick={() => commitParams(new URLSearchParams({ section: "economy" }), { immediate: true })}
            className="px-4 py-2 rounded bg-[#252a33] border border-gray-700 text-sm font-semibold text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {isOverall && (
        <StringMultiSelect onClose={flush}
          label="Exclude Teams"
          options={teams}
          selected={filterParams.get('excA')?.split(',').filter(x => x !== '') || []}
          onChange={(values) => updateMultiFilter('excA', values)}
          placeholder="Exclude teams..."
          renderOption={withLogo}
        />
      )}

      {!isOverall && !isEconomy && (
        <div className={`flex flex-col gap-1 ${isSeriesOutcomes ? 'opacity-50' : ''}`}>
          <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Last X matches</label>
          <select
            value={isSeriesOutcomes ? 'all' : (filterParams.get('last') || "all")}
            onChange={(e) => updateFilter('last', e.target.value)}
            disabled={isSeriesOutcomes}
            title={isSeriesOutcomes ? 'Series Outcomes aggregates every team, so there is no team to take the last N series of' : undefined}
            className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-default"
          >
            <option value="all">All matches</option>
            <option value="1">Last Match</option>
            <option value="3">Last 3</option>
            <option value="5">Last 5</option>
            <option value="10">Last 10</option>
          </select>
        </div>
      )}

    </div>

    {/* FILA 2: Team A, Tournament A, From A, To A */}
    <div className="flex flex-wrap items-start gap-6 pt-3 border-t border-gray-800">

      {!isOverall && !isStatsRank && (
        <SearchableSelect onClose={flush}
          label={section === 'compare-maps' ? 'Team Left' : 'Team'}
          options={teams}
          selected={filterParams.get('team') || ""}
          onChange={(val) => updateFilter('team', val)}
          placeholder="Choose a team"
          logos={teamLogos}
        />
      )}

      <SearchableMultiSelect onClose={flush}
        label="Tournament"
        options={tours}
        selected={selA
          // Solo ids presentes en las opciones: con una región elegida los defaults de otras regiones no cuentan ni se arrastran a la URL
          .filter(id => tours.some(t => t.tour_id === id))}
        onChange={(values) => updateMultiFilter('tour', values)}
        disabled={tourNeedsTeam && !filterParams.get('team')}
      />

      {(isCompareStats || isEconomy || isStatsRank || section === 'map-picks' || section === 'agent-picks' || !section || section === 'maps' || section === 'compare-maps' || section === 'player-stats') && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{isEconomy ? 'From' : 'From A'}</label>
            <input
              type="date"
              value={filterParams.get('dateFrom') || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{isEconomy ? 'To' : 'To A'}</label>
            <input
              type="date"
              value={filterParams.get('dateTo') || ''}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
              className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
            />
          </div>
        </>
      )}

    </div>

    {/* FILA 3: Team B, Tournament B, From B, To B (solo compare) */}
    {isCompare && (
      <div className="flex flex-wrap items-start gap-6 pt-3 border-t border-gray-800">

        <SearchableSelect onClose={flush}
          label={section === 'compare-maps' ? 'Team Right' : 'Team B'}
          options={teams}
          selected={filterParams.get('team2') || ''}
          onChange={(val) => updateFilter('team2', val)}
          placeholder="Choose Team B"
          logos={teamLogos}
        />

        <SearchableMultiSelect onClose={flush}
          label="Tournament (B)"
          options={tours2}
          selected={filterParams.get('tour2')?.split(',').filter(x => x !== '') || []}
          onChange={(values) => updateMultiFilter('tour2', values)}
          disabled={!filterParams.get('team2')}
        />

        {(isCompareStats || section === 'compare-maps') && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">From B</label>
              <input
                type="date"
                value={filterParams.get('dateFrom2') || ''}
                onChange={(e) => updateFilter('dateFrom2', e.target.value)}
                className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">To B</label>
              <input
                type="date"
                value={filterParams.get('dateTo2') || ''}
                onChange={(e) => updateFilter('dateTo2', e.target.value)}
                className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
              />
            </div>
          </>
        )}

      </div>
    )}

    </div>
  );
}
// Avisa que hay cambios elegidos esperando a que venza el debounce antes de navegar.
function PendingBadge({ show, className }: { show: boolean; className: string }) {
  if (!show) return null;
  return (
    <span className={`absolute ${className} text-[10px] font-bold uppercase tracking-wider text-blue-400/80 animate-pulse pointer-events-none`}>
      Loading...
    </span>
  );
}
