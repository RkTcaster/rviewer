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

export type OverallMapStat = {
  mapName: string;
  picks: number;
  bans: number;
  deciders: number;
};

export type OverallMapFullStat = {
  mapName: string;
  picks: number;
  bans: number;
  attWins: number;
  attTotal: number;
  defWins: number;
  defTotal: number;
};

export type TeamRankStats = {
  mapWins: number; mapPlayed: number;
  attWins: number; attTotal: number;
  defWins: number; defTotal: number;
  pistolWins: number; pistolTotal: number;
  antiEcoWins: number; antiEcoTotal: number;
  recoveryWins: number; recoveryTotal: number;
  pabWins: number; pabTotal: number;
  pabAtkWins: number; pabAtkTotal: number;
  pabDefWins: number; pabDefTotal: number;
  timeoutLosses: number;
  retakeDe: number;
  retakePl: number;
  postPlantPl: number;
  postPlantDe: number;
};

export type CompositionStat = {
  map: string;
  composition: string;
  played: number;
  nonMirrorPlayed?: number;
  nonMirrorWins?: number;
  winRate?: number;
  teams?: { team: string; played: number }[];
};

export type AgentPickStat = {
  agent: string;
  map: string;
  timesPlayed: number;
  pickRate: number;
  totalMaps: number;
};

export type PlayerStat = {
  player: string;
  agent: string;
  maps: number;
  kills: number;
  deaths: number;
  // K/D
  kd: number; kdAtk: number; kdDef: number;
  // Per-map averages
  rating: number; ratingAtk: number; ratingDef: number;
  acs: number; acsAtk: number; acsDef: number;
  avgKills: number; avgKillsAtk: number; avgKillsDef: number;
  avgDeaths: number; avgDeathsAtk: number; avgDeathsDef: number;
  assists: number; assistsAtk: number; assistsDef: number;
  adr: number; adrAtk: number; adrDef: number;
  hs: number; hsAtk: number; hsDef: number;
  fk: number; fkAtk: number; fkDef: number;
  fd: number; fdAtk: number; fdDef: number;
  fkfd: number; fkfdAtk: number; fkfdDef: number;
  kast: number; kastAtk: number; kastDef: number;
  entry: number; entryAtk: number; entryDef: number;
};

export type TournamentPlayerAvg = {
  kd: number; kdAtk: number; kdDef: number;
  rating: number; ratingAtk: number; ratingDef: number;
  acs: number; acsAtk: number; acsDef: number;
  adr: number; adrAtk: number; adrDef: number;
  hs: number;   hsAtk: number;   hsDef: number;
  fkfd: number; fkfdAtk: number; fkfdDef: number;
  kast: number; kastAtk: number; kastDef: number;
};

export type EconomyBin = { label: string; count: number; wins: number };

export type EconomyMatchup = { played: number; wins: number };
export type EconomyCategoryStats = {
  total:     EconomyMatchup;
  vsEco:     EconomyMatchup;
  vsSemiEco: EconomyMatchup;
  vsSemiBuy: EconomyMatchup;
  vsFullBuy: EconomyMatchup;
};
export type TeamEconomyCompare = {
  eco:     EconomyCategoryStats;
  semiEco: EconomyCategoryStats;
  semiBuy: EconomyCategoryStats;
  fullBuy: EconomyCategoryStats;
};

export type PlayerMatchPoint = {
  seriesId: string;
  date: string;
  rival: string;
  kd: number;     kdAtk: number;     kdDef: number;
  rating: number; ratingAtk: number; ratingDef: number;
  acs: number;    acsAtk: number;    acsDef: number;
  adr: number;    adrAtk: number;    adrDef: number;
  hs: number;     hsAtk: number;     hsDef: number;
  fkfd: number;   fkfdAtk: number;   fkfdDef: number;
  kast: number;   kastAtk: number;   kastDef: number;
  entry: number;  entryAtk: number;  entryDef: number;
  won: boolean;
};

export type PlayerTimeline = {
  player: string;
  agent: string;
  matches: PlayerMatchPoint[];
};

export type PlayerTimelineData = PlayerTimeline[];

export type TopPlayerPerformance = {
  player: string;
  team: string;
  acs: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  kast: number;
  adr: number;
  hs: number;
  fk: number;
  fd: number;
  fkfd: number;
  map: string;
  event: string;
  date: string;
  sourceUrl: string;
};

export type LongestMapEntry = {
  map: string;
  duration: string;
  teamA: string;
  teamB: string;
  event: string;
  date: string;
  rounds: number;
  sourceUrl: string;
};

export type DashboardData = {
  mapStats: MapStat[];
  draftOrder: {
    a: number;
    b: number;
  };
  pistols: { wins: number; total: number };
  antiEco: { wins: number; total: number };
  recovery: { wins: number; total: number };
  pab: { atkWins: number; defWins: number; wins: number; atkTotal:number; defTotal:number, total: number };
  lastMatchData: string | null;
  
};