# Roadmap — rviewer (VCT Data)

Planning of improvements and features. Context: **personal** analysis/casting tool,
used on desktop. Data depth is the priority; mobile and public polish come last.

Last updated: 2026-10-05

---

## ✅ Done

- **6.3 Collapsible team panel + one chip size** (oct 2026): the team-chip panel was copied in five
  sections (Stats Rank, Maps Rank, Neon + Phoenix, Post-Pistol Force, Series Outcomes) with three
  chip sizes and small drifts (Maps Rank had no region bulk toggle nor hint). It is now one
  `components/TeamChipsPanel.tsx`: region rows with the logo as bulk toggle, Add all / Clear, a
  `headerExtra` slot (Series Outcomes keeps Legend + Reset there), and a collapsible body whose
  header reads "N / M selected". It starts collapsed; open/closed is a per-viewer preference in
  localStorage shared by the five pages, read through `useSyncExternalStore` (server snapshot =
  collapsed) instead of a setState-in-effect. The chip standard is the compact one (58px, 20px logo,
  12.8px text). The selection model is untouched — still the URL-backed `teams=` from 3.6. Of the
  options considered (hide from the table row, a logo dropdown, presets) only the collapsible panel
  was built. Verified on the built app: the five pages render collapsed with "16 / M selected" by
  default and a `?teams=G2,FNC` link reads "2 / 62".

