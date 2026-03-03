export type Match = {
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

export type MapStat = {
  mapName: string;
  picks: number;
  bans: number;
  deciders: number;
};