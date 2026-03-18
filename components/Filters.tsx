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
}

export function Filters({ regions, teams, tours, tours2 = [] }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCompare = searchParams.get('section') === 'compare';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);

    if (key === 'reg') { params.delete('team'); params.delete('tour'); params.delete('team2'); params.delete('tour2'); }
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

      {/* EQUIPO */}
    <SearchableSelect 
      label="Team"
      options={teams}
      selected={searchParams.get('team') || ""}
      onChange={(val) => updateFilter('team', val)}
      placeholder="Choose a team"
    />

      {/* MULTISELECT TORNEO */}
    <SearchableMultiSelect 
      label="Tournament"
      options={tours}
      selected={searchParams.get('tour')?.split(',').filter(x => x !== "") || []}
      onChange={(values) => updateMultiFilter('tour', values)}
      disabled={!searchParams.get('team')}
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

      {/* SELECTOR: ÚLTIMAS PARTIDAS */}
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