- **6.2 Default tournaments → quick tournament chips** (oct 2026): the Champs / Stage 2 chips from
  Compare now show on every section with a Tournament filter, and the defaults are visible as chips
  that start active instead of a hidden preselection. Per section: the Stats Rank group, the team
  sections (once a team is picked; Stage 2 resolves to that team's region), Map/Agent Picks and
  Meta Shift (both sides) start on `DEFAULT_TOURS` (renamed from `STATS_RANK_DEFAULT_TOURS`).
  Compare (follow-up, same month) starts each side on `COMPARE_DEFAULT_TOURS` (Champions) only if
  that side's team played it, otherwise on all its tournaments — so `app/page.tsx` awaits both
  teams' `getTours` up front in Compare and reuses them for the Tournament selects. Since every
  section now has defaults, an empty selection is always written as `tour=`. `sectionUsesDefaultTours` (`lib/types.ts`) is the one
  switch read by `app/page.tsx`, which resolves `tour`/`tour2` up front (replacing `effectiveTour`,
  so every fetch inherits it), and by `Filters.tsx`. A missing param means defaults; turning every
  chip off or clearing the Tournament select writes an explicit empty `tour=`, meaning all
  tournaments — `updateMultiFilter` used to delete the param, which would have brought the defaults
  straight back. Verified on the built app (chip state on 9 URLs across the four kinds of section)
  and against an independent `round_info` count: G2 reads 37 maps / 23 wins on the defaults and
  107 / 66 on all tournaments, matching `getMapStats`.

- **6.1 Team logos in every team select** (oct 2026): `app/page.tsx` now fetches `teamLogos` for
  every section that renders `Filters` (`showsFilters`: all but Skirmish, Playoff % and Veto
  Predictor, which has its own) instead of growing a per-section list, and always forwards them.
  `Filters.tsx` passes them to the Team select of every team-mode section, Team A/B in Meta Shift,
  and the three Exclude Teams multiselects through `StringMultiSelect`'s existing `renderOption`
  (no new prop). All 64 teams in `getTeams()` have a logo. Verified on the built app: the selected
  team's logo renders in the trigger for Maps, Economy, Meta Shift, Player Stats and Relevant Info.

- **Series Outcomes** (sep 2026): new Testing section, the first aggregation the dashboard does at
  **series** level — everything else reasons per map. Three independent blocks per team: win rate as
  team A (the side that opens the veto, `draft.team`, the same notion as the existing `draftOrder`
  counters) vs as team B; the exact partition of the series played into `2-0` / lost map 1 / won map 1
  and lost map 2, with the series win rate inside each; and win rate on maps that went to overtime.
  The series blocks are **Bo3 only** — that partition is exact only in a Bo3, and there are 533 Bo3
  against 27 Bo5 — but the overtime block is per map and deliberately covers **every format**. That
  split was a fix, not the first design: scoping OT to Bo3 as a side effect of the series scope
  silently dropped the Bo5 playoff finals, which is exactly where the high-stakes OT maps are
  (100T read 0-3 in OT because the Americas Stage 2 grand final, a Bo5 they won with two 14-12 maps,
  was filtered out; it now reads 2-3). In the four default tours that filter was hiding 4 of 75 OT
  maps across 8 Bo5 series, all of them `gf` or `lbf`. Two unused DB columns did the heavy lifting: `round_info.map_order` (0-based map index inside the
  series), referenced by no file until now, which is what separates "lost map 1" from "lost map 2"
  without inferring it from the veto; and overtime, not modelled anywhere, derived as
  `MAX(round) > 24` (24 is the regulation maximum before a 12-12 tie; OT always comes in pairs).
  `map_order` was verified to enumerate 0..n-1 in all 238 Bo3 series of the four default tours
  (131 of shape `0,1` and 107 of `0,1,2`, zero anomalies). Numbers checked against an independent
  recomputation straight from Supabase: 238 series, team A wins 118 (49.6% — opening the veto buys
  nothing at series level), 131 sweeps + 58 comebacks + 49 closers = 238, and 75 of 616 maps in OT.
  Per-team invariants hold on all 62 teams (`series = 2-0 + down01 + even11`,
  `wins = 2-0 + down01Wins + even11Wins`).

- **3.6 URL-backed filter model for the Overall table sections** (sep 2026): team (and map)
  selection in Stats Rank, Maps Rank and Neon + Phoenix moved from ephemeral `useState` into the URL,
  so a view is shareable by link and survives reload. Kept **off** the Next router: the selection is
  pure client filtering over already-fetched data, so a new `useUrlSet` hook (`hooks/useUrlSet.ts`)
  seeds from the query param on mount and mirrors changes back with `history.replaceState` — no server
  round-trip, chips stay instant. Canonical shape: `teams` stores the selected set, `hideMaps` the
  hidden maps; the param is written only when it differs from the defaults, so an absent param means
  "defaults" and the URL stays clean. Neon + Phoenix, which reasons internally in `hiddenTeams`
  (opt-out), was converted to a URL-backed `selectedTeams` with `hiddenTeams` derived, so the three
  now share one canonical `teams=` shape. No cross-page carry-over (Sidebar still clean-starts) and
  Reset stays per section, per the sep 2026 feasibility review. Verified end-to-end via CDP: a chip
  click updates `location.search` to the sorted selected set without navigating, and a crafted
  `?teams=…` link boots each section (incl. Neon's opt-out conversion) to exactly those teams.
- **Shared Stats Rank defaults** (sep 2026): `STATS_RANK_DEFAULT_TEAMS` was rewritten to a new
  16-team list and now seeds Stats Rank and Maps Rank (`maps-masters`) too, not just Neon + Phoenix —
  those sections start with the 16 teams selected instead of empty. `STATS_RANK_DEFAULT_TOURS`
  (the four Stage 2) now preselects on all three, via `effectiveTour` in `app/page.tsx` and the
  chip default in `Filters.tsx`. Both constant names are accurate again.
- **Neon Dependency → Neon + Phoenix** (aug 2026): the metric changed from "how often the team
  fielded Neon" to "how often it fielded Neon **and** Phoenix on the same map" — an intersection,
  so a map counts once even with both agents and the cell can never exceed 100%. Added `duoWins`
  (map winner from `round_info`, same last-round pattern the rest of the module uses), so each
  cell also shows the win rate on the duo maps. New `DuoMapStat` type instead of stretching
  `MapWL`, whose `bans` had no meaning here. Verified against Supabase: the implementation matched
  an independent per-`map_id` count on all 341 cells, 538/538 maps resolved a winner, and the
  aggregate landed at 49% WR (the sanity signal that team names match across the two tables).
- **4.4 Own README** (aug 2026): replaced the create-next-app default. Covers setup, the
  single-route architecture, the `lib/data/*` split, `versioned`/`fetchAllPages`, the debounced
  filters, a section-by-section table, the query params and the CSV upload flow. Written in
  English, along with this roadmap.
- **Neon + Phoenix table rework** (aug 2026): region logos replacing text labels and doubling as
  bulk region toggles; team chips in the Maps Rank card format with an Add all / Clear button;
  agent icons in place of the "duo" label; the Maps Rank Overall format with its ✓/−/✗ rules; an
  `All` row with the raw sum over the selected teams; map chips on a single row. The Add all
  button forced a companion fix: the section was guarded on `baseTeams.length`, so clearing every
  team hid the chips and locked the user out — now guarded on `allTeams.length`, as Maps Rank
  already did.
- **`Tooltip` with portal + section legend** (aug 2026): `components/Tooltip.tsx`, a ~70-line
  primitive with `createPortal`, `fixed` positioning off the trigger rect, edge clamping and
  flip-up. The portal is what lets a tooltip live inside the tables, whose `overflow-x-auto`
  container clips any absolutely positioned descendant. First consumer: the `ⓘ Legend` in
  Neon + Phoenix, which documents the duo %, the WR sample, the tick thresholds and the `All` row.
  No new dependency.
- **Region logos in the Stats Rank team filter** (aug 2026): same treatment as Neon + Phoenix —
  logos replacing the text labels, clickable to add or clear a whole region, dimmed when none of
  the row is picked, plus the hint next to Add all / Clear. The toggle had to be written inverted
  between the two sections: Stats Rank tracks `selectedTeams` (opt-in) while
  Neon + Phoenix tracks `hiddenTeams` (opt-out) — both now seeded from `STATS_RANK_DEFAULT_TEAMS`
  (see the sep 2026 entry; Stats Rank originally started empty).
- **Stage 2 as the default tournaments** (aug 2026): `STATS_RANK_DEFAULT_TOURS` moved from a mix
  of Stage 1 plus two international events to the four regional Stage 2 (218 series). It originally
  fed only Neon + Phoenix; since the sep 2026 entry it also preselects on Stats Rank.
- **Parallelized fetches** (jul 2026): the ~35 conditional fetches in `app/page.tsx` went from
  sequential `await`s to a single `Promise.all`. With a warm cache, stats-rank dropped from
  ~6.5s to ~300ms. The existing loading overlay is now visible for far less time.
- **1.2 Veto Sankey** (jul 2026): "Veto Draft" section (Team) with a Ban → Pick → Ban 2 flow
  per team (`getVetoFlows` + `VetoSection`), plus a list of repeated full sequences.
  Verified against a direct query on the `draft` table (G2: 26 series, exact counts).
- **1.3 Form timeline** (jul 2026): "Form Timeline" section (Team) with rolling WR
  (rounds or maps, 3/5/10 window) and points colored by map result
  (`getTeamFormTimeline` + `FormSection`).
- **Fix: `round_info` pagination in `getMapStats`** (jul 2026): the query fetched at most 1000
  rows (Supabase limit) and silently dropped the rest → wrong map win rates in Maps/Compare for
  teams with many series (G2 showed 39W/67 when the real figure is 42W/67). Fixed with
  `fetchAllPages`; the other large queries already paginated.
- **2.1 Splitting `data-service.ts`** (jul 2026): the implementation now lives in `lib/data/*`
  by domain (`filters`, `rankings`, `draft`, `agents`, `players`, `economy`, `images`, `misc`,
  plus `helpers` with `versioned`/`fetchAllPages`/`getLastUpdateDate`). `lib/data-service.ts`
  became a re-export barrel, so `app/page.tsx` didn't change. Verified as a textual move
  (same exports + tsc + build + smoke test with real data).
- **2.2 Typing the data layer** (jul 2026): `lib/data/rows.ts` defines the row types for the
  tables (`DraftRow`, `RoundInfoRow`, `PlayerStatsRow`, etc.). The `fetchAllPages<any>` calls,
  the `(d: any)` callbacks and the `(idQuery as any).order(...)` casts were removed (they were
  unnecessary: the Supabase builder returns `this`). The only remaining `any`s are the generics
  of `PostgrestFilterBuilder`, unavoidable with an untyped-schema client.

---

## Ongoing — translate code comments to English

The codebase still has ~214 comment lines in Spanish across ~31 files (heaviest:
`lib/data/draft.ts`, `lib/data/agents.ts`, `components/sections/AgentPicksSection.tsx`,
`components/sections/MapsMastersSection.tsx`, `lib/types.ts`, `components/NavigationContext.tsx`).

Not a one-shot refactor — done **opportunistically**:

- **When reading a file** as part of another task: translate its Spanish comments in the same pass.
- **When modifying a file**: translate the comments in the area being touched, at minimum.
- **New comments are written in English**, always.

Rules so this doesn't turn into noise in the diffs:

- Translate the comment, don't rewrite it. If a comment explains *why* (the Supabase 1000-row
  limit, the debounce, a verified bug), that reasoning has to survive intact.
- Don't add comments that weren't there, and don't delete ones that were.
- Comment-only changes ride along with the commit for the actual task; no separate
  "translate comments" commits per file.

Done when `grep` finds no Spanish comments left, at which point the README's conventions note
("code comments in Spanish") gets dropped.

---

## Phase 1 — New visualizations ✅ (closed jul 2026)

- **1.1 Teams × maps heatmap**: already existed — `MapsMastersSection` paints the cells with an
  HSL gradient by win rate (`heatmapBg`). No work needed.
- **1.2 Veto Sankey**: done (see Done).
- **1.3 Form timeline**: done (see Done). Optional pending item: overlay 2 teams in Compare mode.

---

## Phase 2 — Remaining performance and architecture ✅ (closed jul 2026)

- **2.1 Split `data-service.ts` by domain**: done (see Done). It ended up in `lib/data/*` with a
  few extra modules compared to the plan (`filters`, `agents`, `misc`) because those functions
  didn't fit the original 5 domains.
- **2.2 Type the `any`s in data-service**: done (see Done).
- **2.3 (Optional) Per-section routes with Suspense/streaming**: dropped for now — with the
  parallelized fetches the current overlay is enough. Revisit only if it starts feeling slow again.

## Phase 3 — Improvements to existing visualizations

- **3.1 Color gradient in Stats Rank**: today only best/worst are painted (green/red);
  move to a continuous percentile scale to read the middle of the pack at a glance.
- **3.2 Inline mini-bars in table cells**: a proportional horizontal bar behind the % in
  Stats Rank and Compare Maps.
- **3.3 Salvage the flow Sankey** (`GraphsSection`, currently outside the sidebar): integrate it
  as a tab inside Compare Stats, which is where it adds context.
- **3.4 Team profile radar** in Compare Stats: a pentagon (pistol WR, ATK WR, DEF WR, retake eff,
  post-plant WR) overlaid for the 2 teams. Data: `TeamRankStats` is already computed.
- **3.5 WR vs economy difference curve**: probability of winning the round given the credit gap,
  from `team_economy`. Complements Compare Economy.
- **3.6 URL-backed filter model for the Overall table sections**: done (see Done, sep 2026).

## Phase 4 — Polish (low priority, personal tool)

- **4.1 Clean up the "Testing" sidebar section**: partly advanced (aug 2026) — Skirmish Americas
  and Form Timeline are hidden, and Veto Draft moved from Team into Testing. Still pending:
  decide whether Relevant Info, Economy and Player Stats get promoted or dropped.
- **4.2 Unify the UI language** (currently a mix of English/Spanish). Related but separate from
  the Ongoing item above, which covers code comments rather than what the UI shows.
- **4.3 Move the Playoff % disclaimer out of the h1** into a subtitle.
- **4.4 Own README**: done (see Done).
- **4.5 Color accessibility**: green/red as the only encoding doesn't work for colorblind users;
  pair it with font weight or a symbol.
- **4.6 Responsive**: only if the tool ever goes public.

## Phase 5 — Default tournaments from the DB

- **5.1 Evaluate a boolean `default` column in `tournament`**: assess whether a `true/false` column
  can replace the hardcoded `DEFAULT_TOURS` (`lib/types.ts`), so the default tournaments
  are changed from the Supabase dashboard instead of a code edit + deploy (they change every few
  weeks: the four Stage 2 + Champions 2026 as of sep 2026). Same pattern as the DB-driven default
  hidden maps (`defaultHiddenMaps`). To evaluate before implementing: whether the CSV upload flow
  (`scripts/upload.mjs`, `table_tournament.csv`) would overwrite the column, the cache TTL, and
  collapsing the section list duplicated in `app/page.tsx`, `components/Filters.tsx` and
  `components/Sidebar.tsx` into one place.

## Phase 6 — Filters UX

- **6.1 Team logos in the remaining selects**: done (see Done, oct 2026).
- **6.2 Default tournaments → quick tournament chips**: done (see Done, oct 2026). Still relevant
  for 5.1: a DB-driven default would now decide which chips start active.
- **6.3 Hiding teams in table pages like Stats Rank**: done (see Done, oct 2026) as a collapsible
  panel. Still open if the need comes back: hiding a team from its table row, or saved presets.

## Phase 7 — Operator Use (in progress)

First version shipped oct 2026 under Testing (`components/sections/OperatorUseSection.tsx`,
`getOperatorUseStats` in `lib/data/economy.ts`), reading the new `round_buy` table joined with
`team_economy` (`map_id` + `round`, same `team_a`; 1180/1180 rows match on Champions 2026).
Eligible rounds = played minus 1, 2, 13 and 14. Same filters as Maps Rank; map chips filter which
maps are summed, Both / ATK / DEF chips pick the side, Detail info adds the `x/y` counts. Columns:

- **Op pick rate**: eligible rounds where ≥1 player held an Operator. `round_buy`'s weapon is the
  weapon *held*, not bought: 280 of 549 Operator entries had spend < 4700 (kept or picked up),
  so the metric counts holding, and **Kept** breaks it down. Kept (reworked oct 2026, see below):
  the holder had that Op the previous round (`round_buy` of round − 1) and either survived it
  (no kill with them as victim in `round_events`) or died but the team won and picked it up. A
  round is Kept for the team when any holder kept it.
- **Save Op**: Kept rounds whose previous round the team lost (`team_economy.win_A` of round − 1;
  rounds 2 and 14 count as the previous round), over Kept — so the holder survived.
- **Op WR / No-Op WR**: round win rate (`team_economy.win_A`) with and without an Op.
- **Full buy / Half buy**: Op rate by team loadout, reusing `classifyEconomy` (full ≥ 20000,
  half = semiBuy 15000–19999, lower buys left out).
- **Agents**: Op holders by agent (icons from `getAgentImages`).

Clicking a team expands its players with the same columns, counted over the rounds where *that
player* held the Op (kept by the same rule; WR and loadout are the team's). Double Op was
considered and dropped: 5 rounds in all of Champions 2026.

Verified against an independent count from Supabase on PRX: 51/146 Op rounds, 25 kept, Op WR
27/51, No-Op WR 45/95, full buy 50/110, half buy 0/21, agents Chamber 26 / Yoru 24 / Viper 1 /
Sage 1; something 35/146 (19 won, 18 kept), d4v41 17/146 (9 won, 8 kept). Invariants hold on
all 16 default teams (`opDecided + noOpDecided = eligible`, `kept <= op`, per player
`sum(agents) = op`). Still to work on:

- **Kept rework** (oct 2026): Kept used to be "spend < 4700", applied per player but as "every
  holder kept" per team, so T1 showed 38/80 kept while Meteor alone had 39/78 (FUT-T1 Ascent
  r12: Meteor spent 4400 with an Op after dying in r11, BuZz spent 9100). Crossing with
  `round_events` showed spend can't tell kept from dropped or picked up: of 322 player-rounds with
  spend < 4700, 190 had the Op and survived, 62 died but the team won (picked up — counted as
  kept for team and player, user's call), and 70 were drops from a teammate (20), Ops taken from
  the enemy (43) or holders who died in a lost round (7). Player ids join as
  `<team>_<player>` = `round_events.victim_id` (12970/12970 slots match). Cache key bumped to
  `operator-use-stats-v3`. Verified in the built app against an independent count: T1 32/80 kept,
  6 saved (Meteor 32/78); PRX 28/65, 5 saved (something 17/42, d4v41 11/24); `kept <= op`,
  `saved <= kept` and player kept ≤ team kept hold on all 16 teams. Kept now depends on
  `round_events` being loaded for the same tournaments as `round_buy`: without kill rows every
  holder counts as having survived.
- **Operator / Outlaw chips** (oct 2026): two independent chips, at least one stays on. Operator
  alone = the table as before, Outlaw alone = same columns for the Outlaw, both = rounds with
  either weapon. The server computes the three variants (`OperatorUseData.byWeapon`: `op`,
  `outlaw`, `both`) because the combined one can't be summed from the others (no-weapon rounds,
  round-level kept and WR change); column labels and the legend follow the choice. Kept needs the
  same weapon the previous round (Op → Outlaw is not kept). Marshal is left out (34 holder
  entries in Champions 2026 against 627 Operator and 162 Outlaw). Outlaw and Op+Outlaw leave out
  only rounds 1 and 13: the Outlaw shows up in round 2 (13 of 124 team-rounds) and 14 (17 of 124),
  the Op never does, so Operator alone keeps leaving out 1, 2, 13 and 14 and the eligible
  denominator differs between modes. Cache key `operator-use-stats-v5`.
  Verified in the built app against an independent count on Champions 2026 (eligible / Op rounds /
  kept / saved / won): T1 Op 206 / 80 / 32 / 6 / 39 (unchanged), Outlaw 230 / 9 / 0 / 0 / 8, both
  230 / 89 / 32 / 6 / 47; PRX Op 197 / 65 / 28 / 5 / 35, Outlaw 219 / 23 / 5 / 0 / 9, both
  219 / 88 / 33 / 5 / 44, per-player counts matching too.
  On all 16 teams, `both.op` ≥ each single weapon's op. The chips weren't clicked by hand.
- **Kills and first kills** (oct 2026): three count columns (not %, no heatmap, still
  sortable): `<w> kills`, `<w> FK` and `FK` (first kills with any weapon over every eligible
  round). From `round_events` (`player_id` = `<team>_<player>`, team kills left out), following
  the weapon chips and each mode's eligible rounds; a kill counts by its own weapon even when
  `round_buy` shows the player without it. The Chamber ult is "Tour de Force" in the data and is
  not counted as an Op. Cache key `operator-use-stats-v6`. Verified in the built app against a
  count straight from `round_events` on Champions 2026: T1 Op 59 kills / 18 FK / 105 FK total,
  Outlaw 10 / 4 / 112, both 69 / 22 / 112; PRX Op 35 / 7 / 100, Outlaw 12 / 4 / 112, both
  47 / 11 / 112; all teams' FK 1048 (Op) and 1168 (Outlaw / both); per-player counts match, and
  each team equals the sum of its players.
- **First deaths** (oct 2026): `<w> FD` and `FD`, also plain counts. The kill only records the
  killer's weapon, so a first death counts for the weapon when `round_buy` shows the victim
  holding it that round (a player who bought an Op for a teammate and died first with a rifle
  would count). Cache key `operator-use-stats-v7`. Verified in the built app against first-blood
  kills from `round_events` joined to the victim's `round_buy` weapon on Champions 2026: T1 Op
  11 FD / 101 FD total, Outlaw 0 / 117, both 11 / 117; PRX Op 11 / 97, Outlaw 2 / 107, both
  13 / 107; all teams' FD = all teams' FK (1048 Op, 1168 Outlaw / both); per-player counts match.
- **First duel columns** (oct 2026): to cut the column count, `<w> FK`, `FK`, `<w> FD` and `FD`
  were replaced by two %: `<w> first duel` = opFk / (opFk + opFd) and `First duel` =
  fk / (fk + fd); with Detail info each shows its counts as `X FK - Y FD` on one line instead of x/y. Client-only:
  the payload and cache key (`v7`) didn't change. Expected on T1 Op: 18/29 = 62% and
  105/206 = 51%.
- **7.1 More data in `round_buy`**: only Champions 2026 is loaded (24 series). The section picks
  up other tournaments on its own once their rows are uploaded.
- **7.2 Check the chips in the browser**: team, map, side and Detail info chips, sortable
  headers and team expansion were not tested by hand yet.
- **7.3 Cache staleness**: `versioned()` keys on the latest `draft` date, so uploading
  `round_buy` rows without new `draft` rows can show stale data for up to 24 h. It already bit
  once (oct 2026): `round_buy` went to production without an RLS read policy (local uses the
  service_role key, which skips RLS), every filter combination opened then cached an empty result,
  and those kept showing "No Operator data" after the policy was added, while combinations never
  opened before worked. Fixed by bumping the key to `operator-use-stats-v2`. A new table needs its
  read policy before the first deploy that reads it.
- **7.4 Next iterations, to decide**: Op round WR, Op by agent and buy context are done.
  Still open: per-map columns (the per-map counters already exist), Op vs Op rounds, and double Op
  once more tournaments are loaded.

## Phase 8 — Stats Rank improvements (in progress, by stages)

The user wants to improve Stats Rank in gradual stages (oct 2026). Review of the table found:
Atk Loss by Time was a raw count, no legend, best/worst-only colors, column-group chips not in the
URL, no map / side filters, a dead header branch for `'Bonus Conversion (PAB)'` (the column is now
`'Bonus Conversion (W-W-W)'`), and nothing from `round_events` / `round_summary` yet.

- **8.1 Legend + Save Rate** (done, oct 2026): Legend tooltip with every column. Atk Loss by Time
  replaced by **Save Rate** = saves / lost rounds, where a save is a lost round ended by time,
  spike or defuse (`round_info.winCon` `tim` / `boom` / `defus`) with the loser still having
  someone alive (fewer than 5 distinct victims of that team in `round_events`; distinct because a
  revived player can die twice). Denominator only counts maps with kill rows, so tournaments
  without `round_events` show —. Neutral color (`neutral` on `MetricDef`). `timeoutLosses` stays
  in `TeamRankStats` because Compare Stats still uses it. Cache key `tournament-rankings-v2`.
  Verified in the built app against an independent count from `round_info` + `round_events` on
  Champions 2026: all 16 teams match (T1 18/132 = 14%, PRX 20/120 = 17%); saves by ending: time
  42, spike 118, defuse 11. Americas Stage 2: no team has data, so —.
- **8.2 Trade Rate** (done, oct 2026): trades / the team's deaths, end of Overall, higher is
  better, Detail info `x/y`. From `round_summary`: `kills_team_x` already leaves team kills out
  and `trades_team_x` counts the team's kills flagged `is_trade` (both match `round_events` on all
  1297 Champions 2026 rounds), and a team's deaths are the rival's kills. — without data. Cache key
  `tournament-rankings-v3`. Verified in the built app against a count straight from `round_events`
  kills: all 16 teams match (T1 171/886 = 19%, PRX 163/839 = 19%), Save Rate unchanged, Americas
  Stage 2 shows —.
