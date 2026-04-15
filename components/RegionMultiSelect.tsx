// components/RegionMultiSelect.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Region } from "@/lib/types";

interface Props {
  options: Region[];
  selected: string[];
  onChange: (values: string[]) => void;
  label: string;
  labelColor?: string;
}

export function RegionMultiSelect({ options, selected, onChange, label, labelColor = "text-gray-200" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectedNames = selected
    .map(id => options.find(r => r.reg_id === id)?.region ?? id)
    .join(", ");

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className={`text-[11px] font-bold uppercase tracking-wider ${labelColor}`}>{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm cursor-pointer outline-none focus:ring-2 focus:ring-blue-600"
      >
        <span className="truncate max-w-[180px] font-medium">
          {selected.length === 0 ? "All regions" : selectedNames}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 min-w-full mt-1 bg-[#1e2128] border border-gray-700 rounded-md shadow-xl z-50 overflow-hidden">
          <div className="max-h-[250px] overflow-y-auto">
            {options.map(opt => {
              const isSelected = selected.includes(opt.reg_id);
              return (
                <div
                  key={opt.reg_id}
                  onClick={() => toggleOption(opt.reg_id)}
                  className={`p-2 flex items-center justify-between text-sm cursor-pointer hover:bg-blue-900 transition-colors ${isSelected ? 'bg-blue-900/40 font-bold' : 'font-medium'}`}
                >
                  <span>{opt.region}</span>
                  {isSelected && <Check className="w-4 h-4 text-white ml-2" />}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="p-2 flex items-center justify-between bg-[#1a1d23] border-t border-gray-700">
              <button onClick={() => onChange([])} className="text-[10px] font-bold text-red-500 hover:underline">Reset</button>
              <button onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-blue-600">Cerrar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
