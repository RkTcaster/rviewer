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
      {/* Título en NEGRO y un poco más grande para coincidir con el resto */}
      {/* <label className="text-[11px] font-bold text-black uppercase tracking-wider">
        Torneos
      </label> */}
      
      {/* Contenedor con borde gris más marcado para que no se vea "lavado" */}
      <div className={`border border-gray-300 rounded bg-white min-w-[240px] max-h-[120px] overflow-y-auto p-2 shadow-sm ${disabled ? 'opacity-50' : ''}`}>
        {options.length === 0 ? (
          <span className="text-xs text-gray-400 italic">No hay torneos disponibles</span>
        ) : (
          options.map((t) => (
            <label 
              key={t.tour_id} 
              className="flex items-center gap-2 text-sm text-black hover:bg-gray-100 p-1 cursor-pointer transition-colors rounded"
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(t.tour_id)}
                onChange={() => toggleOption(t.tour_id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span className="truncate font-medium">{t.event}</span>
            </label>
          ))
        )}
      </div>

      {/* Botón de limpiar selección */}
      {selected.length > 0 && (
        <button 
          onClick={() => onChange([])}
          className="text-[10px] text-blue-600 font-bold hover:text-blue-800 text-left mt-1 flex items-center gap-1"
        >
          ✕ Limpiar selección ({selected.length})
        </button>
      )}
    </div>
  );
}