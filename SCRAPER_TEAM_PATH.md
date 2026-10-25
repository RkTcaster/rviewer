# `teams.team_path` para tricodes con punto (rviewer → vlr-scraper)

> Registro para el repo **vlr-scraper**. Hoy `team_path` se completa a mano en Supabase; esto
> debería pasar a generarlo el scraper al armar `table_teams.csv`.

Fecha: 2026-10-25. Origen: torneo nuevo de Game Changers (GC).

## El problema

Algunos tricodes de GC vienen con punto: `GEN.GC`, `MIBR.GC`, `NOVA.GC`. Usar el `team_id` tal
cual en el nombre del logo daría `teams/GEN.GC.png` (dos puntos en el path), así que los archivos
en `rviewer/public/teams/` se guardaron **sin el punto**: `GENGC.png`, `MIBRGC.png`, `NOVAGC.png`.

## Condiciones para `team_path`

1. Formato: `teams/<team_id sin puntos>.png`.
2. El `team_id` **no se toca**: sigue siendo `GEN.GC` en `teams` y en el resto de las tablas.
   Solo se sacan los puntos al armar el path.
3. Solo se sacan los puntos. El resto de los caracteres queda igual (por ejemplo, `KRÜ` →
   `teams/KRÜ.png`).
4. Los logos viven en `rviewer/public/teams/`. rviewer lee `team_id, team_path` en
   `lib/data/images.ts` y descarta las filas con `team_path` vacío (el equipo queda sin logo, sin
   error).

En el scraper (pandas), algo así:

```python
teams["team_path"] = "teams/" + teams["team_id"].str.replace(".", "", regex=False) + ".png"
```

Ojo: si `table_teams.csv` no trae la columna `team_path`, el upsert no la pisa. Si la trae vacía,
**sí la pisa** y borra los paths cargados a mano.

## SQL aplicado a mano en Supabase (mientras tanto)

Completa solo las filas sin path, para no tocar las que ya están bien:

```sql
update teams
set team_path = 'teams/' || replace(team_id, '.', '') || '.png'
where team_path is null;
```

Verificación (tiene que devolver 0 filas):

```sql
select team_id from teams where team_path is null;
```

Filas afectadas al 2026-10-25 (10, todas con su logo en `public/teams/`):

| team_id | team_path |
|---|---|
| FLGC | `teams/FLGC.png` |
| G2G | `teams/G2G.png` |
| GEN.GC | `teams/GENGC.png` |
| KRUB | `teams/KRUB.png` |
| M8GC | `teams/M8GC.png` |
| MIBR.GC | `teams/MIBRGC.png` |
| NOVA.GC | `teams/NOVAGC.png` |
| SKN | `teams/SKN.png` |
| SRG | `teams/SRG.png` |
| TLV | `teams/TLV.png` |
