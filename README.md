# rviewer — VCT Data

VALORANT (VCT) match analysis dashboard for casting and prep: team rankings, map win rates,
veto/draft, agent compositions, economy and player stats.

**Personal** tool, built for desktop. Next.js (App Router) + Supabase as a read-only backend;
data ingestion happens separately from CSVs.

- Stack: Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind CSS 4 · Supabase JS · Recharts · TanStack Table · lucide-react
- Feature planning: [ROADMAP.md](ROADMAP.md)
- Style guidelines for LLM-assisted work: [CLAUDE.md](CLAUDE.md)

---

## Setup

Requires Node 20.9+ (Next 16) and a Supabase project with the tables already created (see [Data](#data)).

```bash
npm install
```

Environment variables (`.env.local`, not versioned):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # only for scripts/upload.mjs
```

The app only uses the anon key (read). The service role key is needed by the upload script.

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm start       # serve the build
npm run lint    # eslint
```

---

## Architecture

**A single route.** Everything lives in `app/page.tsx`, an async Server Component. The visible
section and the filters are query params (`?section=stats-rank&reg=reg_0&team=G2...`), so
switching sections or changing a filter is a Next navigation and a server re-render.

**Conditional, parallel fetching.** `page.tsx` builds ~35 promises — each one an empty
`Promise.resolve()` when the current section doesn't need that data — and awaits them in a
single `Promise.all`. No `await` cascade: a section asks only for what it needs, and asks for
all of it at once.

**Data layer.** `lib/data-service.ts` is a barrel; the implementation lives in `lib/data/*`,
split by domain:

| Module | What it exposes |
| --- | --- |
| `filters.ts` | `getRegions`, `getTeams`, `getTours`, `getAllTours` |
| `rankings.ts` | `getTournamentRankings`, `getMapsMastersStats`, `getTeamFormTimeline` |
| `draft.ts` | `getMapStats`, `getOverallMapFullStats`, `getOverallMapPicks`, `getVetoFlows` |
| `agents.ts` | `getAgentPickStats`, `getOverallCompositions`, `getTeamMapCompositions`, `getAgentNonMirrorMatches`, `getNeonDependencyStats` |
| `players.ts` | `getPlayerStats`, `getTournamentPlayerAvg`, `getPlayerTimeline`, `getTopPlayerPerformances` |
| `economy.ts` | `getEconomyDistribution`, `getEconomyCompare`, `getTournamentEconomy` |
| `images.ts` | `getTeamLogos`, `getMapImages`, `getAgentImages`, `getAgentRoles`, `getTeamRegions`, `getOutOfRotationMaps` |
| `misc.ts` | `getLongestMaps`, `getSkirmishStats`, `getSimulationScenarios` |
| `helpers.ts` | `versioned`, `fetchAllPages`, `getLastUpdateDate` |
| `rows.ts` | Row types for the Supabase tables |

Two helpers matter for understanding the rest:

- **`versioned(keyBase, fn)`** wraps a function with `unstable_cache`. The key includes the date
  of the latest match (`getLastUpdateDate`, cached for 5 min), so uploading new data invalidates
  everything on its own. `revalidate: 86400` as a safety net.
- **`fetchAllPages(buildQuery)`** pages through results 1000 rows at a time. Supabase truncates
  silently at 1000; any query that could exceed it **must** go through this (a map win-rate bug
  already came from skipping it).

**Debounced filters.** `components/NavigationContext.tsx` batches filter changes for 1.5s before
navigating, so a burst of clicks (several tournaments, several regions) ends in a single server
request. `useFilterParams()` returns the *effective* params — what the user already picked, even
if the URL hasn't caught up — and `flush()` forces the navigation when a dropdown closes or the
section changes. `ContentOverlay` shows the spinner while the transition is pending.

**Types.** `lib/types.ts` holds the domain types (`MapStat`, `TeamRankStats`, `CompositionStat`,
`VetoFlow`, …) plus two defaults constants: `STATS_RANK_DEFAULT_TOURS` and
`STATS_RANK_DEFAULT_TEAMS`.

---

## Sections

Each sidebar item (`components/Sidebar.tsx`) is a `section` in the URL and a component in
`components/sections/`.

**Overall** — circuit-wide aggregates, no team selected:

| Section | `section` | What it shows |
| --- | --- | --- |
| Stats Rank | `stats-rank` | Team ranking table: map WR, ATK/DEF, pistols, anti-eco, recovery, post-plant, first 3 rounds, and WR by economy bucket (eco / semi-eco / semi-buy / full buy and their matchups). Starts with no tournament: with no tournament nothing is queried. |
| Maps Rank | `maps-masters` | Teams × maps heatmap with per-cell WR and a per-map summary. |
| Map Info | `map-picks` | Picks, bans, deciders and side win rate for each map. |
| Agent Picks | `agent-picks` | Pick rate by agent and map, compositions, and win rate in non-mirror matchups. |
| Meta Shift | `meta-shift` | Two sets of filters (region/team/tournament/dates) side by side, to compare how the agent meta shifted between two slices. |
| Neon Dependency | `neon-dependency` | Neon dependency by team and map. Currently hidden in the sidebar. |

**Team** — require a selected team:

| Section | `section` | What it shows |
| --- | --- | --- |
| Maps | `maps` | The team's maps: picks/bans/deciders, WR, ATK/DEF, compositions used. |
| Compare Maps | `compare-maps` | Two teams side by side per map, with their compositions. This is the default section. |
| Compare Stats | `compare-stats` | Pistols, anti-eco, recovery and post-plant for both teams. |
| Compare Economy | `compare-economy` | WR by own economy bucket and by the opponent's. |
| Veto Draft | `veto` | The team's Ban → Pick → Ban 2 flow and repeated full sequences. |
| Form Timeline | `form` | Rolling WR (3/5/10 window, by rounds or maps) with points colored by result. |

**Testing** — under evaluation, either promoted or dropped:

`skirmish-americas`, `relevant-info` (longest maps, top individual performances), `economy`
(credit histogram) and `player-stats` (per-player stats against the tournament average, plus a
timeline). `playoff-pct` exists (`PlayoffPctSection`, qualification scenarios from `simulations`)
but is commented out in the sidebar.

### Query params

| Param | Use |
| --- | --- |
| `section` | Visible section (default `compare-maps`) |
| `reg`, `reg2` | Regions, comma-separated (`reg_0`…`reg_4`) |
| `team`, `team2` | Team A / B |
| `tour`, `tour2` | Tournaments, comma-separated |
| `bo` | Series format: `3` or `5`; absent (or `all`) = both |
| `last` | Last N series for the team (`1`, `3`, `5`, `10`, `all`) |
| `dateFrom`, `dateTo`, `dateFrom2`, `dateTo2` | Date range per side |
| `excA`, `excB` | Teams excluded from the aggregate, per side |

---

## Data

Supabase is read-only from the app. Tables it queries:

`draft` (one row per series: full veto, bo, tournament, region, date) · `round_info` (one row per
round: map, side, win condition, score) · `player_stats` and `player_performance` (per-player,
per-map stats with an ATK/DEF split) · `team_economy` (credits per round) · `tournament_played`
(which team played which tournament — the source for the team and tournament dropdowns) ·
`regions`, `teams`, `maps_id`, `maps_name_ids`, `agent_info`, `simulations`, `skirmish`.

A few DB columns drive UI defaults instead of being hardcoded: `maps_name_ids.in_rotation` (maps
hidden by default in the map filters) and the image paths (`teams.team_path`,
`maps_name_ids.image_path`, `agent_info.agent_path`), which point at the assets under `public/`
(`teams/`, `maps/`, `agents/`, `roles/`, `region/`).

### Uploading data

CSVs go in `data/` and are **not versioned** (`.gitignore`). To upload them:

```bash
node scripts/upload.mjs
```

The script reads the `FILES_TO_UPLOAD` list from the file itself — each entry is
`{ file, table, pk }` — and upserts in chunks of 200 rows using the service role key. To load a
new table, add its entry there with the right PK (it's passed as `onConflict`). Some entries are
commented out (`simulations`, `skirmish`) because they're one-off loads.

Once the data is uploaded the cache invalidates itself: `getLastUpdateDate` looks at the most
recent date in `draft`, and that changes the key of everything wrapped in `versioned`.

---

## Conventions

- **New code comments in English.** Existing ones are still largely in Spanish and get
  translated opportunistically whenever a file is read or modified — see the "Ongoing" item in
  [ROADMAP.md](ROADMAP.md). UI strings are in English (unifying the UI language is a roadmap TODO).
- Numbers from Supabase can arrive as `number` or as `string` depending on the scraper: always
  read them through `Number(...)`.
- Any query that could exceed 1000 rows goes through `fetchAllPages`.
- Aggregates and static data go through `versioned`; anything depending on a volatile filter
  does not.

### Closing a change

A feature is considered done when it compiles, the section renders with real data for the
default tournament, and the numbers were verified against at least one hand-counted case:

```bash
npx tsc --noEmit
npm run build
```
