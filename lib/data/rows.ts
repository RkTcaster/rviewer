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
  map_order: Num;
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

// One row per round (PK team_map_round_id, e.g. "100T-FUT-753446-Lotus-1"). Times are seconds
// into the round; the plant/defuse columns are null when it didn't happen.
export type RoundSummaryRow = {
  team_map_round_id: string;
  series_id: string;
  map_id: string;
  round: number;
  reg_id: string;
  tour_id: string;
  team_a: string;
  team_b: string;
  side_team_a: string;
  fb_player_id: string | null;
  fb_team: string | null;
  fb_victim_id: string | null;
  fb_t: Num;
  plant_t: Num;
  plant_site: string | null;
  plant_player_id: string | null;
  defuse_t: Num;
  defuse_player_id: string | null;
  kills_team_a: Num;
  kills_team_b: Num;
  trades_team_a: Num;
  trades_team_b: Num;
  last_event_t: Num;
};

// One row per event inside a round (PK team_map_round_id + ev_index). type is kill / plant /
// defuse: victim* and weapon only apply to kills, site only to plant/defuse. The table also has
// position columns (pos_x, pos_y, from_x, from_y) that nothing reads yet, so they aren't typed.
export type RoundEventRow = {
  team_map_round_id: string;
  ev_index: number;
  series_id: string;
  map_id: string;
  map: string;
  round: number;
  reg_id: string;
  tour_id: string;
  t_sec: Num;
  type: 'kill' | 'plant' | 'defuse';
  player: string | null;
  player_id: string | null;
  team: string | null;
  side: string | null;
  victim: string | null;
  victim_id: string | null;
  victim_team: string | null;
  weapon: string | null;
  site: string | null;
  is_first_blood: boolean | null;
  is_team_kill: boolean | null;
  is_post_plant: boolean | null;
  is_trade: boolean | null;
  is_traded: boolean | null;
};

// One row per round (PK team_map_round_id): the loadout of each of the ten players. weapon is the
// weapon held that round, not necessarily bought (kept or picked up when spend is below its price).
type RoundBuySlot = `player_${1 | 2 | 3 | 4 | 5}_team_${'a' | 'b'}`;
export type RoundBuyRow = {
  team_map_round_id: string;
  series_id: number | string;
  map_id: string;
  round: number;
  team_a: string;
  team_b: string;
  side_team_a: string;
  reg_id: string;
  tour_id: string;
} & { [K in RoundBuySlot | `${RoundBuySlot}_${'agent' | 'weapon' | 'shield'}`]: string | null }
  & { [K in `${RoundBuySlot}_${'spend' | 'bank'}`]: Num };