- **8.4 True FK Rate** (done, oct 2026): true FK / FK, end of Overall after Trade Rate, higher is
  better, Detail info `x/y`, — without data. True FK = first blood (`is_first_blood`) with
  `is_traded` false. `is_traded` turned out to use exactly a 5 s window: recomputing it from
  `t_sec` (killer killed by the victim's team within N s) matches 100% of the 8908 Champions 2026
  kills at 5 s (95.2% at 3 s, 97.8% at 4 s, 98.2% at 6 s). `t_sec` is whole seconds, so "within
  5 s" can be up to almost 6 real seconds. Built on the `round_events` kill rows Save Rate already
  fetches. Cache key `tournament-rankings-v4`. Verified in the built app against that manual 5 s
  count: all 16 teams match, 1006 / 1292 in total (T1 97/121 = 80%, PRX 91/126 = 72%); Save Rate
  and Trade Rate unchanged; Americas Stage 2 shows —.
- **8.5 True FD Rate + Save Rate last** (done, oct 2026): true FD / FD right after True FK Rate,
  lower is better, Detail info `x/y`, — without data; Save Rate moved to the end of Overall (legend
  follows the same order). FD = first blood whose `victim_team` is the team; true FD = that first
  blood with `is_traded` false, i.e. the team didn't kill the killer within 5 s of the first death
  (same flag as True FK, seen from the other side, so league totals match: 1006 / 1292).
  Not used: "the kill on the first-blood killer has `is_trade` true". `is_trade` marks a kill on
  someone who killed *any* teammate in the previous 5 s (100% match at 5 s, 1851 kills; `is_traded`
  has 2127 because one trade can avenge several deaths), so when the first-blood killer kills again
  later and dies right after, that kill counts as a trade of the first death even 6 to 20+ s later
  (122 such rounds; e.g. 100T-FUT Lotus r21: s0pp > Cryocells at 6 s, s0pp > bang at 26 s,
  Timotino > s0pp at 29 s). That method would give 884 true FD instead of 1006. Cache key
  `tournament-rankings-v5`. Verified in the built app against a manual 5 s window from the first
  death: all 16 teams match (T1 101/132 = 77%, PRX 96/115 = 83%); True FK, Trade and Save Rate
  unchanged; Americas Stage 2 shows —.
- **8.3 Plants by site / plant time** (parked, oct 2026 — the user doesn't want it yet): plant
  counts were cross-checked on Champions 2026 and match exactly in all three sources, per team:
  `player_performance.PL` (what Plant Rate ATK / Post Plant WR / Retake Eff use today),
  `round_events` `type = plant` (`team` = planter's team) and `round_summary.plant_t` not null on
  the attacking team — 887 plants, diff 0 on all 16 teams (e.g. T1 98/136 ATK rounds = 72.1%,
  NRG 57/70 = 81.4%). Defuses match too (246 in all three and in `round_info.winCon = 'defus'`).
  So moving the current plant columns to the new tables changes nothing; the reason to use them
  is the extra data: `round_summary.plant_site` / `round_events.site` (A / B / C) and `plant_t`
  (second of the round), e.g. plant rate per site or average plant time. Caveat: the new tables
  only cover Champions 2026, `player_performance` covers every tournament.
- **Still open, to decide with the user**: gradient colors, column-group chips in the URL,
  map / side filters, removing the dead `'Bonus Conversion (PAB)'` branch, more metrics from
  `round_events` / `round_summary` (first blood, plant site / time — see 8.3).

---

## General closing criteria per item

A feature is considered done when: it compiles (`npx tsc --noEmit` + `next build`), the section
renders with real data for the default tournament, and the numbers shown were verified against
at least one hand-counted case.
