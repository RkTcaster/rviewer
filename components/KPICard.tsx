export function KPICard({ title, label, value }: { title: string, label: string, value: string }) {
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-w-[200px]">
      <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-black text-gray-900">{value}</p>
    </div>
  );
}