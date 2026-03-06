// 1. Representa una fila de tu tabla principal 'draft'
export type Draft = {
  team: string;
  rival: string;
  team_1_select_1: string; // Ban 1
  team_2_select_1: string; // Ban 2
  team_1_select_2: string; // Pick 1
  team_2_select_2: string; // Pick 2
  team_1_select_3: string; // Ban 3
  team_2_select_3: string; // Ban 4
  decider: string;
  bo: number;
  reg_id: string;
  tour_id: string;
  event: string;
};

// 2. Para los resultados calculados de la tabla de mapas
export type MapStat = {
  mapName: string;
  picks: number;
  bans: number;
  deciders: number;
  rivalPicks: number;
  rivalBans: number;
  wins: number;
  played: number;
  attWins: number;
  attTotal: number;
  defWins: number;
  defTotal: number;
};

// 3. Para la tabla 'regions'
export type Region = {
  reg_id: string;
  region: string;
};

// 4. Para la tabla 'tournaments_played' o 'tournament'
export type Tournament = {
  tour_id: string;
  event: string;
  reg_id?: string;
};