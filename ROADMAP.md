# Roadmap — rviewer (VCT Data)

Planning of improvements and features. Context: **personal** analysis/casting tool,
used on desktop. Data depth is the priority; mobile and public polish come last.

Last updated: 2026-11-08

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

- **3.1 Color gradient in Stats Rank**: merged into Phase 8 (gradient colors, see Still open).
- **3.2 Inline mini-bars in table cells**: dropped (nov 2026) — the user found it not clean.
- **3.3 Salvage the flow Sankey** (`GraphsSection`): dropped (nov 2026).
- **3.4 / 3.5**: moved to the Backlog at the end.
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

- **5.1 Default tournaments from the DB**: moved to Phase 11 (11.2), together with the other
  DB-driven defaults.

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
- **8.6 True FK / FD Into Win + FK-FD chip** (done, oct 2026): True FK Into Win = rounds with a
  true FK the team won / true FK; True FD Into Win = rounds with a true FD the team still won /
  true FD. Higher is better for both, Detail info W-L. Winner from `round_info.rndA`, joined to
  the first blood by `map_id` + `round`; one first blood per round, so counting kills = counting
  rounds. New FK-FD column group (chip in Table info) with True FK Rate, True FK Into Win, True FD
  Rate, True FD Into Win; the two rates left Overall. Same four rows in Compare Stats (FK-FD block
  between Overall and First 3, rates shown as `x/y`). Cache key `tournament-rankings-v6`.
  Verified in the built app against an independent count (first kill by `t_sec` / `ev_index`,
  trade by a manual 5 s window, winner from `round_info`): all 16 teams match (T1 69/97 = 71% and
  23/101 = 23%, PRX 72/91 = 79% and 23/96 = 24%); 824 / 1088 true FK into win league-wide,
  264 / 1088 true FD into win.
- **8.7 Save Rate in Compare Stats** (done, oct 2026): Atk Loss by Time row replaced by Save
  Rate (same `saves / savesLost` as Stats Rank), last row of Overall, `x/y` detail, neutral color
  (`neutral` on the Compare `RowData`), rank still shown. `timeoutLosses` and the Compare
  `countOnly` path had no other users, so both were removed. Verified in the built app: T1 18/132
  = 14%, PRX 20/120 = 17% (same as 8.1).
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
- **Colors** ✅ (2026-11-13): the user is happy with the current Stats Rank colors; the gradient
  (ex 3.1) is closed.
- **Dead `'Bonus Conversion (PAB)'` header branch** removed (2026-11-13); the column is
  `'Bonus Conversion (W-W-W)'`, so the header renders the same.
- **Still open, to decide with the user**: column-group chips in the URL, map / side filters,
  more metrics from `round_events` / `round_summary` (first blood, plant site / time — see 8.3).

---

## Phase 9 — Weapon Pick (in progress, by stages)

New Testing section (`components/sections/WeaponPickSection.tsx`, `getWeaponPickStats` in
`lib/data/economy.ts`) on how each team buys as a whole, from `round_buy` (only Champions 2026 as
of oct 2026). No per-player view: the user wants the team's buy together.

- **9.1 Filters + team loadouts** (done, oct 2026): same filters as Operator Use (region, quick,
  tournament, team chips, map chips, ATK / DEF side, Reset). A loadout is what the 5 players hold
  at the start of the round (`_weapon` + `_shield`; bought, kept or dropped — `round_buy` can't
  tell them apart), weapons by category (Rifle, Op, Outlaw, Marshal, Heavy, SMG, Shotgun, Pistol)
  plus armor, e.g. `4 Rifle + Op · 4 Heavy + Light`. Per team: top 5 by rounds with % of the
  team's rounds and WR (`team_economy.win_A`), "Show all". Every round counts, pistols included.
  Cache key `weapon-pick-stats-v1`. Verified in the built app against a hand count of G2 on
  754741-Lotus: 24 rounds, 20 distinct loadouts, 13 wins, top 5 Rifle · 5 Heavy 3 rounds 1 win.
- **9.1b Finer categories** (done, oct 2026): Rifle = Vandal / Phantom; Bulldog, Guardian,
  Sheriff, Bandit and Classic are their own categories; Pistol = Shorty / Frenzy / Ghost. Legend
  lists every group. Cache key `weapon-pick-stats-v2`. Verified in the built app on G2
  754741-Lotus: 21 distinct loadouts (round 2 = 2 Bulldog + Guardian + Marshal + SMG, round 21 =
  3 Rifle + 2 Bandit), matching a hand count.
- **9.1c Odin / Ares** (done, oct 2026): the Heavy weapon group is split into Odin and Ares (Ares
  is rare: 3 player-rounds in Champions 2026), so "Heavy" only means armor. Legend explains the
  armor part. Cache key `weapon-pick-stats-v3`.
- **9.1d Armor chips** (done, oct 2026): single-select chips under Maps, same size as the map
  chips (the 50×40 box shows a text placeholder until the armor icons are added): All, Heavy
  (armor part `5 Heavy`), Light (`5 Light`), Mixed (anything else, e.g. `5 Regen`), None (`5 None`).
  Client-side only, from the loadout key; % is over the rounds that pass the filter. Expected on
  G2 754741-Lotus (hand count): Heavy 4 rounds (r6, 12, 17, 20), None 2 (r13, 14), Mixed 18.
  Not clicked in a browser yet (Chrome extension unavailable).
- **9.1e Armor icons** (done, oct 2026): `public/weapons/{heavy,light,regen}.png` (white on
  transparent) in the Armor chip boxes: Heavy and Light their own icon, Mixed the three small side
  by side, All and None keep text. Checked in the built app: the HTML points to the files and all
  three serve 200.
- **9.2 Cost + bank** (done, oct 2026): cost = the team's loadout value
  (`team_economy.team_x_economy`, kept items included — chosen over summed `_spend`, which only
  counts what was paid that round, abilities and drops included); bank = `team_economy.team_x_bank`
  (team total; matches summed `_bank` within a few dozen). Cost chips use the `classifyEconomy`
  bins, Bank chips <2k / 2–6k / 6–10k / 10k+ (Champions 2026 team rounds: 795 / 595 / 639 / 987).
  Both single-select, same chip format as Armor (shared `chipGroup`); rounds without a
  `team_economy` row only show with both on All. Rows gain average Cost and Bank. Server keys are
  `${loadout}|${cost}|${bank}`. Cache key `weapon-pick-stats-v4`. Verified in the built app on G2
  754741-Lotus against `team_economy` by hand: 5 Rifle · 5 Heavy 23.8k / 12.6k (r6, 12, 17),
  round 2 loadout 16.7k / 2.4k; cost bins by hand Eco 3, Semi-eco 3, Semi-buy 5, Full buy 13
  (chip clicks not tested in a browser).
