'use client';

import { useState, useEffect, useRef } from 'react';
import { Newspaper } from 'lucide-react';
import type { NewsEntry } from '@/lib/news';

const SEEN_KEY = 'news-seen';

// Botón News de la sidebar: hover abre el cuadro, click lo deja fijo (click afuera o Esc lo cierra).
// El punto azul marca que la fecha de NEWS.md no se abrió todavía en este navegador.
export function NewsButton({ news, compact }: { news: NewsEntry; compact: boolean }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [seen, setSeen] = useState<string | null | undefined>(undefined); // undefined = sin leer localStorage aún
  const ref = useRef<HTMLDivElement>(null);
  const open = hover || pinned;

  useEffect(() => {
    try { setSeen(localStorage.getItem(SEEN_KEY)); } catch { setSeen(null); }
  }, []);

  useEffect(() => {
    if (!open || seen === news.date) return;
    setSeen(news.date);
    try { localStorage.setItem(SEEN_KEY, news.date); } catch {}
  }, [open, seen, news.date]);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPinned(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pinned]);

  const unread = seen !== undefined && seen !== news.date;
  const [y, m, d] = news.date.split('-');

  return (
    <div
      ref={ref}
      className={`relative ${compact ? 'flex justify-center' : 'mt-2'}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={() => setPinned(p => !p)}
        aria-expanded={open}
        title={compact ? 'News' : undefined}
        className={`relative flex items-center gap-1.5 rounded transition-colors ${open ? 'text-blue-300' : 'text-gray-400 hover:text-gray-200'} ${compact ? 'p-1' : 'text-[10px] font-bold uppercase tracking-widest'}`}
      >
        <Newspaper size={compact ? 18 : 12} />
        {!compact && 'News'}
        {unread && <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 ${compact ? 'absolute top-0.5 right-0.5' : ''}`} />}
      </button>

      {open && (
        // pl-3 hace de puente invisible entre el botón y el cuadro para que el hover no se corte
        <div className={`absolute left-full top-0 z-50 pl-3 ${compact ? '-translate-y-1' : '-translate-y-2'}`}>
          <div className="w-72 bg-[#1e2128] border border-gray-700 rounded-md shadow-xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
              Update {d}/{m}/{y?.slice(2)}
            </p>
            <ul className="flex flex-col gap-1.5 text-xs text-gray-300 list-disc pl-4">
              {news.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
