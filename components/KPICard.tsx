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
      text: "text-gray-900",
      hover: "hover:border-blue-200",
      label: "text-gray-500"
    },
    success: {
      text: "text-emerald-600", // Verde
      hover: "hover:border-emerald-200",
      label: "text-emerald-700/70"
    },
    danger: {
      text: "text-red-600", // Rojo
      hover: "hover:border-red-200",
      label: "text-red-700/70"
    }
  };

  const styles = variantStyles[variant];

  return (
    <div className={`bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center min-w-0 w-full transition-all ${styles.hover}`}>
      {/* Título */}
      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-center">
        {title}
      </h3>
      
      {/* Valor principal - Cambia de color según la variante */}
      <p className={`text-2xl font-black leading-tight ${styles.text}`}>
        {value}
      </p>

      {/* Label inferior */}
      <p className={`text-[10px] font-bold mt-1 ${styles.label}`}>
        {label}
      </p>
    </div>
  );
}