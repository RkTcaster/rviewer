export function KPICard({ title, label, value }: { title: string, label: string, value: string }) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-w-0 w-full transition-all hover:border-blue-200">
      {/* Título más pequeño para que no rompa línea */}
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">
        {title}
      </h3>
      
      {/* Valor principal (Porcentaje o Record) */}
      <p className="text-2xl font-black text-gray-900 leading-tight">
        {value}
      </p>

      {/* Label inferior detallado */}
      <p className="text-[10px] font-bold text-gray-500 mt-1">
        {label}
      </p>
    </div>
  );
}