"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import { Region, Tournament } from '@/lib/types';
import { MultiSelect } from "./MultiSelect";
import { SearchableSelect } from "./SearchableSelect";
import { SearchableMultiSelect } from "./SearchableMultiSelect";

interface FiltersProps {
  regions: Region[];
  teams: string[];
  tours: Tournament[];
  tours2?: Tournament[];
  teams2?: string[];
  mode?: 'team' | 'overall' | 'meta-shift';
}

export function Filters({ regions, teams, tours, tours2 = [], teams2 = [], mode = 'team' }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = searchParams.get('section');
  const isCompare = section === 'compare-maps' || section === 'compare-stats';
  const isOverall = mode === 'overall';
  const isMetaShift = mode === 'meta-shift';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);

    if (key === 'reg') { params.delete('team'); params.delete('tour'); params.delete('team2'); params.delete('tour2'); }
    if (key === 'reg2') { params.delete('team2'); params.delete('tour2'); }
    if (key === 'team') { params.delete('tour'); }
    if (key === 'team2') { params.delete('tour2'); }

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

    return (
      <div className="flex flex-wrap items-start gap-6 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl">
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

  return (
  <div className="flex flex-wrap items-start gap-6 mb-8 bg-[#1a1d23] p-5 rounded-xl border border-gray-800 shadow-xl">

      {/* REGIÓN */}
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

      {/* EQUIPO (solo modo team) */}
      {!isOverall && (
        <SearchableSelect
          label="Team"
          options={teams}
          selected={searchParams.get('team') || ""}
          onChange={(val) => updateFilter('team', val)}
          placeholder="Choose a team"
        />
      )}

      {/* MULTISELECT TORNEO */}
      <SearchableMultiSelect
        label="Tournament"
        options={tours}
        selected={searchParams.get('tour')?.split(',').filter(x => x !== "") || []}
        onChange={(values) => updateMultiFilter('tour', values)}
        disabled={!isOverall && !searchParams.get('team')}
      />

      {/* SERIE */}
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

      {/* SELECTOR: ÚLTIMAS PARTIDAS (solo modo team) */}
      {!isOverall && (
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

      {/* SEPARADOR + TEAM B (solo en modo compare) */}
      {isCompare && (
        <>
          <div className="self-stretch border-l border-gray-700 mx-1" />

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
        </>
      )}

    </div>
  );
}