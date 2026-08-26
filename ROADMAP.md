# Roadmap — rviewer (VCT Data)

Planning of improvements and features. Context: **personal** analysis/casting tool,
used on desktop. Data depth is the priority; mobile and public polish come last.

Last updated: 2026-07-09

---

## ✅ Done

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

The codebase still has ~207 comment lines in Spanish across ~30 files (heaviest:
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

## Phase 4 — Polish (low priority, personal tool)

- **4.1 Clean up the "Testing" sidebar section**: promote what's already useful (Relevant Info,
  Player Stats) and hide the rest.
- **4.2 Unify the UI language** (currently a mix of English/Spanish).
- **4.3 Move the Playoff % disclaimer out of the h1** into a subtitle.
- **4.4 Own README** (currently the create-next-app default).
- **4.5 Color accessibility**: green/red as the only encoding doesn't work for colorblind users;
  pair it with font weight or a symbol.
- **4.6 Responsive**: only if the tool ever goes public.

---

## General closing criteria per item

A feature is considered done when: it compiles (`npx tsc --noEmit` + `next build`), the section
renders with real data for the default tournament, and the numbers shown were verified against
at least one hand-counted case.
