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
    <div className="flex flex-wrap gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm border">
      {/* region */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase">Región</label>
        <select
          value={searchParams.get('reg') || ""}
          onChange={(e) => updateFilter('reg', e.target.value)}
          className="border p-2 rounded bg-white min-w-[150px] text-sm"
        >
          <option value="">Todas</option>
          {regions.map(r => (
            <option key={r.reg_id} value={r.reg_id}>{r.region}</option>
          ))}
        </select>
      </div>

      {/* team */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase">Equipo</label>
        <select
          value={searchParams.get('team') || ""}
          onChange={(e) => updateFilter('team', e.target.value)}
          className="border p-2 rounded bg-white min-w-[160px] text-sm"
        >
          <option value="">Seleccionar...</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* tournament */}
      <MultiSelect 
        options={tours}
        selected={searchParams.get('tour')?.split(',').filter(x => x !== "") || []}
        onChange={(values) => updateMultiFilter('tour', values)}
        disabled={!searchParams.get('team')}
      />

      {/* Series type */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase">Serie</label>
        <select
          value={searchParams.get('bo') || "all"}
          onChange={(e) => updateFilter('bo', e.target.value)}
          className="border p-2 rounded bg-white min-w-[120px] text-sm"
        >
          <option value="all">BO3 & BO5</option>
          <option value="3">BO3</option>
          <option value="5">BO5</option>
        </select>
      </div>
    </div>
  );
}