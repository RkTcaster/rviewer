"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import { Region, Tournament } from '@/lib/types';
import { MultiSelect } from "./MultiSelect";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";
import { StringMultiSelect } from "./StringMultiSelect";

interface FiltersProps {
  regions: Region[];
  teams: string[];
  tours: Tournament[];
  tours2?: Tournament[];
  teams2?: string[];
  mode?: 'team' | 'overall' | 'meta-shift' | 'economy';
}

export function Filters({ regions, teams, tours, tours2 = [], teams2 = [], mode = 'team' }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');
  const isCompare = section === 'compare-maps' || section === 'compare-stats' || section === 'compare-economy';
  const isOverall = mode === 'overall';
  const isMetaShift = mode === 'meta-shift';
  const isEconomy = mode === 'economy';
  const isRelevantInfo = section === 'relevant-info';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);

    if (key === 'reg') { params.delete('team'); params.delete('tour'); params.delete('team2'); params.delete('tour2'); params.delete('excA'); }
    if (key === 'reg2') { params.delete('team2'); params.delete('tour2'); params.delete('excB'); }
    if (key === 'team') { params.delete('tour'); if (value) params.delete('excA'); }
    if (key === 'team2') { params.delete('tour2'); if (value) params.delete('excB'); }

    router.push(`?${params.toString()}`);
  };

  const updateMultiFilter = (key: string, values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length > 0) {
      params.set(key, values.join(',')); // Guardamos como "id1,id2,id3"
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  };

  if (isMetaShift) {
    const dateInput = (key: string, label: string, color: string) => (
      <div className="flex flex-col gap-1">
        <label className={`text-[11px] font-bold uppercase tracking-wider ${color}`}>{label}</label>
        <input
          type="date"
          value={searchParams.get(key) || ''}
          onChange={(e) => updateFilter(key, e.target.value)}
          className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
        />
      </div>
    );

    const resetAllFilters = () => {
      const params = new URLSearchParams(searchParams.toString());
      ['reg', 'team', 'tour', 'excA', 'dateFrom', 'dateTo', 'reg2', 'team2', 'tour2', 'excB', 'dateFrom2', 'dateTo2'].forEach(k => params.delete(k));
      router.push(`?${params.toString()}`);
    };

    return (
      <div className="flex flex-wrap items-start gap-6 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl relative">
        <button
          onClick={resetAllFilters}
          className="absolute top-3 right-3 text-[10px] font-bold text-red-500 hover:text-red-400 hover:underline uppercase tracking-wider"
        >
          Reset filters
        </button>
        {/* LEFT side */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Region A</label>
            <select
              value={searchParams.get('reg') || ''}
              onChange={(e) => updateFilter('reg', e.target.value)}
              className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All regions</option>
              {regions.map(r => <option key={r.reg_id} value={r.reg_id}>{r.region}</option>)}
            </select>
          </div>
          <SearchableSelect
            label="Team A"
            options={teams}
            selected={searchParams.get('team') || ''}
            onChange={(val) => updateFilter('team', val)}
            placeholder="All teams"
          />
          {!searchParams.get('team') && (
            <StringMultiSelect
              label="Exclude Teams A"
              options={teams}
              selected={searchParams.get('excA')?.split(',').filter(x => x !== '') || []}
              onChange={(values) => updateMultiFilter('excA', values)}
              placeholder="Exclude teams..."
              labelColor="text-blue-400"
            />
          )}
          <SearchableMultiSelect
            label="Tournament A"
            options={tours}
            selected={searchParams.get('tour')?.split(',').filter(x => x !== '') || []}
            onChange={(values) => updateMultiFilter('tour', values)}
            disabled={false}
          />
          {dateInput('dateFrom', 'From A', 'text-blue-400')}
          {dateInput('dateTo', 'To A', 'text-blue-400')}
        </div>

        <div className="self-stretch border-l border-gray-700 mx-1" />

        {/* RIGHT side */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-orange-400 uppercase tracking-wider">Region B</label>
            <select
              value={searchParams.get('reg2') || ''}
              onChange={(e) => updateFilter('reg2', e.target.value)}
              className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All regions</option>
              {regions.map(r => <option key={r.reg_id} value={r.reg_id}>{r.region}</option>)}
            </select>
          </div>
          <SearchableSelect
            label="Team B"
            options={teams2}
            selected={searchParams.get('team2') || ''}
            onChange={(val) => updateFilter('team2', val)}
            placeholder="All teams"
          />
          {!searchParams.get('team2') && (
            <StringMultiSelect
              label="Exclude Teams B"
              options={teams2}
              selected={searchParams.get('excB')?.split(',').filter(x => x !== '') || []}
              onChange={(values) => updateMultiFilter('excB', values)}
              placeholder="Exclude teams..."
              labelColor="text-orange-400"
            />
          )}
          <SearchableMultiSelect
            label="Tournament B"
            options={tours2}
            selected={searchParams.get('tour2')?.split(',').filter(x => x !== '') || []}
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
  <div className="flex flex-col gap-4 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl">

    {/* FILA 1: Region, Serie, Last X */}
    <div className="flex flex-wrap items-start gap-6">

      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Region</label>
        <select
          value={searchParams.get('reg') || ""}
          onChange={(e) => updateFilter('reg', e.target.value)}
          className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
        >
          <option value="">Todas</option>
          {regions.map(r => (
            <option key={r.reg_id} value={r.reg_id}>{r.region}</option>
          ))}
        </select>
      </div>

      {!isEconomy && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Serie</label>
          <select
            value={searchParams.get('bo') || "all"}
            onChange={(e) => updateFilter('bo', e.target.value)}
            className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">BO3 & BO5</option>
            <option value="3">Solo BO3</option>
            <option value="5">Solo BO5</option>
          </select>
        </div>
      )}

      {isEconomy && (
        <div className="flex flex-col gap-1 justify-end">
          <label className="text-[11px] font-bold text-transparent uppercase tracking-wider">Reset</label>
          <button
            onClick={() => router.push(`?section=economy`)}
            className="px-4 py-2 rounded bg-[#252a33] border border-gray-700 text-sm font-semibold text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      {isOverall && (
        <StringMultiSelect
          label="Exclude Teams"
          options={teams}
          selected={searchParams.get('excA')?.split(',').filter(x => x !== '') || []}
          onChange={(values) => updateMultiFilter('excA', values)}
          placeholder="Exclude teams..."
        />
      )}

      {!isOverall && !isEconomy && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">Last X matches</label>
          <select
            value={searchParams.get('last') || "all"}
            onChange={(e) => updateFilter('last', e.target.value)}
            className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
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

      {!isOverall && (
        <SearchableSelect
          label="Team"
          options={teams}
          selected={searchParams.get('team') || ""}
          onChange={(val) => updateFilter('team', val)}
          placeholder="Choose a team"
        />
      )}

      <SearchableMultiSelect
        label="Tournament"
        options={tours}
        selected={searchParams.get('tour')?.split(',').filter(x => x !== "") || []}
        onChange={(values) => updateMultiFilter('tour', values)}
        disabled={!isOverall && !isEconomy && !isRelevantInfo && !searchParams.get('team')}
      />

      {(isCompareStats || isEconomy || section === 'map-picks' || section === 'agent-picks' || !section || section === 'maps' || section === 'compare-maps' || section === 'player-stats') && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{isEconomy ? 'From' : 'From A'}</label>
            <input
              type="date"
              value={searchParams.get('dateFrom') || ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
              className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{isEconomy ? 'To' : 'To A'}</label>
            <input
              type="date"
              value={searchParams.get('dateTo') || ''}
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

        <SearchableSelect
          label="Team B"
          options={teams}
          selected={searchParams.get('team2') || ''}
          onChange={(val) => updateFilter('team2', val)}
          placeholder="Choose Team B"
        />

        <SearchableMultiSelect
          label="Tournament (B)"
          options={tours2}
          selected={searchParams.get('tour2')?.split(',').filter(x => x !== '') || []}
          onChange={(values) => updateMultiFilter('tour2', values)}
          disabled={!searchParams.get('team2')}
        />

        {(isCompareStats || section === 'compare-maps') && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">From B</label>
              <input
                type="date"
                value={searchParams.get('dateFrom2') || ''}
                onChange={(e) => updateFilter('dateFrom2', e.target.value)}
                className="border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">To B</label>
              <input
                type="date"
                value={searchParams.get('dateTo2') || ''}
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