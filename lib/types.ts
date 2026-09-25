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
  pick1: number;
  pick2: number;
  bans: number;
  ban1: number;
  ban2: number;
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

// Tournaments preselected on the Overall table tabs: every regional Stage 2 plus Champions.
// Read both by the server fetch (app/page.tsx) and by the Tournament filter chips
// (components/Filters.tsx), so the two must stay in sync through this constant.
export const STATS_RANK_DEFAULT_TOURS = [
  'vct_2026_americas_stage_2',
  'vct_2026_emea_stage_2',
  'vct_2026_pacific_stage_2',
  'vct_2026_china_stage_2',
  'valorant_champions_2026',
];

// Equipos visibles por defecto en la tabla de Stats Rank y Neon + Phoenix
export const STATS_RANK_DEFAULT_TEAMS = [
  '100T', 'LOUD', 'G2', 'NRG', 'T1', 'JDG', 'FUT', 'GE', 'VIT', 'EDG', 'TYL', 'TL', 'PRX', 'KC', 'XLG', 'NS'
];

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
  deciders: number;
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
  first3Lost: number;
  first3Total: number;
};

// Maps Masters: por equipo y por mapa, victorias/jugados
export type MapWL = { wins: number; played: number; bans: number };
export type MapsMastersData = {
  stats: Record<string, Record<string, MapWL>>;
  maps: string[];
};

// Neon + Phoenix: per team and map — maps played, of those how many had the duo,
// and of the duo ones how many the team won. Its own type because MapWL only carries
// two counters and `bans` has no meaning here.
export type DuoMapStat = { played: number; duo: number; duoWins: number };
export type DuoStatsData = {
  stats: Record<string, Record<string, DuoMapStat>>;
  maps: string[];
};

export type CompositionStat = {
  map: string;
  composition: string;
  played: number;
  nonMirrorPlayed?: number;
  nonMirrorWins?: number;
  winRate?: number;
  teams?: { team: string; played: number }[];
  // Rondas del equipo que llevó la comp, por lado propio
  attWins?: number;
  attTotal?: number;
  defWins?: number;
  defTotal?: number;
};

export type MapCompositionStat = {
  map: string;
  composition: string;
  played: number;
  wins: number;
  attWins: number;
  attTotal: number;
  defWins: number;
  defTotal: number;
  players?: Record<string, string>; // agent → most-frequent player name for this comp
  lastPlayedUrl?: string;
  lastPlayedDate?: string;
};

export type AgentPickStat = {
  agent: string;
  map: string;
  timesPlayed: number;
  pickRate: number;
  totalMaps: number;
  comps: number;        // composiciones jugadas en ese mapa (denominador de pickRate)
  nonMirrorPlayed?: number;
  nonMirrorWins?: number;
};

export type AgentMatchDetail = {
  agent: string;        // agente jugado (para filtrar)
  map: string;
  team: string;         // equipo que jugó el agente
  opponent: string;
  won: boolean;
  date: string;
  url?: string;         // source_url (vlr)
  composition: string[];   // agentes del equipo en ese mapa (ordenados)
  oppComposition: string[];// agentes del rival en ese mapa (ordenados)
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

// Round after a lost pistol (R2 / R14), from the loser's side. eco rounds = losses - forced.
// postEco*: eco rounds whose following round (R3 / R15) has data, and how many of those were won.
export type PostPistolForceStat = { losses: number; forced: number; forcedWins: number; ecoWins: number; postEcoTotal: number; postEcoWins: number };
// *PostPlant: same counters, only for pistols lost by defuse (the loser attacked and planted)
export type TeamPostPistolForce = {
  r2: PostPistolForceStat; r14: PostPistolForceStat;
  r2PostPlant: PostPistolForceStat; r14PostPlant: PostPistolForceStat;
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

export type SkirmishPlayerStat = { name: string; wins: number; losses: number };

export type SkirmishTeamStat = {
  team: string;
  wins: number;
  losses: number;
  matchWins: number;
  bSideWins: number;
  players: SkirmishPlayerStat[];
};

export type SkirmishStats = {
  total: number;
  sideAWins: number;
  sideBWins: number;
  matchSideWinnerSum: number;
  teams: SkirmishTeamStat[];
};

export type SimulationRow = {
  week1_match_1: string;
  week1_match_2: string;
  week1_match_3: string;
  week2_match_1: string;
  week2_match_2: string;
  week2_match_3: string;
  pos1: string;
  pos2: string;
  pos3: string;
  pos4: string;
  pos5: string;
  pos6: string;
  group: string;
  region: string;
  tournament: string;
};

// Secuencia de veto de un equipo en una serie (Bo3: ban → pick → ban; Bo5: ban → pick)
export type VetoFlow = {
  ban1: string;
  pick: string;
  ban2: string | null; // solo Bo3; en Bo5 el select_3 es un pick y no se usa acá
  bo: number;
};

// Un mapa jugado por el equipo, en orden cronológico (para la timeline de forma)
export type FormMapPoint = {
  date: string;
  rival: string;
  event: string;
  map: string;
  roundsWon: number;
  roundsLost: number;
  won: boolean;
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
// Series Outcomes (Bo3 only). Three independent blocks per team:
// veto order (team A opens the veto = draft.team), how the 2-x series were won,
// and overtime maps (a map went to OT when it played more than 24 rounds).
export type SeriesOutcomeStats = {
  series: number; wins: number;        // Bo3 series played / won
  asA: number; asAWins: number;        // as team A (draft.team)
  asB: number; asBWins: number;        // as team B (draft.rival)
  sweeps: number;                      // won 2-0
  down01: number; down01Wins: number;  // lost map 1 → of those, series won
  even11: number; even11Wins: number;  // won map 1 and lost map 2 → of those, series won
  maps: number; otMaps: number; otWins: number;
};

// Circuit-wide counters. Computed per series, not by summing teams (every series
// has two, that would double-count). sweeps + comebacks + closers === series.
export type SeriesOutcomeGlobal = {
  series: number; teamAWins: number;   // series won by the veto's team A
  sweeps: number;                      // 2-0
  comebacks: number;                   // 2-1 where the winner lost map 1
  closers: number;                     // 2-1 where the winner lost map 2
  maps: number; otMaps: number;
};

export type SeriesOutcomesData = {
  global: SeriesOutcomeGlobal;
  teams: Record<string, SeriesOutcomeStats>;
};
