"use client";

interface Props {
  data: any[];
}

export function DataTable({ data }: Props) {
  if (!data || data.length === 0) return <p>No hay datos disponibles.</p>;

  // Obtenemos los nombres de las columnas del primer objeto
  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 mt-6">
      <table className="min-w-full divide-y divide-gray-200 bg-white text-sm text-left">
        <thead className="bg-gray-50 text-gray-700 font-bold">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 capitalize">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-3 text-gray-600">
                  {String(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}