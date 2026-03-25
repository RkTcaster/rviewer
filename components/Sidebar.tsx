'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, GitCompareArrows, Scale, Map, Users, UserRound, TrendingUp, BarChart2, DollarSign } from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overall',
    items: [
      { id: 'map-picks',   label: 'Map Picks',   icon: Map },
      { id: 'agent-picks',   label: 'Agent Picks',   icon: Users },
      { id: 'meta-shift',    label: 'Meta Shift',    icon: TrendingUp },
      { id: 'economy',       label: 'Economy',       icon: DollarSign },
    ],
  },
  {
    title: 'Team',
    items: [
      { id: 'maps',          label: 'Maps',          icon: LayoutGrid },
      { id: 'compare-maps',  label: 'Compare Maps',  icon: GitCompareArrows },
      { id: 'compare-stats', label: 'Compare Stats', icon: Scale },
      { id: 'graphs',        label: 'Sankey',        icon: BarChart2 },
      { id: 'player-stats',  label: 'Player Stats',  icon: UserRound },
    ],
  },
];

export function Sidebar({ lastUpdateDate }: { lastUpdateDate?: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get('section') || 'maps';

  function navigate(section: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);

    const goingOverall = section === 'map-picks' || section === 'agent-picks' || section === 'meta-shift';
    if (goingOverall) {
      params.delete('team');
      params.delete('tour');
      params.delete('last');
      params.delete('team2');
      params.delete('tour2');
      params.delete('reg2');
      params.delete('dateFrom');
      params.delete('dateTo');
      params.delete('dateFrom2');
      params.delete('dateTo2');
    }

    router.push(`?${params.toString()}`);
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#0f1115] border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-black tracking-widest uppercase text-gray-100">VCT Data</h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Analytics</p>
        {lastUpdateDate && (() => {
          const [y, m, d] = lastUpdateDate.split('T')[0].split('-');
          return <p className="text-[9px] text-gray-600 mt-1">Last update: {d}/{m}/{y.slice(2)}</p>;
        })()}
      </div>

      <nav className="flex flex-col gap-4 px-3 mt-2">
        {NAV_SECTIONS.map(({ title, items }) => (
          <div key={title}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
              {title}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map(({ id, label, icon: Icon }) => {
                const active = currentSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left
                      ${active
                        ? 'bg-[#1a1d23] text-white border-l-2 border-blue-500 pl-[10px] shadow-[inset_0_0_12px_rgba(59,130,246,0.08)]'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1d23]/60'
                      }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800 mt-4">
        <p className="px-1 mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">Contact</p>
        <a
          href="https://x.com/rktcaster"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1d23]/60 transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          rktcaster
        </a>
        <a
          href="https://instagram.com/rktcaster"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-[#1a1d23]/60 transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
          </svg>
          rktcaster
        </a>
      </div>
    </aside>
  );
}
