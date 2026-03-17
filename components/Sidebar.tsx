'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LayoutGrid, TrendingUp, BarChart2, Shuffle } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'maps', label: 'Maps', icon: LayoutGrid },
  { id: 'economy', label: 'Economy', icon: TrendingUp },
  { id: 'charts', label: 'Charts', icon: BarChart2 },
  { id: 'draft', label: 'Draft', icon: Shuffle },
];

export function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSection = searchParams.get('section') || 'maps';

  function navigate(section: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    router.push(`?${params.toString()}`);
  }

  return (
    <aside className="w-[220px] min-h-screen bg-[#0f1115] border-r border-gray-800 flex flex-col shrink-0">
      <div className="p-6 pb-4">
        <h2 className="text-lg font-black tracking-widest uppercase text-gray-100">VCT Data</h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Team Analytics</p>
      </div>

      <nav className="flex flex-col gap-1 px-3 mt-2">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentSection === id;
          return (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all text-left
                ${active
                  ? 'bg-[#1a1d23] text-white border-l-2 border-blue-500 pl-[10px]'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1d23]/60'
                }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
