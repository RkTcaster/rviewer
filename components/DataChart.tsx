"use client"; 

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
  data: any[]; // los datos de calleados
}


export function MyChart({ data }: Props) {
  return (
    <div className="h-[400px] w-full bg-white p-4 rounded-xl shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Visualización de Datos</h2>
      
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="team" 
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
            dataKey="vlr_id" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}