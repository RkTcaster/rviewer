"use client"; // <--- Muy importante: esto le dice a Next.js que es interactivo

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

interface Props {
  data: any[]; // Aquí llegarán los datos de tu CSV
}



export function MyChart({ data }: Props) {
  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Visualización de Datos</h2>
      
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="team" // CAMBIA ESTO: por el nombre de una columna de tu CSV (ej: "fecha" o "producto")
            stroke="#888888"
            fontSize={12}
          />
          <YAxis 
            stroke="#888888"
            fontSize={12}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
          />
          <Legend />
          <Bar 
            dataKey="vlr_id" // CAMBIA ESTO: por el nombre de la columna que tiene los números (ej: "ventas" o "total")
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}