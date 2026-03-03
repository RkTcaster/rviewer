import { supabase } from '@/lib/supabase';
import { MyChart } from '@/components/DataCharts';
import { DataTable } from '@/components/DataTable';

export default async function Home() {
  // el from tiene la tabla a la que llama
  const { data, error } = await supabase
    .from('draft') 
    .select('*');
  
  // console.log("--- DATOS SUPABASE  ---");
  // console.log(data); 

  if (error) {
    return <div className="p-10 text-red-500">Error cargando datos: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-gray-900">Grafico de Barras y tabla</h1>
          <p className="text-gray-500">Alimentado desde Supabase</p>
        </header>

        <section>
          <MyChart data={data || []} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Tabla entera</h2>
          <DataTable data={data || []} />
        </section>
      </div>
    </main>
  );
}