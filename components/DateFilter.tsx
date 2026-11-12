"use client";
// Date filter of the new main filter: one button with the current range ("Any date" without one)
// that opens a panel with From / To and three presets (last 1 / 3 / 6 months). A preset writes
// From = today minus N months and To = today, so it lands in the URL as plain dates like a
// hand-picked range.
import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { useNavigation, useFilterParams } from './NavigationContext';

const PRESETS = [
  { label: 'Last month', months: 1 },
  { label: 'Last 3 months', months: 3 },
  { label: 'Last 6 months', months: 6 },
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthsAgo = (months: number) => {
  const d = new Date();
  return iso(new Date(d.getFullYear(), d.getMonth() - months, d.getDate()));
};
// "2026-08-12" → "12/08/2026"
const dmy = (s: string) => s.split('-').reverse().join('/');

export function DateFilter({ fromKey, toKey }: { fromKey: string; toKey: string }) {
  const { commitParams, flush } = useNavigation();
  const filterParams = useFilterParams();
  const from = filterParams.get(fromKey) || '';
  const to = filterParams.get(toKey) || '';
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Closing applies what was picked without waiting for the debounce, like the selects
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); flush(); };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, flush]);

  const setRange = (nextFrom: string, nextTo: string) => {
    const params = new URLSearchParams(filterParams.toString());
    if (nextFrom) params.set(fromKey, nextFrom); else params.delete(fromKey);
    if (nextTo) params.set(toKey, nextTo); else params.delete(toKey);
    commitParams(params);
  };

  const summary = from && to ? `${dmy(from)} – ${dmy(to)}` : from ? `From ${dmy(from)}` : to ? `Until ${dmy(to)}` : 'Any date';
  const input = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-gray-200 uppercase tracking-wider">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-700 p-2 rounded bg-[#1a1d23] text-gray-200 w-[150px] text-sm outline-none focus:ring-2 focus:ring-blue-600 [color-scheme:dark]"
      />
    </div>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { if (open) flush(); setOpen(!open); }}
        className={`flex items-center justify-between gap-2 border p-2 rounded bg-[#252a33] min-w-[170px] text-sm outline-none focus:ring-1 focus:ring-blue-600 ${
          from || to ? 'border-blue-700 text-blue-300 font-medium' : 'border-gray-700 text-gray-400'
        }`}
      >
        <span className="flex items-center gap-2"><CalendarDays className="w-4 h-4 shrink-0" />{summary}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-[#252a33] border border-gray-700 rounded-lg shadow-xl p-3 flex flex-col gap-3">
          <div className="flex gap-3">
            {input('From', from, v => setRange(v, to))}
            {input('To', to, v => setRange(from, v))}
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-700">
            {PRESETS.map(p => {
              const start = monthsAgo(p.months), today = monthsAgo(0);
              const active = from === start && to === today;
              return (
                <button
                  key={p.months}
                  onClick={() => active ? setRange('', '') : setRange(start, today)}
                  className={`flex-1 px-2 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors border ${
                    active
                      ? 'bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-900/60'
                      : 'bg-transparent border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {(from || to) && (
            <button onClick={() => setRange('', '')} className="self-start text-[10px] font-bold text-red-500 hover:text-red-400 hover:underline uppercase tracking-wider">
              Any date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
