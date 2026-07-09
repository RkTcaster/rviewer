# Roadmap — rviewer (VCT Data)

Planificación de mejoras y features. Contexto: herramienta **personal** de análisis/casteo,
uso en desktop. La profundidad de datos es la prioridad; mobile y pulido público quedan al final.

Última actualización: 2026-07-09

---

## ✅ Hecho

- **Paralelización de fetches** (jul 2026): los ~35 fetches condicionales de `app/page.tsx`
  pasaron de `await` secuencial a un solo `Promise.all`. Con caché caliente, stats-rank
  bajó de ~6.5s a ~300ms. El overlay de carga existente ahora se ve mucho menos tiempo.
- **1.2 Sankey de veto** (jul 2026): sección "Veto Draft" (Team) con flujo Ban → Pick → Ban 2
  por equipo (`getVetoFlows` + `VetoSection`), más lista de secuencias completas repetidas.
  Verificado contra consulta directa a la tabla `draft` (G2: 26 series, conteos exactos).
- **1.3 Timeline de forma** (jul 2026): sección "Form Timeline" (Team) con WR rodante
  (rondas o mapas, ventana 3/5/10) y puntos coloreados por resultado del mapa
  (`getTeamFormTimeline` + `FormSection`).
- **Fix: paginación de round_info en getMapStats** (jul 2026): la query traía máx. 1000 filas
  (límite de Supabase) y descartaba el resto en silencio → winrates de mapa incorrectos en
  Maps/Compare para equipos con muchas series (G2 mostraba 39W/67 cuando lo real es 42W/67).
  Se corrigió con `fetchAllPages`; el resto de las queries grandes ya paginaban.
- **2.1 Split de data-service.ts** (jul 2026): la implementación vive en `lib/data/*` por dominio
  (`filters`, `rankings`, `draft`, `agents`, `players`, `economy`, `images`, `misc`, más
  `helpers` con `versioned`/`fetchAllPages`/`getLastUpdateDate`). `lib/data-service.ts` quedó
  como barrel de re-exports, así `app/page.tsx` no cambió. Movimiento textual verificado
  (mismos exports + tsc + build + smoke con datos reales).
- **2.2 Tipado de la capa de datos** (jul 2026): `lib/data/rows.ts` define los tipos de fila
  de las tablas (`DraftRow`, `RoundInfoRow`, `PlayerStatsRow`, etc.). Se eliminaron los
  `fetchAllPages<any>`, los callbacks `(d: any)` y los casts `(idQuery as any).order(...)`
  (eran innecesarios: el builder de Supabase devuelve `this`). Los únicos `any` restantes son
  los genéricos de `PostgrestFilterBuilder`, inevitables con el cliente sin schema tipado.

---

## Fase 1 — Nuevas visualizaciones ✅ (cerrada jul 2026)

- **1.1 Heatmap equipos × mapas**: ya existía — `MapsMastersSection` pinta las celdas con
  gradiente HSL por winrate (`heatmapBg`). No hizo falta trabajo.
- **1.2 Sankey de veto**: hecho (ver Hecho).
- **1.3 Timeline de forma**: hecho (ver Hecho). Pendiente opcional: superponer 2 equipos
  en modo Compare.

---

## Fase 2 — Performance restante y arquitectura ✅ (cerrada jul 2026)

- **2.1 Partir `data-service.ts` por dominio**: hecho (ver Hecho). Quedó en `lib/data/*`
  con algunos módulos extra respecto al plan (`filters`, `agents`, `misc`) porque esas
  funciones no encajaban en los 5 dominios originales.
- **2.2 Tipar los `any` de data-service**: hecho (ver Hecho).
- **2.3 (Opcional) Rutas por sección con Suspense/streaming**: descartada por ahora — con la
  paralelización de fetches el overlay actual alcanza. Retomar solo si vuelve a sentirse lento.

## Fase 3 — Mejoras a visualizaciones existentes

- **3.1 Gradiente de color en Stats Rank**: hoy solo se pinta mejor/peor (verde/rojo);
  pasar a escala continua por percentil para leer el pelotón del medio de un vistazo.
- **3.2 Mini-barras inline en celdas de tablas**: barra horizontal proporcional detrás del %
  en Stats Rank y Compare Maps.
- **3.3 Rescatar el Sankey de flujos** (`GraphsSection`, hoy fuera del sidebar): integrarlo
  como pestaña dentro de Compare Stats, que es donde aporta contexto.
- **3.4 Radar de perfil de equipo** en Compare Stats: pentágono (pistol WR, ATK WR, DEF WR,
  retake eff, post-plant WR) superpuesto para los 2 equipos. Datos: `TeamRankStats` ya calculado.
- **3.5 Curva WR vs diferencia económica**: probabilidad de ganar la ronda según gap de
  créditos, desde `team_economy`. Complementa Compare Economy.

## Fase 4 — Pulido (baja prioridad, herramienta personal)

- **4.1 Limpiar sección "Testing" del sidebar**: promover lo que ya sirve (Relevant Info,
  Player Stats) y ocultar el resto.
- **4.2 Unificar idioma de la UI** (hoy mezcla inglés/español).
- **4.3 Sacar el disclaimer del h1 de Playoff %** a un subtítulo.
- **4.4 README propio** (hoy es el default de create-next-app).
- **4.5 Accesibilidad de color**: el verde/rojo como única codificación no funciona para
  daltónicos; acompañar con peso tipográfico o símbolo.
- **4.6 Responsive**: solo si la herramienta pasa a ser pública.

---

## Criterio general de cierre por ítem

Cada feature se considera lista cuando: compila (`npx tsc --noEmit` + `next build`),
la sección renderiza con datos reales del torneo por defecto, y los números mostrados
se verificaron contra al menos un caso contado a mano.
