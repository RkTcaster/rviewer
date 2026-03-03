"use client";
import { useRouter, useSearchParams } from 'next/navigation';

interface FiltersProps {
  teams: string[];
  tours: string[];
}

export function Filters({ teams, tours }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key); // Si elige la opción vacía, borramos el filtro
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4 mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      {/* Selector de Equipo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase">Equipo</label>
        <select 
          onChange={(e) => updateFilter('team', e.target.value)}
          className="border border-gray-300 p-2 rounded-md bg-white min-w-[200px]"
          value={searchParams.get('team') || ""}
        >
          <option value="">Todos los Equipos</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Selector de Torneo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase">Torneo</label>
        <select 
          onChange={(e) => updateFilter('tour', e.target.value)}
          className="border border-gray-300 p-2 rounded-md bg-white min-w-[200px]"
          value={searchParams.get('tour') || ""}
        >
          <option value="">Todos los Torneos</option>
          {tours.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    </div>
  );
}