- **9.3 Round chips** (done, oct 2026): single-select All / R1 + R13 / R3 + R15, same chip format.
  Server keys gain a round group (`r1`, `r3`, `other`): `${loadout}|${cost}|${bank}|${round}`.
  Cache key `weapon-pick-stats-v5`. Verified in the built app payload for G2 on Lotus (3 maps)
  against a direct `round_buy` + `team_economy` count: r1 6 rounds 4 wins, r3 6 rounds 3 wins,
  other 53 rounds 28 wins (chip clicks not tested in a browser).
- **9.4 Merge armors** (done, oct 2026): toggle next to Both / ATK / DEF, client-side only. Per
  player, Heavy / Regen / Light become "Armor" and None stays, so the armor part is e.g.
  `4 Armor + None`. The Armor chips still filter on the original armor. Checked on the built
  app's payload for G2 on Lotus: 49 → 32 loadouts, 65 rounds both ways, top `5 Rifle · 5 Armor`
  18 rounds (toggle not clicked in a browser).
- **9.5 Enemy loadout** (done, oct 2026): last column, the rival's average loadout value
  (`team_economy` economy of the other team) over the rounds of that loadout; new fields
  `enemyValued` / `enemyCostSum`. Cache key `weapon-pick-stats-v6`. Verified in the built app's
  payload for G2 on Lotus against `team_economy` directly: 65 rounds avg 18667, R1 + R13 6 rounds
  avg 3775.
- **Open**: with armor in the key, loadouts fragment a lot (20 in 24 rounds for G2 on one map);
  decide with the user whether to group armor coarser or drop it from the key.

## Phase 10 — Time & Site (in progress)

First version shipped oct 2026 under Testing (`components/sections/TimeSiteSection.tsx`,
`getTimeSiteStats` in `lib/data/timeSite.ts`), reading `round_summary` only (`plant_t`,
`plant_site`, `fb_t`, `fb_team`). Same filters as Operator Use (teams, map chips, Both / ATK / DEF,
Detail info), one row per team, no player expansion. Every round counts, pistols included.
The server sends the raw per-round entries (team → map → side) because medians can't be summed
per map; the client aggregates over the visible maps. Cache key `time-site-stats-v1`.

- **Plant columns**: plant rate, avg / median plant time, Fast < 30 s / Mid 30–60 s / Slow > 60 s
  (share of plants). The plant is always the attacker's: ATK and Both = the team's own plants,
  DEF = the rival's plants against the team (mixing both in Both would mean nothing).
- **Sites**: share of plants per site, only with a single map on (A on one map is not A on
  another); the columns are the sites any shown team planted on that map.
- **First blood**: avg / median time of the round's first kill, avg time split by FK (team made
  it) / FD (team took it), and FB → plant (plant − first kill, rounds with a plant where the first
  kill came first). These follow the side buttons over every round of that side.

Verified in the dev server's rendered table against an independent count from `round_summary`
on Champions 2026 (Both, all maps): T1 plant 120/167, avg 59.9 s, median 64 s, 17 / 41 / 62
fast / mid / slow, FB 28.4 / 22 s, FK 28.3 s, FD 28.6 s, FB → plant 32.9 s; PRX 92/127, 49.6 /
46 s, 14 / 47 / 31, FB 22.5 / 18 s, FK 23.9 s, FD 20.9 s, FB → plant 29.4 s. Lotus only: T1 39/48,
sites A 11 / B 13 / C 15. Still open:

- **10.1 Check ATK / DEF in the browser** ✅ (2026-11-13): checked by the user, works.
- **10.2 Only Champions 2026 in `round_summary`**: other tournaments show up once loaded.

## Phase 11 — Qualifier data and DB-driven defaults

From 2027 vlr-scraper also loads qualifiers, which come **without draft** (no picks, bans or
decider). Details from the scraper side: `handoff/RKTDATA_MATCH_FORMAT.md` (local, gitignored).
A single qualifier brings ~255 tier 2-3 teams, so presenting the data needs a big restructure:
the default view has to keep showing the league teams, with the rest behind a filter.

- **11.1 `match_format` column**: `match_id` (`full` / `reduced`) and `tournament` (`full` /
  `reduced` / `mixed`), default `full`; the format is decided per event, not per match. Done
  (nov 2026) as a minimal guard until 11.3 / 11.4 exist:
  - `reduced` tournaments are left out of the filters (`getTeams`, `getTours`, `getAllTours`)
    and of `getTeamRegions`, via `getReducedTourIds` (`lib/data/helpers.ts`). `mixed` stays.
  - `getTeamLogos` drops `team_path`s whose file is missing in `public/` (most qualifier teams
    have no logo); `public/teams/**` is in `outputFileTracingIncludes` for the deploy.
  - Stats need no change today: every section takes its `series_id`s from `draft`, so series
    without draft are already out.
  - Nov 2026: the NA open qualifier came `reduced` but with draft in 72 of its 246 series, so the
    draft queries without a tournament filter (a team's series, "last match") mixed them in, and
    with MIBR they were another team's (11.5). Every draft query that picks series now has
    `.not('tour_id', 'in', getReducedTourList())` (28 sites; left out: `getAllSeriesIds`, which
    only reads `bo`, and the date / event lookups by already-picked series). Verified: draft
    739 → 667 rows (the league ones); MIBR's last match 2026-11-08 (qualifier) → 2026-08-30.
    Asked vlr-scraper what the rule is (`handoff/VLR_SCRAPER_TEAM_ID_Y_DATOS.md`).
- **11.0 Data audit after each upload**: `node scripts/data-audit.mjs` (read-only, anon key, ~20 s).
  Per tournament: series / drafts / maps / rounds / economy / buy / stats / perf against
  `round_info` (2026-11-13: it died with `round_buy: timeout` on a cold database, as the first
  count on each big table takes ~3 s and the 8 per-tournament counts ran in parallel; the big
  tables are now warmed one at a time first); tournament metadata (year / stage / subregion); cache version; tricodes shared
  by different teams (no players in common between a league and a qualifier team); rows without
  `player_id_vlr`; agent images. Lines with ⚠ are what to check or report to vlr-scraper.
- **11.2 Default tournaments from the DB** (ex 5.1): evaluate a boolean `default` column in
  `tournament` to replace the hardcoded `DEFAULT_TOURS` (`lib/types.ts`), changed from the
  Supabase dashboard instead of a code edit + deploy. Same pattern as the DB-driven hidden maps
  (`defaultHiddenMaps`). To evaluate: whether the CSV upload (`scripts/upload.mjs`,
  `table_tournament.csv`) overwrites the column, the cache TTL, and collapsing the section list
  duplicated in `app/page.tsx`, `components/Filters.tsx` and `components/Sidebar.tsx`. A
  DB-driven default would also decide which quick tournament chips start active (6.2).
- **11.3 Relevant teams**: manual boolean `relevant` in `teams`, edited in Supabase. Only
  relevant teams are shown by default (team selects, rankings, Stats Rank and other table
  sections); an "All teams" filter, off by default, shows the rest. Before building it, check
  that the vlr-scraper upsert (`table_teams.csv`) doesn't overwrite the column (same trap as
  `team_path`, see `SCRAPER_TEAM_PATH.md`).
