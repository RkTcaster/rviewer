// lib/data/rows.ts — tipos de fila de las tablas de Supabase que lee la capa de datos.
// El cliente no está tipado con el schema, así que estos tipos documentan las columnas
// usadas. Los campos numéricos pueden venir como number o string según el scraper:
// consumir siempre con Number(...).

type Num = number | string | null;

export type DraftRow = {
  series_id: string;
  tour_id: string;
  reg_id: string;
  date: string;
  event: string | null;
  team: string | null;
  rival: string | null;
  bo: Num;
  team_1_select_1: string | null;
  team_1_select_2: string | null;
  team_1_select_3: string | null;
  team_2_select_1: string | null;
  team_2_select_2: string | null;
  team_2_select_3: string | null;
  decider: string | null;
};

export type RoundInfoRow = {
  series_id: string;
  map_id: string;
  map: string;
  round: number | string;
  side: string | null;
  winCon: string | null;
  teamA: string | null;
  teamB: string | null;
  rndA: Num;
  rndB: Num;
};

export type PlayerPerformanceRow = {
  map_id: string;
  team: string | null;
  DE: Num;
  PL: Num;
};

export type PlayerStatsRow = {
  series_id: string;
  map_id: string;
  tour_id: string;
  reg_id: string;
  player: string | null;
  team: string | null;
  agent: string | null;
  map: string | null;
  map_duration: string | null;
  source_url: string | null;
  killsBoth: Num; deadBoth: Num; killsT: Num; deadT: Num; killsCT: Num; deadCT: Num;
  ratingBoth: Num; ratingT: Num; 'rating-ct': Num;
  acsBoth: Num; acsT: Num; acsCT: Num;
  assistsBoth: Num; assistsT: Num; assistsCT: Num;
  adrBoth: Num; adrT: Num; adrCT: Num;
  hsBoth: Num; hsT: Num; hsCT: Num;
  fkBoth: Num; fkT: Num; fkCT: Num;
  fdBoth: Num; fdT: Num; fdCT: Num;
  kastBoth: Num; kastT: Num; kastCT: Num;
};

// Columnas de stats por lado que comparten getPlayerStats / getTournamentPlayerAvg / getPlayerTimeline
export type PlayerStatsCoreStats = Pick<PlayerStatsRow,
  'killsBoth' | 'deadBoth' | 'killsT' | 'deadT' | 'killsCT' | 'deadCT' |
  'ratingBoth' | 'ratingT' | 'rating-ct' |
  'acsBoth' | 'acsT' | 'acsCT' |
  'adrBoth' | 'adrT' | 'adrCT' |
  'hsBoth' | 'hsT' | 'hsCT' |
  'fkBoth' | 'fkT' | 'fkCT' |
  'fdBoth' | 'fdT' | 'fdCT' |
  'kastBoth' | 'kastT' | 'kastCT'>;

export type SkirmishRow = {
  Winner_Side: string | null;
  Match_Side_Winner: Num;
  TeamA: string | null;
  TeamB: string | null;
  PlayerA_score: Num;
  PlayerB_Score: Num;
  TeamA_Player: string | null;
  TeamB_Player: string | null;
};
