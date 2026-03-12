"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import { Region, Tournament } from '@/lib/types';
import { MultiSelect } from "./MultiSelect";

interface FiltersProps {
  regions: Region[];
  teams: string[];
  tours: Tournament[];
}



export function Filters({ regions, teams, tours }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);

    if (key === 'reg') { params.delete('team'); params.delete('tour'); }
    if (key === 'team') { params.delete('tour'); }

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
    <div className="flex flex-wrap items-start gap-6 mb-8 bg-white p-5 rounded-xl shadow-sm border border-gray-100">

      {/* REGIÓN */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-black uppercase tracking-wider">Region</label>
        <select
          value={searchParams.get('reg') || ""}
          onChange={(e) => updateFilter('reg', e.target.value)}
          className="border border-gray-300 p-2 rounded bg-white min-w-[140px] text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Todas</option>
          {regions.map(r => (
            <option key={r.reg_id} value={r.reg_id}>{r.region}</option>
          ))}
        </select>
      </div>

      {/* EQUIPO */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-black uppercase tracking-wider">Team</label>
        <select
          value={searchParams.get('team') || ""}
          onChange={(e) => updateFilter('team', e.target.value)}
          className="border border-gray-300 p-2 rounded bg-white min-w-[160px] text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">Seleccionar...</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* MULTISELECT TORNEO */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-black uppercase tracking-wider">Tournament</label>
        <MultiSelect
          options={tours}
          selected={searchParams.get('tour')?.split(',').filter(x => x !== "") || []}
          onChange={(values) => updateMultiFilter('tour', values)}
          disabled={!searchParams.get('team')}
        />
      </div>

      {/* SERIE */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-black uppercase tracking-wider">Serie</label>
        <select
          value={searchParams.get('bo') || "all"}
          onChange={(e) => updateFilter('bo', e.target.value)}
          className="border border-gray-300 p-2 rounded bg-white min-w-[120px] text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">BO3 & BO5</option>
          <option value="3">Solo BO3</option>
          <option value="5">Solo BO5</option>
        </select>
      </div>

      {/* SELECTOR: ÚLTIMAS PARTIDAS */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-bold text-black uppercase tracking-wider">Last X matches</label>
        <select
          value={searchParams.get('last') || "all"}
          onChange={(e) => updateFilter('last', e.target.value)}
          className="border border-gray-300 p-2 rounded bg-white min-w-[120px] text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">All matches</option>
          <option value="1">Last Match</option>
          <option value="3">Last 3</option>
          <option value="5">Last 5</option>
          <option value="10">Last 10</option>
        </select>
      </div>

    </div>
  );
}