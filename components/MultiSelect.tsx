// components/MultiSelect.tsx
"use client";
import { Tournament } from "@/lib/types";

interface Props {
  options: Tournament[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

export function MultiSelect({ options, selected, onChange, disabled }: Props) {
  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase">Torneos</label>
      <div className={`border rounded bg-white min-w-[240px] max-h-[120px] overflow-y-auto p-2 ${disabled ? 'opacity-50' : ''}`}>
        {options.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No hay torneos disponibles</span>
        ) : (
          options.map((t) => (
            <label key={t.tour_id} className="flex items-center gap-2 text-sm hover:bg-gray-50 p-1 cursor-pointer">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(t.tour_id)}
                onChange={() => toggleOption(t.tour_id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="truncate">{t.event}</span>
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <button 
          onClick={() => onChange([])}
          className="text-[10px] text-blue-500 hover:underline text-left mt-1"
        >
          Limpiar selección ({selected.length})
        </button>
      )}
    </div>
  );
}