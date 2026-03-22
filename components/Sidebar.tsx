'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, GitCompareArrows, Scale, Map, Users, UserRound } from 'lucide-react';

const NAV_SECTIONS = [
  {
    title: 'Overall',
    items: [
      { id: 'map-picks',   label: 'Map Picks',   icon: Map },
      { id: 'agent-picks',   label: 'Agent Picks',   icon: Users },
    ],
  },
  {
    title: 'Team',
    items: [
      { id: 'maps',          label: 'Maps',          icon: LayoutGrid },
      { id: 'compare-maps',  label: 'Compare Maps',  icon: GitCompareArrows },
      { id: 'compare-stats', label: 'Compare Stats', icon: Scale },
      { id: 'player-stats',  label: 'Player Stats',  icon: UserRound },
    ],
  },
];

export function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get('section') || 'maps';

  function navigate(section: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);

    const goingOverall = section === 'map-picks' || section === 'agent-picks';
    if (goingOverall) {
      params.delete('team');
      params.delete('tour');
      params.delete('last');
      params.delete('team2');
      params.delete('tour2');
    }

    router.push(`?${params.toString()}`);
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#0f1115] border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-black tracking-widest uppercase text-gray-100">VCT Data</h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Analytics</p>
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
    </aside>
  );
}
