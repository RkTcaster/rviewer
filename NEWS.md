# News

Shown by the "News" button in the sidebar. Only the topmost entry is displayed.
Format: a `## date` heading (YYYY-MM-DD) followed by one `- ` bullet per change.
Adding a new date brings back the unread dot.

## 2026-10-15
- New Weapon Pick section (Testing): each team's most used loadouts, i.e. what the 5 players hold at the start of the round, weapons by category plus armor (e.g. "4 Rifle + Op · 4 Heavy + Light"), with rounds, % of the team's rounds and WR. Same team and map filters as Operator Use, plus ATK / DEF. Champions 2026 only for now.
- Weapon Pick: more detail in loadouts. Rifle is now only Vandal / Phantom; Bulldog and Guardian show on their own. Sheriff, Bandit and Classic show on their own, and Pistol is the rest (Shorty, Frenzy, Ghost). Odin and Ares show on their own, so Heavy only means heavy armor. The legend lists every group.
- Weapon Pick: new Armor chips under Maps: All, Heavy (all 5 with Heavy), Light (all 5 with Light), Mixed (anything else) and None (all 5 without armor). With a filter on, % is over the rounds that pass it.
- Weapon Pick: new Cost chips (the team's loadout value that round, same ranges as Economy: Eco <5k, Semi-eco 5–15k, Semi-buy 15–20k, Full buy 20k+) and Bank chips (the team's money left after buying: <2k, 2–6k, 6–10k, 10k+). Each loadout row adds its average Cost and Bank.
- Weapon Pick: Armor chips now show the armor icons (Mixed shows Heavy, Regen and Light together).
- Weapon Pick: new Round chips: All, R1 + R13 (pistol rounds) and R3 + R15. With one on, only those rounds count.
- Weapon Pick: new Merge armors toggle next to Both / ATK / DEF. Heavy, Regen and Light count as Armor, so loadouts only split by armor vs no armor (e.g. "4 Rifle + Op · 4 Armor + None").
- Weapon Pick: new Enemy loadout column, the rival's average loadout value in the rounds the team fielded that loadout.
- Agent Picks: new NMWR by chips (Maps / Rounds). Rounds computes NMWR as rounds won over rounds played on non-mirror picks; the NMWR column, sort, tooltip and NMWR Detail (header, per-map chart and each match's score) follow the choice.

## 2026-10-11
- Stats Rank: new FK-FD chip in Table info, a column group with True FK Rate, True FK Into Win, True FD Rate and True FD Into Win (True FK / FD Rate move here from Overall).
- True FK Into Win: rounds won after a True FK, over the team's True FKs. True FD Into Win: rounds won anyway after a True FD, over the team's True FDs. Champions 2026 only for now (— elsewhere).
- Compare Stats: new FK-FD block with the same four metrics and their rank.
- Compare Stats: Atk Loss by Time is replaced by Save Rate (same as Stats Rank), now the last Overall row. Not colored green / red. Champions 2026 only for now (— elsewhere).

## 2026-10-10
- Stats Rank: Atk Loss by Time is replaced by Save Rate (now the last Overall column): lost rounds where the team kept someone alive and let the round go (lost by time or by defuse while attacking, or the spike went off while defending), over lost rounds. It needs kill data, so for now it only shows for Champions 2026 (— elsewhere), and it isn't colored green / red.
- Stats Rank: new Trade Rate column (end of Overall): trades over the team's deaths, i.e. how often a teammate killed back the enemy who just got a kill. Champions 2026 only for now (— elsewhere).
- Stats Rank: new True FK Rate column (end of Overall): first kills the rival didn't trade within 5 seconds, over all the team's first kills. Champions 2026 only for now (— elsewhere).
- Stats Rank: new True FD Rate column, right after True FK Rate: first deaths the team didn't trade within 5 seconds, over all the team's first deaths. Lower is better. Champions 2026 only for now (— elsewhere).
- Stats Rank: new Legend button explaining every column.
- Operator Use: Kept now counts an Op only when its holder already had it the previous round and survived, or died but the team won and picked it back up. An Op dropped by a teammate or taken from the enemy no longer counts, so Kept and Save Op are lower than before. A player's Kept can no longer be higher than the team's. The legend explains the new rule.
- Operator Use: new Operator and Outlaw chips. Operator shows the table as before; Outlaw shows the same columns for the Outlaw, and with both on a round counts if anyone had either of the two. Column names follow the choice (Op / Outlaw / Op+Outlaw). Kept needs the same weapon the round before: switching from an Operator to an Outlaw isn't kept. With Outlaw on (alone or with Operator), rounds 2 and 14 count too, since the Outlaw gets bought there; Operator alone still leaves out 1, 2, 13 and 14.
- Operator Use: new columns Op kills (kills made with the weapon), Op first duel (Op FK / (Op FK + Op FD): opening duels won by a player holding the weapon) and First duel (FK / (FK + FD) with any weapon, over the rounds counted). Detail info shows the FK and FD counts under each %. They follow the Operator / Outlaw chips; team kills are left out.

## 2026-10-09
- New Operator Use section (Testing): per team, % of rounds where at least one player had an Operator (bought or kept from the previous round). Rounds 1, 2, 13 and 14 are left out. Champions 2026 only for now.
- Columns: Op WR and No-Op WR (round win rate with and without an Op), Kept (Op rounds where it wasn't bought), Save Op (of those, the ones that came after a lost round), Full buy / Half buy (Op rate when the team's loadout is 20000+ / 15000–19999) and the agents that held it. Click any header to sort.
- Both / ATK / DEF buttons switch the whole table between both sides, attack only and defense only; Detail info shows the counts under each %. Click a team to expand it and see the same numbers per player. The map chips choose which maps are added up.

## 2026-10-07
- Compare Maps / Stats / Economy: with both teams selected, the browser tab shows "Team A vs Team B VCT Data".

## 2026-10-05
- Compare Maps: most likely veto between the two teams (same model as Veto Predictor), shown with the Add veto button next to Maps. The left team opens the veto; swap it with the button and lock real steps to recalculate. Each map in the table shows who bans or picks it (Ban 1 / Pick / Ban 2 / Decider) with the team logo and an arrow to its side.
- Team logos in every Team selector and in the Exclude Teams lists.
- Stats Rank, Maps Rank, Neon + Phoenix, Post-Pistol Force and Series Outcomes: the team panel folds into one line with the selected count; click Teams to open it (it remembers the choice). Team chips have the same size on every page.
- Quick Tournament buttons (Champs / Stage 2) on every section. Outside Compare they start on, so pages open on Stage 2 + Champions; turn them off to see every tournament.
- Compare Maps / Stats / Economy: Champs starts on for each team that played Champions; a team that didn't starts on all its tournaments.

## 2026-10-01
- Veto Predictor: new Win probability panel (experimental) with the series winner, the 2-0 / 2-1 / 1-2 / 0-2 split, per-map win chance and likely score, and each team's current lineup.
- Veto Predictor: optional map-aware model toggle.
- Veto Predictor: model updated with data up to 2026-09-28.

## 2026-09-29
- Compare Maps / Stats / Economy: Quick Tournament buttons to load Champions 2026 or each team's Stage 2.
- Compare: team logos in the Team A and Team B selectors.
- Sidebar: open/close it with the edge tab, the bottom button or Ctrl+B; it remembers its state.
- Sidebar: new News button with the changes of the latest update.
- Compare Maps: team selectors renamed to Team Left and Team Right.
