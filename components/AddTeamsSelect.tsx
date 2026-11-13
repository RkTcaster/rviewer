"use client";
// Chip next to Relevant / All on the main filter: lets a visitor add teams to Relevant for
// themselves. The choice lives in the URL (`addTeams`, vlr ids), not in Supabase: `teams.relevant`
// stays the owner's list and this only extends it for whoever carries the param.
import { useEffect, useRef, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import { TeamOption } from '@/lib/types';
import { useNavigation, useFilterParams } from './NavigationContext';

interface Props {
  // Teams of the selected tournaments that are not relevant
  options: TeamOption[];
  // Chip look of the filter that renders it (active / inactive)
  chipClass: (active: boolean) => string;
}

export function AddTeamsSelect({ options, chipClass }: Props) {
  const { commitParams, flush } = useNavigation();
  const filterParams = useFilterParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = filterParams.get('addTeams')?.split(',').filter(Boolean) ?? [];

  // Closing is the "done choosing" signal: apply without waiting for the debounce
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); flush(); }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, flush]);

  const write = (ids: string[]) => {
    const params = new URLSearchParams(filterParams.toString());
    if (ids.length > 0) params.set('addTeams', ids.join(',')); else params.delete('addTeams');
    commitParams(params);
  };
  const toggle = (id: string) => write(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  const shown = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (open) flush(); setOpen(!open); }}
        className={`${chipClass(selected.length > 0)} flex items-center gap-1`}
        title="Add teams to Relevant (only for you: it is saved in the link)"
      >
        <Plus className="w-3.5 h-3.5" />
        {selected.length > 0 ? `${selected.length} added` : 'Add'}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-[300px] bg-[#1e2128] border border-gray-700 rounded-md shadow-xl z-50 overflow-hidden">
          <div className="flex items-center border-b border-gray-700 px-2 py-1 bg-[#1a1d23]">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              autoFocus
              className="w-full p-2 text-sm bg-transparent outline-none text-gray-200"
              placeholder="Add teams to Relevant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-[250px] overflow-y-auto text-gray-200">
            {shown.length === 0 && <div className="p-2 text-sm text-gray-500">No teams</div>}
            {shown.map(o => {
              const on = selected.includes(o.id);
              return (
                <div
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className={`p-2 flex items-center justify-between gap-2 text-sm cursor-pointer hover:bg-blue-900 transition-colors ${on ? 'bg-blue-900/40 font-bold' : 'font-medium'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {on && <Check className="w-4 h-4 text-white shrink-0" />}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="p-2 bg-[#1a1d23] border-t border-gray-700">
              <button onClick={() => write([])} className="text-[10px] font-bold text-red-500 hover:underline">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
