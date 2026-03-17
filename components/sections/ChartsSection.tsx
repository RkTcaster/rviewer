'use client';

import { MapStat } from '@/lib/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  stats: MapStat[];
}

export function ChartsSection({ stats }: Props) {
  const winrateData = stats.map((s) => ({
    map: s.mapName,
    Winrate: s.played > 0 ? Math.round((s.wins / s.played) * 100) : 0,
  }));

  const sideData = stats.map((s) => ({
    map: s.mapName,
    Attack: s.attTotal > 0 ? Math.round((s.attWins / s.attTotal) * 100) : 0,
    Defense: s.defTotal > 0 ? Math.round((s.defWins / s.defTotal) * 100) : 0,
  }));

  const chartStyle = {
    backgroundColor: '#1a1d23',
    borderRadius: '8px',
    border: '1px solid #374151',
  };

  return (
    <div className="space-y-8">
      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Winrate por mapa</h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={winrateData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="map" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={chartStyle}
                labelStyle={{ color: '#e5e7eb', fontWeight: 700 }}
                itemStyle={{ color: '#93c5fd' }}
                formatter={(v) => [`${v}%`, 'Winrate']}
              />
              <Bar dataKey="Winrate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Atk vs Def winrate por mapa</h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sideData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
              <XAxis dataKey="map" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={chartStyle}
                labelStyle={{ color: '#e5e7eb', fontWeight: 700 }}
                formatter={(v, name) => [`${v}%`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              <Bar dataKey="Attack" fill="#fb7185" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Defense" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
