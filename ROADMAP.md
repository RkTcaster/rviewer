# Roadmap — rviewer (VCT Data)

Planning of improvements and features. Context: **personal** analysis/casting tool,
used on desktop. Data depth is the priority; mobile and public polish come last.

Last updated: 2026-09-11

---

## ✅ Done

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

---

## General closing criteria per item

A feature is considered done when: it compiles (`npx tsc --noEmit` + `next build`), the section
renders with real data for the default tournament, and the numbers shown were verified against
at least one hand-counted case.
