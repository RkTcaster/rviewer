import fs from 'fs';
import csv from 'csv-parser';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// 1. Configuración de credenciales
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey || !supabaseUrl) {
  console.error("❌ ERROR: Falta SUPABASE_SERVICE_ROLE_KEY o URL en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. LISTA DE ARCHIVOS A PROCESAR
// Agrega aquí todas tus tablas nuevas con sus PKs
const FILES_TO_UPLOAD = [
  // { file: 'table_regions.csv', table: 'regions', pk: 'reg_id' }, // no deberia updatearse a menos que haya una nueva region
  // { file: 'table_tournament.csv', table: 'tournament', pk: 'tour_id' }, //Update con torneos nuevos
  // { file: 'table_tournament_played.csv', table: 'tournament_played', pk: 'tour_id, teamA' },   
  // { file: 'table_players.csv', table: 'players', pk: 'player_id' }, //solo con players nuevos  
  // { file: 'table_teams.csv', table: 'teams', pk: 'team_id' },

  { file: 'table_maps_name_id.csv', table: 'maps_name_id', pk: 'map_id' },
  { file: 'table_maps_id.csv', table: 'maps_id', pk: 'map_id' },
  { file: 'table_match_id.csv', table: 'match_id', pk: 'series_id' },
  { file: 'table_draft.csv', table: 'draft', pk: 'series_id' },
  { file: 'table_round_info.csv', table: 'round_info', pk: 'team_map_round_id' },
  { file: 'table_team_economy.csv', table: 'team_economy', pk: 'team_map_round_id' }, 
  { file: 'table_player_stats.csv', table: 'player_stats', pk: 'vlr_id-map, player' }, // puede estar mal 
  { file: 'table_player_performance.csv', table: 'player_performance', pk: 'vlr_id-map, player' },

];

async function processFile({ file, table, pk }) {
  const filePath = path.join(process.cwd(), 'data', file);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Saltando: El archivo ${file} no existe en la carpeta /data`);
    return;
  }

  const results = [];
  return new Promise((resolve) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        console.log(`\n📄 Procesando ${file} (${results.length} filas)...`);
        
        const chunkSize = 200; // Bloques para no saturar la API
        for (let i = 0; i < results.length; i += chunkSize) {
          const chunk = results.slice(i, i + chunkSize);
          const { error } = await supabase.from(table).upsert(chunk, { onConflict: pk });
          
          if (error) {
            console.error(`  ❌ Error en ${table} (filas ${i}-${i+chunkSize}):`, error.message);
          } else {
            process.stdout.write(`  ✅ Progreso ${table}: ${Math.min(i + chunkSize, results.length)}/${results.length}\r`);
          }
        }
        console.log(`\n✨ Finalizado: ${table}`);
        resolve();
      });
  });
}

async function runMain() {
  console.log("🚀 Iniciando carga masiva a Supabase...");
  for (const config of FILES_TO_UPLOAD) {
    await processFile(config);
  }
  console.log("\n🏁 Carga masiva completada con éxito.");
}

runMain().catch(err => console.error("Error fatal:", err));