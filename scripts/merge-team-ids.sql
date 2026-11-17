-- Unifica dos team_id_vlr del mismo equipo: todo lo que está con v_old pasa a v_new.
-- Primer uso: Old School Krew (11720 y 25283, 2026-11-17).
--
-- Cómo correrlo (SQL Editor de Supabase):
--   1. Correr solo la VISTA PREVIA (seleccionarla y Run): muestra las dos filas de `teams` y
--      cuántos mapas tiene cada id. Elegir cuál queda (v_new).
--   2. Cambiar los ids en los TRES lugares marcados con "CAMBIAR" y correr todo el archivo.
--      El merge es una sola transacción: si algo falla, o si al final queda alguna fila con
--      v_old, no cambia nada. El SELECT del final muestra el resultado: v_old ya no aparece.
--
-- Qué toca:
--   - toda columna de id de equipo del schema public, detectada por nombre:
--     team_id_vlr, team_a_id_vlr, team_b_id_vlr, rival_id_vlr, fb_team_id_vlr,
--     victim_team_id_vlr (regex abajo; no toca player_id_vlr)
--   - tournament_played: si los dos ids jugaron el mismo torneo, borra la fila de v_old
--   - teams: completa en la fila de v_new lo que le falte (name, subregion, team_path, relevant)
--     con lo de v_old y borra la fila de v_old. v_subregion (opcional) pisa la subregión.
--     Desde 2026-11-17 el upload de vlr-scraper pisa teams.subregion
--     (handoff/RVIEWER_SUBREGIONES_PACIFIC_Y_EQUIPOS.md): v_subregion solo dura hasta el
--     próximo upload. Para que quede fija, cargarla en lookups.team_subregions del scraper.
--
-- NO toca los tags (teamA, team_a, team...). Si los dos ids usaban tags distintos, la página
-- muestra el de teams.team_id de v_new, pero las columnas de tag viejas quedan como estaban.
--
-- OJO: si vlr-scraper vuelve a subir esas series las trae con el id viejo. Volver a correrlo
-- o resolverlo en el scraper.


-- ===================== VISTA PREVIA (solo lectura) =====================
-- CAMBIAR: los dos ids
with ids(id) as (values ('11720'), ('25283'))
select 'teams' as tabla, t.team_id_vlr::text as id, t.team_id || ' · ' || coalesce(t.name, '') as detalle, 1 as filas
from teams t join ids on t.team_id_vlr::text = ids.id
union all
select 'tournament_played', tp.team_id_vlr::text, string_agg(tp.tour_id::text, ', '), count(*)
from tournament_played tp join ids on tp.team_id_vlr::text = ids.id
group by tp.team_id_vlr
union all
select 'round_info (mapas)', ids.id, string_agg(distinct r.tour_id::text, ', '), count(*)
from round_info r join ids on ids.id in (r.team_a_id_vlr::text, r.team_b_id_vlr::text)
where r.round::text = '1'
group by ids.id
order by 1, 2;


-- ===================== MERGE =====================
begin;

do $$
declare
  -- CAMBIAR: v_old desaparece, v_new queda. v_subregion: null para no tocarla.
  v_old text := '11720';
  v_new text := '25283';
  v_subregion text := null;

  c record;
  n bigint;
  total bigint := 0;
begin
  if v_old = v_new then raise exception 'v_old y v_new son iguales'; end if;

  -- tournament_played: una fila por equipo y torneo; si ya está la de v_new, la de v_old sobra
  delete from tournament_played o
  where o.team_id_vlr::text = v_old
    and exists (select 1 from tournament_played x where x.team_id_vlr::text = v_new and x.tour_id = o.tour_id);

  -- teams: completar la fila de v_new con la de v_old, o renombrar la de v_old si no hay de v_new
  if exists (select 1 from teams where team_id_vlr::text = v_new) then
    update teams t set
      name      = coalesce(t.name, o.name),
      subregion = coalesce(nullif(trim(t.subregion), ''), o.subregion),
      team_path = coalesce(t.team_path, o.team_path),
      relevant  = coalesce(t.relevant, false) or coalesce(o.relevant, false)
    from teams o
    where t.team_id_vlr::text = v_new and o.team_id_vlr::text = v_old;
    delete from teams where team_id_vlr::text = v_old;
  else
    update teams set team_id_vlr = v_new where team_id_vlr::text = v_old;
  end if;
  if v_subregion is not null then
    update teams set subregion = v_subregion where team_id_vlr::text = v_new;
  end if;

  -- Todas las columnas de id de equipo
  for c in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name <> 'teams'
      and column_name ~ '^(team|team_a|team_b|rival|fb_team|victim_team)_id_vlr$'
    order by 1, 2
  loop
    execute format('update %I set %I = %L where %I::text = %L', c.table_name, c.column_name, v_new, c.column_name, v_old);
    get diagnostics n = row_count;
    total := total + n;
    raise notice '%.%: % filas', c.table_name, c.column_name, n;
  end loop;

  -- Si queda algo con v_old, aborta y se deshace todo
  for c in
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and column_name ~ '^(team|team_a|team_b|rival|fb_team|victim_team)_id_vlr$'
  loop
    execute format('select count(*) from %I where %I::text = %L', c.table_name, c.column_name, v_old) into n;
    if n > 0 then raise exception 'Quedan % filas con % en %.%: no se aplicó nada', n, v_old, c.table_name, c.column_name; end if;
  end loop;

  raise notice 'Listo: % filas pasaron de % a %', total, v_old, v_new;
end $$;

commit;


-- ===================== RESULTADO =====================
-- CAMBIAR: los dos ids (mismos que la vista previa). v_old no debería aparecer.
with ids(id) as (values ('11720'), ('25283'))
select 'teams' as tabla, t.team_id_vlr::text as id, t.team_id || ' · ' || coalesce(t.name, '') || ' · ' || coalesce(t.subregion, 'sin subregión') as detalle, 1 as filas
from teams t join ids on t.team_id_vlr::text = ids.id
union all
select 'tournament_played', tp.team_id_vlr::text, string_agg(tp.tour_id::text, ', '), count(*)
from tournament_played tp join ids on tp.team_id_vlr::text = ids.id
group by tp.team_id_vlr
union all
select 'round_info (mapas)', ids.id, string_agg(distinct r.tour_id::text, ', '), count(*)
from round_info r join ids on ids.id in (r.team_a_id_vlr::text, r.team_b_id_vlr::text)
where r.round::text = '1'
group by ids.id
order by 1, 2;
