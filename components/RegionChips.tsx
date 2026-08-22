// components/RegionChips.tsx
"use client";
import { Region } from "@/lib/types";

// Orden de los chips, etiqueta a mostrar y logo en public/region (la key es el nombre
// en la DB). Una región que no esté acá va al final y cae al nombre crudo, sin logo.
const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  americas: 'Amer',
  emea: 'EMEA',
  pacific: 'Pacific',
  china: 'China',
};
const REGION_ORDER = Object.keys(REGION_LABELS);
const orderOf = (region: string) => {
  const i = REGION_ORDER.indexOf(region.toLowerCase());
  return i === -1 ? REGION_ORDER.length : i;
};

interface Props {
  options: Region[];
  selected: string[];
  onChange: (values: string[]) => void;
  label: string;
  labelColor?: string;
}

export function RegionChips({ options, selected, onChange, label, labelColor = "text-gray-200" }: Props) {
  // Sin selección = todas las regiones: los chips se pintan activos y el primer click filtra solo por esa
  const isAll = selected.length === 0;

  const toggle = (id: string) => {
    if (isAll) return onChange([id]);
    const next = selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id];
    onChange(next.length === options.length ? [] : next);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className={`text-[11px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</label>
      <div className="flex flex-wrap gap-2">
        {[...options].sort((a, b) => orderOf(a.region) - orderOf(b.region)).map(opt => {
          const active = isAll || selected.includes(opt.reg_id);
          const key = opt.region.toLowerCase();
          return (
            <button
              key={opt.reg_id}
              onClick={() => toggle(opt.reg_id)}
              title={opt.region}
              className={`w-[72px] flex flex-col items-center gap-1 px-2 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-colors border ${
                active
                  ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-transparent border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              {REGION_ORDER.includes(key) && (
                <img
                  src={`/region/${key}.png`}
                  alt={opt.region}
                  className={`w-7 h-7 object-contain shrink-0 transition-opacity ${active ? '' : 'opacity-40 grayscale'}`}
                />
              )}
              <span className={active ? '' : 'line-through'}>{REGION_LABELS[key] ?? opt.region}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
