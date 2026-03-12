"use client";
import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";

interface Props {
  options: string[];
  selected: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}

export function SearchableSelect({ options, selected, onChange, placeholder, label }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1 relative" ref={containerRef}>
      <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border border-gray-700 p-2 rounded bg-[#252a33] text-gray-200 min-w-[140px] text-sm outline-none focus:ring-1 focus:ring-blue-600">
        <span className={selected ? "text-grey-600 font-medium" : "slate-black-900"}>
          {selected || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 slate-black-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 w-full mt-1 bg-gray-600 border border-black-200 rounded-md shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
          <div className="flex items-center border-b px-2 py-1 bg-black-50">
            <Search className="w-3.5 h-3.5 text-black-400" />
            <input 
              autoFocus
              className="w-full p-2 text-sm bg-transparent outline-none"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map(opt => (
                <div 
                  key={opt}
                  onClick={() => { onChange(opt); setIsOpen(false); setSearch(""); }}
                  className={`p-2 text-sm cursor-pointer hover:bg-blue-900 transition-colors ${selected === opt ? 'bg-blue-900 font-bold' : ''}`}
                >
                  {opt}
                </div>
              ))
            ) : (
              <div className="p-3 text-xs text-black-400 text-center">No hay resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}