// lib/teamKey.ts — team keys, safe to import from client components.
// The page keys a team by a string: its current tag (teams.team_id), or `TAG~<team_id_vlr>` when
// another team has the same tag and is the main one (see getTeamKeys). On screen only the tag shows.
export const teamLabel = (key: string) => key.split('~')[0];
