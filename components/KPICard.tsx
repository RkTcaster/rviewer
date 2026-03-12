type KPICardVariant = 'neutral' | 'success' | 'danger';

interface KPICardProps {
  title: string;
  label: string;
  value: string;
  variant?: KPICardVariant; // Propiedad opcional
} 

export function KPICard({ title, label, value, variant = 'neutral' }: KPICardProps) {
  
  // Mapeo de estilos según la variante
  const variantStyles = {
    neutral: {
      text: "text-gray-200",
      hover: "hover:border-gray-200",
      label: "text-gray-200"
    },
    success: {
      text: "text-emerald-500", // Verde
      hover: "hover:border-emerald-500",
      label: "text-emerald-500/70"
    },
    danger: {
      text: "text-rose-500", // Rojo
      hover: "hover:border-rose-400",
      label: "text-rose-500/70"
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`bg-[#1a1d23] p-4 rounded-xl shadow-lg border border-gray-800 flex flex-col items-center justify-center transition-all hover:border-blue-900/60 ${styles.hover}`}>
      {/* Título */}
      <h3 className="text-[10px] font-black uppercase tracking-widest mb-1 text-center">
        {title}
      </h3>
      
      {/* Valor principal - Cambia de color según la variante */}
      <p className={`text-2xl font-black leading-tight ${styles.text}`}>
        {value}
      </p>

      {/* Label inferior */}
      <p className={`text-[12px] font-bold mt-1 ${styles.label}`}>
        {label}
      </p>
    </div>
  );
}