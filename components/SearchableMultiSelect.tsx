// components/SearchableMultiSelect.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";
import { Tournament } from "@/lib/types";

interface Props {
  options: Tournament[];
  selected: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  label: string;
}

export function SearchableMultiSelect({ options, selected, onChange, disabled, label }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(opt => 
    opt.event.toLowerCase().includes(search.toLowerCase())
  );

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(item => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`flex flex-col gap-1 relative ${disabled ? 'opacity-50' : ''}`} ref={containerRef}>
      <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{label}</label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="flex items-center justify-between border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[240px] text-sm outline-none focus:ring-2 focus:ring-blue-600"
      >
        <span className="truncate max-w-[200px] font-medium">
          {selected.length === 0 ? "Filter by tournamnet" : `${selected.length} seleccionados`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 w-full mt-1 bg-gray border border-gray-200 rounded-md shadow-xl z-50 overflow-hidden">
          <div className="flex items-center border-b px-2 py-1 bg-black-50">
            <Search className="w-3.5 h-3.5 text-black-400" />
            <input 
              autoFocus
              className="w-full p-2 text-sm bg-transparent outline-none"
              placeholder="Filter by tournamnet"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto">
            {filtered.map(opt => (
              <div 
                key={opt.tour_id}
                onClick={() => toggleOption(opt.tour_id)}
                className= "p-2 flex items-center justify-between text-sm cursor-pointer hover:bg-blue-900 transition-colors bg-gray-900 font-bold"
              >
                <span>{opt.event}</span>
                {selected.includes(opt.tour_id) && <Check className="w-5 h-5 text-white-900" />}
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="p-2 flex items-center justify-between bg-gray-900 flex justify-between">
              <button onClick={() => onChange([])} className="text-[10px] font-bold text-red-500 hover:underline">Reset</button>
              <button onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-blue-600">Cerrar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}