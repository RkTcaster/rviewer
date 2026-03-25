'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea } from 'recharts';
import { EconomyBin } from '@/lib/types';
import { KPICard } from '@/components/KPICard';

export function EconomySection({ bins }: { bins: EconomyBin[] }) {
  if (bins.every(b => b.count === 0)) {
    return (
      <div className="p-20 text-center border-2 border-dashed rounded-2xl text-gray-400">
        No data available for this selection.
      </div>
    );
  }

  const eco      = bins.filter(b => parseInt(b.label) <  5000).reduce((s, b) => s + b.count, 0);
  const semiEco  = bins.filter(b => parseInt(b.label) >= 5000  && parseInt(b.label) < 15000).reduce((s, b) => s + b.count, 0);
  const semiBuy  = bins.filter(b => parseInt(b.label) >= 15000 && parseInt(b.label) < 20000).reduce((s, b) => s + b.count, 0);
  const fullBuy  = bins.filter(b => parseInt(b.label) >= 20000).reduce((s, b) => s + b.count, 0);
  const total    = eco + semiEco + semiBuy + fullBuy;

  const ecoWins     = bins.filter(b => parseInt(b.label) <  5000).reduce((s, b) => s + b.wins, 0);
  const semiEcoWins = bins.filter(b => parseInt(b.label) >= 5000  && parseInt(b.label) < 15000).reduce((s, b) => s + b.wins, 0);
  const semiBuyWins = bins.filter(b => parseInt(b.label) >= 15000 && parseInt(b.label) < 20000).reduce((s, b) => s + b.wins, 0);
  const fullBuyWins = bins.filter(b => parseInt(b.label) >= 20000).reduce((s, b) => s + b.wins, 0);

  const fmt = (n: number) => n.toLocaleString('en-US');
  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—';
  const wr  = (wins: number, n: number) => n > 0 ? `${Math.round((wins / n) * 100)}%` : '—';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Eco"      value={`${fmt(eco)} (${pct(eco)})`}      label={`Wins: ${fmt(ecoWins)} · WR: ${wr(ecoWins, eco)}`} />
        <KPICard title="Semi-Eco" value={`${fmt(semiEco)} (${pct(semiEco)})`} label={`Wins: ${fmt(semiEcoWins)} · WR: ${wr(semiEcoWins, semiEco)}`} />
        <KPICard title="Semi-Buy" value={`${fmt(semiBuy)} (${pct(semiBuy)})`} label={`Wins: ${fmt(semiBuyWins)} · WR: ${wr(semiBuyWins, semiBuy)}`} />
        <KPICard title="Full-Buy" value={`${fmt(fullBuy)} (${pct(fullBuy)})`} label={`Wins: ${fmt(fullBuyWins)} · WR: ${wr(fullBuyWins, fullBuy)}`} />
      </div>

    <div className="bg-[#1a1d23] rounded-xl border border-gray-800 p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">
        Economy Distribution (rounds)
      </h2>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={bins} margin={{ top: 30, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="label"
            tickFormatter={(v: string, i: number) => i % 5 === 0 ? v : ''}
            tick={{ fill: '#9ca3af', fontSize: 11 }}
            label={{ value: 'Economy', position: 'insideBottom', offset: -15, fill: '#6b7280', fontSize: 12 }}
          />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: '#0f1115', border: '1px solid #374151', borderRadius: 8, color: '#fff' }}
            formatter={(value: unknown) => [`${value}`, 'rounds'] as [string, string]}
            labelFormatter={(label: unknown) => `Economy: ${label}`}
          />
          <ReferenceArea x1="4800" x2="14400" fill="transparent" fillOpacity={0} label={{ value: 'Semi-Eco', position: 'insideTop', fill: '#f59e0b', fontSize: 11, fontWeight: 600 }} />
          <ReferenceLine x="4800" stroke="#f59e0b" strokeDasharray="4 3" label={({ viewBox }: any) => <text x={viewBox.x - 6} y={viewBox.y + 14} textAnchor="end" fill="#f59e0b" fontSize={11} fontWeight={600}>Eco: 5000</text>} />
          <ReferenceLine x="14400" stroke="#f59e0b" strokeDasharray="4 3" label={({ viewBox }: any) => <text x={viewBox.x + 6} y={viewBox.y + 14} textAnchor="start" fill="#f59e0b" fontSize={11} fontWeight={600}>Semi-Buy: 15000</text>} />
          <ReferenceLine x="19800" stroke="#f59e0b" strokeDasharray="4 3" label={({ viewBox }: any) => <text x={viewBox.x + 6} y={viewBox.y + 14} textAnchor="start" fill="#f59e0b" fontSize={11} fontWeight={600}>Full-Buy: 20000</text>} />
          <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    </div>
  );
}