- **11.4 Full / reduced toggle**: a global filter, "Full" (with draft) by default, to include
  series without draft. Draft sections (picks/bans, vetoes, map pick %, Veto Predictor) always
  use `full` only, or reduced series would lower the percentages. The rest has to take its
  series from `match_id` filtered by `match_format` instead of `draft`: that's the big
  restructure, every `from('draft').select('series_id')` in `lib/data/*`, plus `bo` (today read
  from `draft`) and `getLastUpdateDate` (cache version keyed on the latest `draft` date, so a
  qualifier-only upload doesn't bust the cache). With this, 11.1's filter guard goes away.
- **11.5 Risks to keep in mind**: `team_id` is vlr's tricode and can collide between a small team
  and a league team (they merge in `teams`, region color included). Seen nov 2026: `100T`, `MIBR`,
  `FUR`, `NOVA` and `TS` are each a league team plus a different qualifier team, and `FAKE` is two
  qualifier teams that played each other (785082). Asked vlr-scraper for a vlr team id, like
  `player_id_vlr` (`handoff/VLR_SCRAPER_TEAM_ID_Y_DATOS.md`); until then a 2027 view shows those
  qualifier teams as the league one. `player_id` follows the team
  of the latest match, so a league player in a qualifier can move id; forfeited series are not
  loaded (qualifier brackets will have gaps); a re-marked event only updates old `match_id` rows
  after a `--full` upload.
- **11.6 Overtime economy in qualifiers (to evaluate)**: vlr no longer stores rounds after 24 in
  the economy tab for qualifiers. In the Europe Qualifier, 22 maps (96 rounds) have
  `team_economy` cut at 24, e.g. 784601 Corrode 34 → 24 and Lotus 38 → 24. League maps are complete,
  so Champions 2026 has 1810 / 1810. The logs data does have OT: `round_buy` (weapon, shield,
  spend and bank per player), `round_events` and `round_summary` have every round, so there's no
  need to scrape the 2D replay. Viability, checked on Champions 2026 (3620 team-rounds where both
  tables exist):
  - **Bank**: Σ player `_bank` from `round_buy` matches `team_x_bank`. 1776 / 3620 are exact and
    all 3620 are within 200 (median −50, rounding). Reconstructable.
  - **Loadout value**: Σ (weapon + shield price) is short by the abilities, median 3350 and range
    1850–4600 (p10–p90), so it can't be rebuilt exactly. As a category (eco / semiEco /
    semiBuy / fullBuy, bins in `lib/data/economy.ts:74`), weapon + shield + 3350 gets 86.2 %
    right overall and **40 / 40 in OT rounds**, which are always full buys. Most of the misses
    are eco → semiEco.
  - `win_A`, `side` and `winCon` come from `round_info`, which is complete.
  - Most likely plan: economy stats use the first 24 rounds for everyone, league included, so
    qualifiers and league count the same way. The reconstructed OT rows get stored apart, either
    in a separate table or flagged as estimated. To decide first: where the reconstruction lives
    (vlr-scraper or rviewer), whether league OT also gets dropped from the stats (it changes
    today's figures), and which sections read `team_economy`: Economy, Operator Use and Weapon Pick.

## Phase 12 — New main filter, Stats Rank v2 first (in progress, nov 2026)

A main filter meant to replace the per-page one on almost every page, tried first on a new
`stats-rank-v2` section (the old Stats Rank stays untouched). Decided with the user (nov 2026):

- **Hierarchy** Year → Region → Subregion → Tournament as chips in cascade
  (`components/TournamentTreeFilter.tsx`). The only selection is the tournament list (`tour`);
  upper chips are bulk toggles painted on / partial / off, and each row only shows what hangs
  from an active chip above. Subregions have no row: they live in a menu opened from the
  `▾ a/b` of each region chip (nov 2026, click on the name still toggles the whole region).
  All open qualifiers of a year share a single Tournament chip, "Open", with the same `▾ a/b` menu
  as the region chips listing its regions (logo + name), and the four region logos on the chip
  toned by selection like the Quick Tournament chips; the chip and each entry toggle every
  open of the year / of that region, like a region chip (`GROUPED_STAGES`, nov 2026). The menu
  goes "Kickoff Open 1" (later "Cup 1 Open 2"…) → regions → each open, every level a checkbox plus
  an `a/b ▶` side panel (on hover or click), to pick a single open (e.g. only NA). The first level
  is the circuit stage the qualifier feeds, parsed from the event (`qualifierTarget`: "vct 2027
  america kickoff - … open qualifier" → Kickoff), numbered in circuit order (Kickoff, Cup 1,
  Cup 2…), no column needed. Every open loaded so far is Kickoff Open 1. Subregions carry a flag
  in both menus (`public/flags/`, `SUBREGION_FLAGS` by subregion name without case or spaces). The region chips' subregion menu stays as is: the stage is picked
  from the Tournament row, the place from the Region row. Goal: Open /
  Closed / Kickoff; Closed joins the list when closed qualifiers arrive.
  Plus From / To, Bo3 / Bo5 and Relevant / All teams. No quick
  tournament chips, no region chips, no Last X, no team chip panel.
- **Default**: every tournament of the latest season (2026 starts off).
- **Metadata**: `tournament.year / subregion / stage`, filled by hand in Supabase
  (`handoff/STATS_RANK_V2.sql`, local). Subregion only for qualifiers. A row without `year`
  falls back to the season in its `tour_id`.
- **Series from `round_info`**, not `draft` (`getAllSeriesIds`, `allSeries: true` in
  `getTournamentRankings` / `getTournamentEconomy`), so qualifiers without draft count — the first
  step of 11.4, scoped to this page. bo = `draft.bo` or, without draft, 4+ maps = Bo5.
- **Teams**: `teams.relevant` (11.3), seeded with the 2026 league teams plus the top 8 of each
  2027 open qualifier; All shows every team.

Verified (nov 2026): `tsc` + `next build` clean; NA open qualifier map WR matches a hand count
(MC / MU / WC 10/10). Tricode collision seen live (11.5): Counterfeit and Faker Rex are both `FAKE`
and played each other, so `FAKE` shows 16/19 maps. Old Stats Rank unchanged (T1 25/43 = 58%).
Still open:

- **12.1 Check the cascade in the browser** ✅ (2026-11-13): the user checked the new-filter pages
  in the browser, Türkiye in the Open menu included. The "Not checked in a browser" notes below
  predate that check.
- **12.2 Roll the filter out** to the other pages. Done so far:
  - **Map Info** (`map-picks`, nov 2026): `usesTreeFilter` in `app/page.tsx` (tree, latest-season
    default, Relevant / All) and `getMapInfo` (`lib/data/draft.ts`): series from `getAllSeriesIds`,
    rounds and drafts by series in chunks. Atk / Def WR, rounds and the new "Maps played" use every
    series; picks / bans / deciders only the series with a draft (the NA open's 72 count, no
    reduced guard here), and an "Incomplete data" notice says how many those are. With none, the
    chart and those columns are hidden. Relevant = series where a relevant team played. The old
    exclude-teams filter (`excA`) is gone from this page. Verified: 2026 Stage 2s + Champions on
    All match the old draft-based figures map by map (280 series); 2027 All = 840 series, 72 with
    draft; Lotus 421 maps (2027), 117 maps / 2228 rounds (Europe) by hand count.
  - **Stats Rank** (nov 2026): v2 replaced the old page and took its id (`stats-rank`; the
    `stats-rank-v2` entry and URL are gone). `StatsRankSection` always gets the teams from the
    filter (`fixedTeams`) and `getTournamentEconomy` only takes series from `getAllSeriesIds`
    (its draft branch only served the old page). `getTournamentRankings` keeps its draft branch
    for Compare Stats / Graphs.
  - **Maps Rank** (`maps-masters`, nov 2026): on the new filter (`getMapsMastersStats` v2:
    `getAllSeriesIds`, rounds and drafts by series in chunks; teams from the filter, team chips
    like Stats Rank). Wins / played use every series; bans only the series with a draft (no
    reduced guard, like Map Info), with a "Bans: incomplete data" line saying how many those are;
    with none, bans are hidden in Detail info. Region chips, Quick Tournament and Last X are gone
    from this page. Verified on All against a hand count from `round_info` / `draft`, every
    team-map cell: Champions 2026 (34 series, all with draft; 100T Ascent 3W-2L, 1 ban), NA open
    (246 series, 72 with draft), Brazil open (163 series, no draft).
  - **Agent Picks** (`agent-picks`, nov 2026): on the new filter. `getAgentPickStats` and
    `getOverallCompositions` take `allSeries` + `teams` (series from `getAllSeriesIds`, rows by
    series in chunks; their draft-based branch stays for Meta Shift / Maps); the non-mirror
    instances (`getNonMirrorInstances` v4) are always on the new filter, with the series date
    taken from its first map in `round_info`. Relevant = series where a relevant team played, and
    both teams of those series count. The map header reads `getMapInfo`: Atk / Def WR from every
    series, Picks / Bans / Deciders only from the ones with a draft, with the "incomplete data"
    line (hidden with none). `getOverallMapFullStats` and the exclude-teams filter (`excA`) are
    gone from this page. Verified: Champions 2026 and Americas + EMEA Stage 2 Bo3 give the same
    stats / compositions / instances / map header as before the change; Brazil open (163 series)
    and NA open (246) match a hand count from `player_stats` / `round_info` on every agent-map
    cell (played, maps, non-mirror played / wins). Size: 2027 All is a 5.8 MB page; every
    tournament on All is 10 MB and ~4.5 s on reload (the instance list goes over the 2 MB
    `unstable_cache` limit, so it is not cached).
  - **Post Pistol Force** (`post-pistol-force`, nov 2026): on the new filter (`getPostPistolForce`
    v5: `getAllSeriesIds`, `team_economy` by series in chunks; teams from the filter, team chips
    like Stats Rank; Last X and the region / Quick Tournament chips are gone from this page).
    Found while verifying: the three 2026 Kickoffs and Masters Santiago have every `team_economy`
    round twice, and the second copy is not identical: `team_a` / `team_b`, economies, side and
    `win_A` are swapped but the banks are not, so it pairs each team with the other's bank. The
    page kept whichever copy came last, so the force rule (`bank < 1000`) was wrong on those four
    tournaments and changed with the row order. Now only the row in `round_info`'s team order
    (`team_a = teamA`, one extra round 1 query) is used. Checked on its own: the pistol loser
    has >= 9500 credits (spend + bank) the next round in 589 / 589 rows kept and 46 / 589 rows
    dropped. Verified against a hand count by team name, every team-half cell: those four
    tournaments (39 teams), the three Stage 2s (48), NA open (244); Champions 2026 gives the same
    as before the change. Weapon Pick reads the same banks (`getWeaponPickStats`) and still
    takes either copy.
  - **Neon + Phoenix** (`neon-dependency`, nov 2026): on the new filter (`getNeonDependencyStats`
    v3: `getAllSeriesIds`, queries by series in chunks; teams from the filter) and hidden from the
    sidebar (commented out in `components/Sidebar.tsx`; re-add `Zap` to its icon import).
    Reachable at `?section=neon-dependency`. Verified on Champions 2026 / All: overall 16 / 172
    team-maps = 9%, 100T 3 / 18 = 17%, both by hand count.
  - **Meta Shift** (`meta-shift`, nov 2026): two cascades, one per side (`MetaShiftFilters` over
    `TournamentTreeFilter`, which gained `suffix` / `title` / `children`): side A writes
    `tour` / `dateFrom` / `dateTo`, side B `tour2` / `dateFrom2` / `dateTo2`; Team and Exclude Teams
    stay per side (lists = the teams of that side's tournaments, relevant or all); Serie and
    Relevant / All are shared: both sides show them and write the same `bo` / `allTeams`. Region A / B are gone: each side's label, logos
    and Region color come from the regions of its tournaments (every region = "All regions").
    Both sides start on the latest season. Data: `getAgentPickStats` v3 with `allSeries` plus
    `team` (only that tricode's comps, from the series it played; Relevant doesn't apply) or
    `excludeTeams` (their comps leave the picks and the comps count; the old path left them in
    the denominator). The old Meta Shift block of `Filters` is removed. v3 also reads
    `player_stats` of the selected tournaments only: 80 rows with an empty `tour_id` for 8 maps
    never played (4 in the Brazil open, 3 Türkiye, 1 NA open) were picked up by series and moved
    Brazil open rates by 1 point (this also fixes Agent Picks' table; `getOverallCompositions`,
    the non-mirror instances and the other by-series readers of `player_stats` still take them).
    Verified against a hand count from `player_stats` by `team_id_vlr`, 0 diffs: Champions 2026
    (172 comps) vs Americas Stage 2 (300); G2 in Champions (17) vs Champions minus G2 and NRG
    (143); NA open All (1098) vs Brazil open All (728); 2027 Relevant (798) vs NA open Relevant
    minus MIBR (218). Not checked in a browser.
  - **Team → Maps** (`maps`, nov 2026): first team page on the new filter, and the first one by
    **vlr team id**. The cascade plus `TeamTreeControls` (Team select and Last X, rendered inside
    `TournamentTreeFilter`). URL: `teamId` (vlr id) next to `team` (tricode, kept for the team
    pages still on the old filter). `getTeamOptions` lists the teams that played the selected
    tournaments (Relevant / All only filters this list), labeled by tricode plus the name when two
    options share it ("FAKE · counterfeit" / "FAKE · Faker Rex"), and resolves the team: `teamId`
    when it still goes with `team`, else the team with that tricode in the selection, a relevant
    one first. Starts on the latest season, so a league team shows "No data for the selected
    filters" until 2026 is turned on. Data: `getTeamMaps` (`lib/data/draft.ts`): series from
    `round_info` by id (`getAllSeriesIds` with `teams: [id]`), Last X = its newest N series by
    first-map date, rounds oriented by `team_a_id_vlr` / `team_b_id_vlr` (rows with null ids are
    dropped), compositions from `player_stats.team_id_vlr`; `draft` has no id, so inside a series
    the team is the side with its tricode. It reuses `procesarTodo` (the team's side renamed to a
    fixed key; `drafts[0]?.date` guard for series without draft). Picks / Bans / Decider only
    count series with draft, with a "X of Y series with draft data" line. "Last team match date"
    is now the team's latest match in the selected tournaments (a table-wide lookup by id took
    3.1 s against the ~3 s anon limit). Verified: same output as the old `getMapStats` (Compare
    Maps side A, by tricode) for G2 and NRG in Champions 2026, G2 Last 3, PRX from 2026-06-01 and
    TS over the 2026 league tournaments (720 cells, 0 diffs; compositions equal, Compare splits
    them by players); by hand count from `round_info` / `player_stats` by id: `team=MIBR` in the
    NA open resolves to Made in Brampton (16255: 2 series, 1 with draft, 0 diffs), Faker Rex
    (21068, `FAKE`) 4 series, 0 diffs. Not checked in a browser.
  - **Compare Maps** (`compare-maps`, the landing page; nov 2026): two cascades, one per team
    (`CompareFilters`: Team Left writes `tour` / `dateFrom` / `dateTo` / `team` / `teamId`, Team
    Right the same with the 2 suffix); Serie, Last X and Relevant / All are shared and shown on
    both sides. Teams by vlr id like Team → Maps (`TeamTreeControls` with `suffix`,
    `getTeamOptions` per side). Both sides start on the latest season instead of Champions 2026.
    Data: `getTeamCompare` (`lib/data/draft.ts`), which shares `loadTeamSeries` with `getTeamMaps`
    and returns the map table, the draft order and the compositions per map and roster (rounds by
    side, W-L, last played link and date = first map of that series in `round_info`).
    `getTeamMapCompositions` is removed. A "X of Y series with draft data" line per team when
    some series have no draft. Verified against the old `getMapStats` (Charts section, by
    tricode), 795 cells, 0 diffs: G2 vs NRG in Champions 2026, PRX over the 2026 tournaments Bo3,
    G2 from 2026-06-01, G2 vs NRG Last 3. PRX up to 2026-06-30 differs by one series, 626544 (NS
    vs PRX, Masters Santiago), which has no `draft` row: the old page missed it. Compositions by
    hand count from `round_info` / `player_stats` by id, equal: G2 (7) and NRG (6) in Champions,
    Made in Brampton (3) and Faker Rex (7) in the NA open. Not checked in a browser.
  - **Compare Stats / Compare Economy** (nov 2026): same `CompareFilters` and teams by vlr id as
    Compare Maps, so the three Compare pages share the URL. `getTeamSeriesIds`
    (`lib/data/helpers.ts`) is the one place that picks a team's series (by id, Last X); the
    loader of the team pages uses it.
    - Compare Stats: each team's figures come from its own series: the map / pistol / PAB rows
      from `getTeamDashboard` (`procesarTodo` by id) and the rest from `getTournamentRankings`
      with `teamId` (run over those series; it still goes by tricode, the page reads the team's).
      Ranks (user's choice): each team against the teams (Relevant / All) of its own side's
      selection, the same call as Stats Rank (shared cache), with the team's entry replaced by
      its own figures; Last X only applies to the compared team. Before, both teams were ranked
      and partly read from Team Left's tournaments. `CompareStatsSection` takes `rankingsA` /
      `rankingsB`. Verified: all 20 rows of both teams equal their Stats Rank entry for G2 vs NRG
      (Champions 2026), PRX vs TS (2026 tournaments) and FNC (2026 tournaments) vs EDG (Champions)
      (120 cells, 0 diffs; rank universe 16 and 64, the Stats Rank team counts); map / round /
      atk / def / pistol rows by hand count from `round_info` by id for G2 Last 3, Made in
      Brampton in the NA open and G2 in the Americas Kickoff, 0 diffs. Uncached, PRX vs TS over
      every 2026 tournament took 17 s (two 64-team universes); cached 0.7 s.
    - Compare Economy: `getEconomyCompare` v2 by team id; Serie, dates and Last X now apply
      (before only tournaments). The team's column in `team_economy` comes from `round_info`'s
      orientation, and only rows in that orientation count, so the rounds stored twice in the
      three 2026 Kickoffs and Masters Santiago are no longer counted double. Verified: rounds
      counted = the team's non-pistol rounds in `round_info`: G2 Last 3 157, Made in Brampton 63,
      G2 in the Americas Kickoff 229.
    - `Filters` lost its Compare parts (second team row, `tours2` / `teams2`, per-side defaults);
      `COMPARE_DEFAULT_TOURS` and `sectionUsesDefaultTours` are removed. Not checked in a browser.
  - **Filter layout and hand-edited tables** (2026-11-12): From / To, Last X, Serie and Teams
    moved to the right of Year, in the same row (they wrap under it on a narrow window);
    `TournamentTreeFilter` takes `topControls` (Last X, `LastXSelect`) and its `children` (Team,
    Exclude Teams) keep a row of their own at the bottom. Türkiye showed broken in the Open menu
    after the database was fixed: the tournament tree was still cached with the old row
    (`tã¼rkiye`), since `versioned` only changes with a new `round_info` date. `tournament` and
    `teams` are edited by hand, so their reads (`getTournamentTree`, `getRelevantTeams`, the
    team names of `getTeamOptions`) are now cached 5 minutes instead. `capitalize` no longer
    breaks words at "ü". Not checked in a browser.
  - **Date dropdown** (2026-11-12, `components/DateFilter.tsx`): From / To became one "Date"
    button showing the range ("Any date", "From 12/08/2026", "Until …", "a – b"); it opens a
    panel with the From / To inputs, three presets (Last month, Last 3 months, Last 6 months) and
    "Any date" to clear. A preset writes From = today minus N months and To = today, so the URL
    keeps plain dates (`dateFrom` / `dateTo`, and the 2 suffix on side B) and the data functions
    are untouched; clicking the active preset clears it. Verified on the server HTML only (button
    text for no range, From, To and both); the panel was not opened in a browser.
  - **Year row at select height** (2026-11-12, user's choices): everything in the Year row is
    38 px tall. Year chips grew to that height, and later the Region and Tournament chips too; the
    date button lost its "Date" title; "Last X" (shortened from "Last X matches"), "Serie" and
    "Teams" have the label on the left like Year; BO3 / BO5 and Relevant / All are chips
    of the same size as the years, side by side (stacked 18 px pills were tried first). The row
    reads left to right with no gap: years, Serie, Teams, date, Last X. Not checked in a browser.
  - **Testing cleanup** (2026-11-12): Veto Draft and Economy are hidden from the sidebar
    (commented out in `components/Sidebar.tsx`), still reachable at `?section=veto` and
    `?section=economy`. Both stay on the old filter.
  - **Series Outcomes** (`series-outcomes`, 2026-11-12; first of the "Advance" group, renamed
    from "Testing"): `getSeriesOutcomes` v4 takes the series from `getAllSeriesIds`
    (tournaments, dates, Relevant) and counts **only the ones with a draft** (user's choice: the
    whole table on the same series, since veto order and picks need it); a line says "Only
    series with draft data are counted: X of Y" when some are left out. No Serie chips on this
    page (`hideSerie` in `TournamentTreeFilter`): Bo3 for the series blocks, every format for
    overtime, as before. Team chips from the filter (`fixedTeams` + `useHiddenTeams`). Its
    special cases left `Filters`. Verified against a hand count from `draft` + `round_info` by
    tournament, 0 diffs: Champions 2026 (34 series, 197 cells), Stage 2 ×4 + Champions (280,
    749), NA open All (72 of 246 with draft, 929), 2027 Relevant (29 of 185, 389). Not checked
    in a browser.
  - **Operator Use** (`operator-use`, 2026-11-12): `getOperatorUseStats` v9 on the new filter
    (`getAllSeriesIds`, rows by series in chunks, strict). **Relevant only** (user's choice): the
    page has no Relevant / All chips (`hideTeams`) and ignores `allTeams`; with the per-player
    detail for three weapon sets, All teams on 2027 was estimated at ~40 MB. `keepTags` drops the
    rivals' entries inside the cached function, so the entry fits the 2 MB cache (2027 Relevant:
    8.5 s uncached, 0.5 s after; without it every load recomputed). The kills are read after
    `round_buy` and `team_economy`, in chunks of 40 series: the three at once timed out with
    Americas + EMEA Stage 2. `team_economy` rows are matched in `round_buy`'s orientation (rounds
    stored twice). "Buy data: X of Y series" when a selection has series without `round_buy`
    (China: 214 of 280 on Stage 2 ×4 + Champions). Team chips from the filter.
    **The old page was showing a cut kill count**: for Champions 2026 it had 140 Operator kills
    and 233 first kills against 661 and 1464 by hand (a result cut by a timeout had been cached,
    the old query was not strict). Verified: kill columns against a hand count from `round_buy` +
    `round_events`, 0 diffs (Champions 2026 522 cells, Americas Kickoff 432); everything else
    identical to the old page leaf by leaf (Champions 54 912 values, Americas + EMEA Stage 2 Bo3
    128 197, Americas Kickoff 45 873; the only differences are the kill-derived fields, which
    also move Kept / Saved since those use the deaths). Not checked in a browser.
  - **Weapon Pick** (`weapon-pick`, 2026-11-12): `getWeaponPickStats` v7 on the new filter,
    same shape as Operator Use: **Relevant only** (user's choice, no Relevant / All chips; All
    on 2027 was estimated at ~10 MB and uncacheable), `keepTags` inside the cached function,
    "Buy data: X of Y series" line, team chips from the filter. `team_economy` rows are matched
    in `round_buy`'s orientation (= `round_info`'s: 1716 / 1716 rows in the EMEA Kickoff, 1242 /
    1242 in Masters Santiago), so a bank always belongs to its team. Those two tournaments no
    longer have the duplicated `team_economy` rows (1716 and 1242 rows, one per round): the
    scraper removed them. Verified: identical to the old page leaf by leaf for Champions 2026
    (24 352 values), Americas + EMEA Stage 2 Bo3 (76 408) and Americas Kickoff (21 936); rounds
    and bank bins per team against a hand count for the EMEA Kickoff and Masters Santiago
    (72 cells each, 0 diffs). 2027 Relevant: 1.5 MB page, 0.5 s on reload. Not checked in a
    browser.
  - **Time & Site** (`time-site`, 2026-11-12): `getTimeSiteStats` v2 on the new filter, same
    shape as Operator Use and Weapon Pick: **Relevant only** (user's choice, no Relevant / All
    chips), `keepTags` inside the cached function, "Round data: X of Y series" line, team chips
    from the filter. Verified: identical to the old page leaf by leaf for Champions 2026 (14 480
    values), Americas + EMEA Stage 2 Bo3 (47 112) and Americas Kickoff (13 120); for 12 relevant
    teams of 2027 the rounds on the page equal their rounds in `round_info` by vlr id, except
    one that shows a limit of every page keyed by tricode: **a team that changed tricode
    mid-tournament appears as two teams**. xXxMasterProMegaTeamxXx (23693, Europe qualifier)
    played 6 series as `XXXM` (236 rounds) and the last one as `MPMT` (57), so it has two chips
    and two rows. Fixed only by ids in the data tables (scraper phase 2). 2027 Relevant: 0.7 MB
    page, 0.4 s on reload. Not checked in a browser.
  - **Player Stats** (`player-stats`, 2026-11-12): team page like Team → Maps (team by vlr id,
    `TeamTreeControls` + Last X, starts on the latest season). `getPlayerStats` and
    `getPlayerTimeline` take the team's series from `getTeamSeriesIds` and its rows from
    `player_stats.team_id_vlr`; the table covers the whole selection and only the timeline takes
    Last X (10 series by default), as before. The timeline's rival and date come from
    `round_info` and the series winner from the team's column by id. The average the players
    are compared with (`getTournamentPlayerAvg` v2, now cached) follows Relevant / All (user's
    choice): the players of the relevant teams by id, or every player of the selection.
    Verified against the old page, by player and by series: G2 in Champions 2026 (1215 cells),
    PRX over Stage 2 ×4 + Champions Bo3 Last 3 (655) and NRG from 2026-08-01 (1635), 0 diffs
    except one "most played agent" that was a tie; the average is identical in the three
    (all their teams are relevant). `seriesId` in the timeline is now a string, as its type
    says (it was a number at runtime). Made in Brampton (`team=MIBR` on the NA open) shows its 5
    players, 4 maps, 2 series. Not checked in a browser.
  - **Relevant Info** hidden from the sidebar (2026-11-12, commented out like Veto Draft and
    Economy; still at `?section=relevant-info`, on the old filter).
  - **Add teams to Relevant** (2026-11-12): "+ Add" chip next to Relevant / All on every page of
    the new filter (`AddTeamsSelect`): a searchable list of the non-relevant teams that played
    the selected tournaments (`getAddableTeams`). The choice is per visitor and lives in the URL
    (`addTeams`, vlr ids; user approved), not in Supabase: `teams.relevant` stays the owner's
    list. `app/page.tsx` adds those ids to `v2Teams` and to `getRelevantTags` / `getTeamOptions`,
    so every data function takes them as relevant with no change. Hidden on All; shown on the
    Relevant-only pages too; one shared param on the two-sided filters; Meta Shift's Reset
    clears it. Verified on the Europe qualifier: without the param Stats Rank and Time & Site
    are identical to before; with `addTeams=24057` (KRY) it gets its chip, its Stats Rank
    figures equal the ones on All, its 29 rounds on Time & Site equal `round_info`, and the
    other teams don't change; the 14 pages answer 200 with the chip. Known limit: on Operator
    Use / Weapon Pick / Time & Site every added team adds heavy reads. Not checked in a browser.
  - **Default logo** (2026-11-12): a team of `teams` without its file in `public/` gets
    `/teams/default.png` (`getTeamLogos` v2).
  - **Team chips** (Stats Rank, Neon + Phoenix; nov 2026): the `TeamChipsPanel` is back, listing
    the filter's teams (relevant / all) that played the selection, all on by default; what is
    stored is the teams turned off (`useHiddenTeams`, URL `hideTeams`), so a newly activated
    region's teams come in selected. Rows group by `getTeamRegions(tour)`: the regional
    tournaments of the selection decide first, then the overall count (which now includes
    qualifiers). No manual region column needed: by tricode alone, 7 MENA teams (ATL, VEIL, ETER,
    XENO, ZERO, THE, INVI) plus 100T / NOVA share a tricode with another region's team; with the
    selection first, MENA alone gives 79 / 79 teams in EMEA. Verified: MENA 79 chips, Americas
    Stage 2 16, + EMEA Stage 2 32, + Champions 28 (Champions-only teams in their own region).
  - **`getAllSeriesIds` strict** (nov 2026): its round 1 scan (~0.3–2.3 s, against the ~3 s anon
    limit) returned no series on a timeout, and the callers cached an empty page ("No data").
    Now it throws (retries first), like `fetchAllBySeries`; cache keys bumped (rankings v11,
    economy v6, map info v2, Neon v4). Under load a page can still fail with a 500 and work on
    reload: an index on `round_info (tour_id, round)` should help (to propose).
- **12.3 Cache** ✅ (nov 2026): `getLastUpdateDate` keys on the latest `round_info` date instead of
  `draft`, so a qualifier-only upload busts the cache (Brazil / MENA on 11-09 didn't: the latest
  draft was 11-08). ~0.3 s, cached 5 min. The "last update" shown on the page follows it.
- **12.4 Big series lists**: with qualifiers, `.in('series_id', …)` over hundreds of series hit the
  anon statement timeout (57014) on `round_events`, and `fetchAllPages` returned the rows read so
  far, which got cached. Stats Rank (v1 and v2) now uses `fetchAllBySeries`: chunks of 100 series,
  3 at a time, pages of 10000 rows (Supabase Max rows raised to 10000), a failed page retried after
  1 s and 2 s, then it throws so nothing cut is cached. Uncached: all 21 tournaments + All teams
  42 s → 26 s, 2026 minus one tournament 22 s → 13 s; ~1 s cached. An index on `round_events`
  wouldn't help much: ~170 ms of each request is latency. Rolling the filter out (12.2) needs the
  same on each page's series-wide queries.
- **12.5 Relevant fetches only relevant series**: on Relevant, `getAllSeriesIds` keeps only series
  where a relevant team played (their stats only depend on their own series; hidden teams aren't used
  for colors). Same table as before on 2027 and 2026; 2027 default 627 → 170 series, 13 s → 4.8 s
  uncached. For a closed qualifier: mark the open teams that made it as `relevant`.
- **12.7 Relevant by vlr team id** (nov 2026, `team_id_vlr` phase 1 of vlr-scraper,
  `handoff/RKTDATA_TEAM_ID_VLR.md`): `getRelevantTeams` returns `teams.team_id_vlr` and
  `getAllSeriesIds` matches it against `round_info.team_a_id_vlr` / `team_b_id_vlr`, so a
  qualifier team sharing a league tricode (Made in Brampton / MIBR, 100Throwers / 100T) no longer
  brings its series into Relevant. The team lists (`fixedTeams`) come from `getRelevantTags(tour)`:
  the tricodes of the relevant ids that played the selected tournaments. Both read the round 1
  scan through `getFirstRounds` (cached), so a page runs it once. Verified on Maps Rank against a
  hand count by id: 2027 (176 series, 37 teams), Champions 2026 (34, 16), Americas Stage 2 + NA
  open (113, 26). Today both rows of each shared tricode are still `relevant`, so MIBR / 100T
  still show in 2027; with only the league row marked the same count gives 169 series, 32 teams
  and none of MIBR / 100T / FUR / NOVA / TS.
  Still by tricode (needs phase 2, asked in `handoff/VLR_SCRAPER_TEAM_ID_FASE_2.md`): the stats
  themselves, so two teams with the same tricode inside one selection (All teams with
  qualifiers) add up in one row; region, logo. Also found: `round_info` had 5 maps of
  `vct_2026_pacific_stage_1` twice (series 644656 and 644659, the copy with null ids), which
  counted double for TS, NS and DRX. Fixed by the scraper (checked 2026-11-13: no `round_info`
  row with a null id left; Pacific Stage 1 has 2289 rounds in `round_info` and `round_buy`).
- **12.6 Relevant teams wiped** ✅ (reloaded, 2026-11-13): the list now follows the circuit stage
  (opens → closed → Kickoff → Cups), about 48–60 teams once complete. 15 relevant on 2026-11-13 is
  expected: two EMEA / Americas opens are still to come and nothing of China / Pacific is loaded.
  History: on 2026-11-11 every row of
  `teams` had `relevant = false` (972 teams, was 96 true / 921), most likely a vlr-scraper upload
  of `teams` during the `team_id_vlr` work (item 5 of `handoff/VLR_SCRAPER_TEAM_ID_Y_DATOS.md`).
  The user is reloading the list by hand, better curated (tooltip: teams qualified to the Closed
  qualifiers, plus the league teams). `handoff/STATS_RANK_V2.sql` is the old snapshot (2026 league +
  top 8 of 4 opens, no Brazil / MENA). Next session:
  - Check with `node scripts/data-audit.mjs` ("N teams, M relevant") that the new list is in and
    that a scraper upload didn't wipe it again.
  - Until then, Stats Rank / Map Info on Relevant (the default) show nothing once the cache of
    `getRelevantTeams` renews; on All they work.
  - With shared tricodes (100T, MIBR, FUR, NOVA, TS, ATL, VEIL, THE…) `relevant` marks both teams
    until `team_id_vlr` lands; once `teams` is keyed by it, the flag has to move to the new rows.

## Phase 13 — Team Profiling (next session)

New page in the Advance group of the sidebar (`team-profiling`): a diamond / radar chart with
every axis from 0 to 1, to compare teams. Relevant teams only (plus the ones the visitor adds
with "+ Add"). Asked by the user on 2026-11-12; nothing built yet.

Starting points (already in the code):
- New main filter and Relevant: `TournamentTreeFilter`, `v2Teams` / `relevantTeamsP` in
  `app/page.tsx`; team chips with `TeamChipsPanel` + `useHiddenTeams` (as in Time & Site).
- Metrics: `getTournamentRankings({ allSeries: true, teams })` already returns
  `TeamRankStats` per team (ATK / DEF WR, pistol, anti-eco, recovery, post-plant, retake,
  trade rate, true FK / FD, save rate). Stats Rank computes the rates from it.
- Chart: `recharts` is installed (it has `RadarChart`).
- It replaces Backlog 3.4 (radar inside Compare Stats, 2 teams, 5 axes).

To decide with the user before coding (page-by-page workflow, with mockups):
- Which axes, and how many (4 for a literal diamond, or 5-8 for a radar).
- What 0 to 1 means: the raw rate (a 55% WR is 0.55), or each metric scaled between the
  worst and best team of the selection (min-max), or the team's percentile.
  Raw rates bunch every team around the middle; scaled ones exaggerate small gaps.
- "Lower is better" metrics (true FD rate): inverted so that outside is always better?
- How many teams at once: 2-3 overlaid on one chart, or one small chart per team in a grid.
- Metrics that need round_events (trade rate, true FK...) only exist for series with that
  data: say how many series each axis is built from, as the other pages do.

Closing: general criteria below; one team's axis values hand-checked against Stats Rank.

## Backlog

- **3.4 Team profile radar** in Compare Stats: a pentagon (pistol WR, ATK WR, DEF WR, retake eff,
  post-plant WR) overlaid for the 2 teams. Data: `TeamRankStats` is already computed.
  → superseded by Phase 13 (Team Profiling).
- **3.5 WR vs economy difference curve**: probability of winning the round given the credit gap,
  from `team_economy`. Complements Compare Economy.

---

## General closing criteria per item

A feature is considered done when: it compiles (`npx tsc --noEmit` + `next build`), the section
renders with real data for the default tournament, and the numbers shown were verified against
at least one hand-counted case.
