-- Unifica el tricode de xXxMasterProMegaTeamxXx (team_id_vlr 23693): XXXM -> MPMT.
--
-- El equipo cambió de tag en medio del VCT 2027 EMEA Kickoff - Europe Qualifier: jugó 6 series
-- como XXXM y la última (786470) como MPMT. `teams` y `players` ya lo tienen como MPMT, así que
-- se pasan a MPMT las 6 series viejas. Ningún otro equipo usa XXXM ni MPMT (revisado 2026-11-12).
--
-- Cómo correrlo: pegar todo en el SQL Editor de Supabase. Es una sola transacción: si al final
-- queda algún XXXM, falla y no cambia nada. El último SELECT muestra las filas por tabla.
--
-- Los series_id van entre comillas porque la columna es numérica en unas tablas y texto en otras
-- (round_summary, round_events).
--
-- Qué toca, solo en esas 6 series:
--   - columnas de tag (teamA / teamB, team_a / team_b, team, victim_team, fb_team)
--   - ids de jugador con prefijo de tag (XXXM_ORI4K -> MPMT_ORI4K)
--   - team_map_round_id, que lleva los dos tags en orden alfabético:
--       KRY-XXXM-784564-Bind-2 -> KRY-MPMT-784564-Bind-2
--       VCE-XXXM-784748-Lotus-1 -> MPMT-VCE-784748-Lotus-1   (MPMT va antes que VCE)
--   - tournament_played: borra la fila XXXM (la de MPMT ya existe)
--
-- OJO: si vlr-scraper vuelve a subir estas series las trae otra vez como XXXM, con los ids
-- viejos, y quedan duplicadas. Hay que volver a correr esto o resolverlo en el scraper.

begin;

update round_info set
  "teamA" = case when "teamA" = 'XXXM' then 'MPMT' else "teamA" end,
  "teamB" = case when "teamB" = 'XXXM' then 'MPMT' else "teamB" end,
  team_map_round_id = case when team_map_round_id like 'VCE-XXXM-%'
    then 'MPMT-VCE-' || substr(team_map_round_id, 10)
    else replace(team_map_round_id, '-XXXM-', '-MPMT-') end
where series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update team_economy set
  team_a = case when team_a = 'XXXM' then 'MPMT' else team_a end,
  team_b = case when team_b = 'XXXM' then 'MPMT' else team_b end,
  team_map_round_id = case when team_map_round_id like 'VCE-XXXM-%'
    then 'MPMT-VCE-' || substr(team_map_round_id, 10)
    else replace(team_map_round_id, '-XXXM-', '-MPMT-') end
where series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update round_buy set
  team_a = case when team_a = 'XXXM' then 'MPMT' else team_a end,
  team_b = case when team_b = 'XXXM' then 'MPMT' else team_b end,
  team_map_round_id = case when team_map_round_id like 'VCE-XXXM-%'
    then 'MPMT-VCE-' || substr(team_map_round_id, 10)
    else replace(team_map_round_id, '-XXXM-', '-MPMT-') end
where series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update round_summary set
  team_a = case when team_a = 'XXXM' then 'MPMT' else team_a end,
  team_b = case when team_b = 'XXXM' then 'MPMT' else team_b end,
  fb_team = case when fb_team = 'XXXM' then 'MPMT' else fb_team end,
  fb_player_id = regexp_replace(fb_player_id, '^XXXM_', 'MPMT_'),
  fb_victim_id = regexp_replace(fb_victim_id, '^XXXM_', 'MPMT_'),
  plant_player_id = regexp_replace(plant_player_id, '^XXXM_', 'MPMT_'),
  defuse_player_id = regexp_replace(defuse_player_id, '^XXXM_', 'MPMT_'),
  team_map_round_id = case when team_map_round_id like 'VCE-XXXM-%'
    then 'MPMT-VCE-' || substr(team_map_round_id, 10)
    else replace(team_map_round_id, '-XXXM-', '-MPMT-') end
where series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update round_events set
  team = case when team = 'XXXM' then 'MPMT' else team end,
  victim_team = case when victim_team = 'XXXM' then 'MPMT' else victim_team end,
  player_id = regexp_replace(player_id, '^XXXM_', 'MPMT_'),
  victim_id = regexp_replace(victim_id, '^XXXM_', 'MPMT_'),
  team_map_round_id = case when team_map_round_id like 'VCE-XXXM-%'
    then 'MPMT-VCE-' || substr(team_map_round_id, 10)
    else replace(team_map_round_id, '-XXXM-', '-MPMT-') end
where series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update player_stats set team = 'MPMT'
where team = 'XXXM' and series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

update player_performance set team = 'MPMT'
where team = 'XXXM' and series_id in ('784564', '784687', '784748', '784779', '784794', '784802');

delete from tournament_played
where "teamA" = 'XXXM' and tour_id = 'vct_2027_emea_kickoff_-_europe_qualifier';

-- Si queda algún XXXM en estas tablas, aborta y se deshace todo
do $$
declare n int;
begin
  select
    (select count(*) from round_info where "teamA" = 'XXXM' or "teamB" = 'XXXM' or team_map_round_id like '%XXXM%')
  + (select count(*) from team_economy where team_a = 'XXXM' or team_b = 'XXXM' or team_map_round_id like '%XXXM%')
  + (select count(*) from round_buy where team_a = 'XXXM' or team_b = 'XXXM' or team_map_round_id like '%XXXM%')
  + (select count(*) from round_summary where team_a = 'XXXM' or team_b = 'XXXM' or fb_team = 'XXXM'
       or team_map_round_id like '%XXXM%' or fb_player_id like 'XXXM\_%' or fb_victim_id like 'XXXM\_%'
       or plant_player_id like 'XXXM\_%' or defuse_player_id like 'XXXM\_%')
  + (select count(*) from round_events
       where series_id in ('784564', '784687', '784748', '784779', '784794', '784802')
         and (team = 'XXXM' or victim_team = 'XXXM' or team_map_round_id like '%XXXM%'
           or player_id like 'XXXM\_%' or victim_id like 'XXXM\_%'))
  + (select count(*) from player_stats where team = 'XXXM')
  + (select count(*) from player_performance where team = 'XXXM')
  + (select count(*) from tournament_played where "teamA" = 'XXXM')
  into n;
  if n > 0 then raise exception 'Quedan % filas con XXXM: no se aplicó nada', n; end if;
end $$;

commit;

-- Esperado (7 series del equipo): round_info 293, team_economy 293, round_buy 293,
-- round_summary 293, round_events 1317 como team, player_stats 85, player_performance 85
select 'round_info' as tabla, count(*) as filas_mpmt from round_info where "teamA" = 'MPMT' or "teamB" = 'MPMT'
union all select 'team_economy', count(*) from team_economy where team_a = 'MPMT' or team_b = 'MPMT'
union all select 'round_buy', count(*) from round_buy where team_a = 'MPMT' or team_b = 'MPMT'
union all select 'round_summary', count(*) from round_summary where team_a = 'MPMT' or team_b = 'MPMT'
union all select 'round_events', count(*) from round_events
  where series_id in ('784564', '784687', '784748', '784779', '784794', '784802', '786470') and team = 'MPMT'
union all select 'player_stats', count(*) from player_stats where team = 'MPMT'
union all select 'player_performance', count(*) from player_performance where team = 'MPMT';
