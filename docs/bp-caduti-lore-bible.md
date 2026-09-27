# BP Caduti — League Lore Bible (living document)

This file is the **source of truth** for franchise lore on the continent **BP Caduti**. Team-facing text is seeded from `server/scripts/seed-league-team-lore.js` into `league_teams.lore` / `tagline`. Update this bible **before** bulk rewrites so partial reveals and future seasons stay consistent.

**Version:** 0.2 (chronicles seeded)  
**Last updated:** 2026-03-22  
**Status:** All eighteen house chronicles in `server/scripts/data/leagueFranchiseLore.*.js`; apply with `seed-league-team-lore.js --apply --force`.

---

## 1. Purpose and player experience

- Lore should reward **slow reading**, **wrong guesses**, and **cross-house connections** (wars, exiles, shared cities, opposed doctrines).
- Do **not** explain everything in v1. Many proper names (including why the land is called **BP Caduti**) stay **unrevealed** or **contradictory in fragments** on purpose.
- **Never** mention modern circuits, seasons, brackets, esports, or real-world gaming. These houses exist inside **myth and war chronicles** only.
- Name the continent **BP Caduti** in most franchise lore. Use **Breviarium Populi Caduti** sparingly (formal stone, temple, archaic chronicle). Do **not** use the initials **BPC** or translate what the Latin name means in player text.
- Tone: **light, dark, and grey** in balance. No house is purely heroic or purely monstrous without exception scenes.

---

## 2. What we are NOT explaining yet (spoilers vault)

Keep these out of public team lore until a deliberate release. Internal notes only.

| Topic | Notes |
|--------|--------|
| Meaning of **Breviarium Populi Caduti** | Mostly **BP Caduti** in lore; full Latin rarely. Do not gloss or translate for players yet. Never **BPC**. |
| Full truth of the **Grand Fracturing** | Year **266 BC** is known; whether it was purely natural, provoked, or judged is **unknown**. |
| Why the Central Core is **obliterated** | Ruins speak of slaughter and defeat; cause is **disputed**. |
| Complete **ally/rival graph** | Hints only in v1; future patches may add a **five year war of four houses**, broken pacts, etc. |
| Map of **all** 35–40 settlements | Cities appear when a house needs them; the full gazetteer is not player-facing yet. |
| Logo “canon” vs symbol in story | Emblems may be described without saying “logo”; tie heraldry to founding myths. |

When adding a reveal, append a row to **§12 Changelog** and note which house texts were touched.

---

## 3. World history (player-safe summary)

In **266 BC**, the **Grand Fracturing** tore the old world: quakes, ash, drowned coasts, rivers choked with cinder. Empires ended in days, not decades.

Survivors crawled onto one scarred landmass. Chronicles name it **Breviarium Populi Caduti**. Why that name was chosen, and what it fully means, is not explained in v1 player lore. (Internal note: *Breviarium Populi Caduti* = the remnant of fallen people; **BP Caduti** is staff shorthand for this doc only.)

### Recovered fragment (Central Core scribal hand)

> We walked out of the smoking fissures into a world we no longer recognized. The great libraries were dust; the kings, long dead. To the North, the ash choked air froze into glaciers that never melt. To the West, the winds dried the soil until it bled red sand. We carved our new lives into the bones of the old, naming our settlements in the dead tongues of our ancestors, Latin, Greek, and the old Frankish dialects. Breviarium Populi Caduti is all that remains of the light. If we fail here, the dark takes everything.

Players may hear the name on stone and in chronicles; its meaning is withheld for later releases.

---

## 4. Geography and climate regions

### 4.1 Regional map (reference)

```
                 [ THE ICY NORTH ]
       (Glacière, Cryopolis, Géliville, Frigidarium)
              .---------------------------.
             /      ^^^ Mont Perdu ^^^     \
            /    [Camp de la Misère (POW)]  \
           /                                 \
          /   ____________________________    \
         /   /  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~  /     \
        /   /   ~~ Fleuve Profond ~~~~  /       \
       /   /___________________________/         \
      /   /                                       \
     /   /   ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲             \
    /   /    ▲   LES DENTS DE FER    ▲              \
   /   /     ▲   (Mountain Range)    ▲               \
  /   /      ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲                \
 /   /                   │                             \
/   /                    │ [THE CENTRAL CORE]           \
|  /                     │ (Necropolis, Caedes, Clades)  |
| /                      │                               |
|/   (Lake Lethe)        ▼ [The Barathrum Fissure (Cave)]|
|     [ ~~~~~ ]                                          |
|                                                        |
| [THE ARID WEST]                 [THE TROPICAL EAST]    |
| (Siccitas, Xerotes,             (Pluvia, Thalassa,     |
|  Anydros, Sable-Rouge)           Verdure, Umidus)      |
|                                                        |
|   ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~    |
|   ~~~~~~~ River Lacrimosa (Flows East) ~~~~~~~~~~~~    |
|   ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~    |
|                                                        |
|  [Castra Captivorum]               (Marécage / Swamps) |
|      (POW Camp)                                        |
|                                                        |
|           [Campus Mortuus / Plains of Silence]         |
|                       (Grasslands)                     |
|                                                        |
|        Oros Skoteino Peak        Mons Clamoris Peak    |
|              ▲▲▲                        ▲▲▲            |
|             /   \                      /   \           |
|            /     \                    /     \          |
|           '-------'                  '-------'         |
\                                                       /
 \                   [ THE WARM SOUTH ]                /
  \      (Méridien, Aestas, Apricus, Helios, Soleil)  /
   '-------------------------------------------------'
```

### 4.2 Settlements and sites (gazetteer)

Use names sparingly in lore; not every city appears in v1.

#### Icy North

| Name | Inspiration | Sense |
|------|-------------|--------|
| Glacière | French | Icehouse / glacier |
| Cryopolis | Greek | The frost city |
| Boreas | Greek | The northern wind |
| Géliville | French | Frost town |
| Calor-Inops | Latin | Lacking heat |
| Frigidarium | Latin | The cold place |
| Nivôse | French | The snowy month |
| Chion | Greek | Snow |
| Anemoi | Greek | The winds |

#### Arid West

| Name | Inspiration | Sense |
|------|-------------|--------|
| Siccitas | Latin | Drought / dryness |
| Xerotes | Greek | Aridity |
| Poussière | French | Dust |
| Solitudo | Latin | Wasteland |
| Chaleur | French | Heat |
| Anydros | Greek | Waterless |
| Therma | Greek | Hot springs / heat |
| Sable-Rouge | French | Red sand |
| Calamitas | Latin | Misfortune / destruction |

#### Tropical East

| Name | Inspiration | Sense |
|------|-------------|--------|
| Pluvia | Latin | Rain |
| Thalassa | Greek | The sea |
| Verdure | French | Lush greenery |
| Moisson | French | Harvest |
| Zotikos | Greek | Full of life |
| Amoenus | Latin | Pleasant place |
| Marécage | French | Swamp |
| Chloris | Greek | Pale green / vegetation |
| Umidus | Latin | Humid place |

#### Warm South

| Name | Inspiration | Sense |
|------|-------------|--------|
| Méridien | French | Southern / midday |
| Aestas | Latin | Summer |
| Notos | Greek | South wind |
| Soleil | French | Sun |
| Apricus | Latin | Sun drenched |
| Helios | Greek | The sun |
| Flambeau | French | Torch |

#### Central Core (ruined)

| Name | Inspiration | Sense |
|------|-------------|--------|
| Caedes | Latin | Slaughter |
| Clades | Latin | Defeat / ruin |
| Necropolis | Greek | City of the dead |
| Cendres | French | Ashes |
| Abyssos | Greek | Bottomless pit |

#### Waters

| Name | Role |
|------|------|
| River Lacrimosa | Great eastward river |
| Lake Lethe | Deep still lake (forgetfulness) |
| Fleuve Profond | Fast, dangerous waterway (north) |

#### Mountains

| Name | Role |
|------|------|
| Les Dents de Fer | Iron spine dividing the continent |
| Mons Clamoris | Wailing peak / volcanic |
| Oros Skoteino | Storm shrouded dark peak |
| Mont Perdu | Hidden north peak |

#### Caves

| Name | Role |
|------|------|
| The Barathrum Fissure | Bottomless pit |
| Grotte des Ombres | Shadow labyrinth |
| The Spelaion Core | Primordial cave |

#### Grasslands

| Name | Role |
|------|------|
| Campus Mortuus | Dead plain / savannah |
| Les Plaines de Silence | Eerie open grassland |
| The Agros Steppe | Wild fields |

#### Internment (use with care; grim)

| Name | Role |
|------|------|
| Castra Captivorum | Desert cliff prison, west |
| Camp de la Misère | Isolated northern labor camp |
| The Desmoterion Grid | Chained ruin / dungeon |

---

## 5. The eighteen houses (franchise slugs)

Asset paths: `dota/public/images/teams/<id>.png` (see `dota/src/constants/teamLogos.js`).

| Slug | House name | Draft home region (v1) | Emblem notes (for prose) |
|------|------------|-------------------------|---------------------------|
| `arcane-order` | Arcane Order | Central Core / Necropolis margins | Script, sigils, forbidden patterns |
| `arrise-corp` | Arrise Corp | Lacrimosa trade corridor | Convoy, ledger, rising sun on seal |
| `ashborn` | Ashborn | Cendres / Campus Mortuus edge | Cinder birth, second breath |
| `chaos-rift` | Chaos Rift | Barathrum Fissure | Seam in fate, broken compass |
| `crimson-veil` | Crimson Veil | Sable-Rouge / western passes | Hood, crescent blades, dye guild |
| `dark-horse` | Dark Horse | Les Plaines de Silence | Black stallion omen |
| `emberfall` | Emberfall | Tropical east / Moisson | Falling coals, hospitality trial |
| `frost-reign` | Frost Reign | Cryopolis / Glacière | Crowned ice wolf, crystal fangs |
| `godsent` | Godsent | Helios / Apricus border | Winged armored figure, gold sigil |
| `invictus` | Invictus | Warm south legion roads | Unbroken line, eagle law |
| `kingsguard` | Kingsguard | Les Dents de Fer passes | Outward shield, throne not touched |
| `mortal-oath` | Mortal Oath | Lacrimosa fords | River oath, one truth per war |
| `nemesis` | Nemesis | Oros Skoteino foothills | Scales, proportional return |
| `northwind` | Northwind | Boreas / Anemoi coast | Wind that tests the proud |
| `obsidian-core` | Obsidian Core | Spelaion Core / volcanic glass | Mirror stone, pressure truth |
| `phantom-division` | Phantom Division | Grotte des Ombres | Empty helmet, false patrol |
| `vanguard` | Vanguard | Agros Steppe | Wedge first, gate hymn |
| `warpath` | Warpath | Campus Mortuus | Armored rhino, gold horn, war road |

Homelands are **draft anchors**; lore may mention travel, exile, and second capitals.

---

## 6. Writing rules (house chronicles)

### 6.1 Structure

Target **7–8 paragraphs** per house, separated by blank lines (`\n\n`) in the seed file.

1. **Land and crisis** on BP Caduti (region, famine, occupation, ash, river law).  
2. **Naming and emblem** (why the house name; heraldry from founding, not “logo”).  
3. **Doctrine** (how they fight / govern / survive) in **non-game** language.  
4. **Founding fracture** (split, exile, rival house born; at most **one** clear rival origin here).  
5. **Great war beat** (subtle, normal, or direct; see §7).  
6. **Ventures and pacts** (allies earned; envoys from confederations refused → neutrality).  
7. **Optional eighth:** proverb, ritual, or present fear.  
8. **Optional:** hook that contradicts another house’s account (unresolved).

### 6.2 Vocabulary

| Avoid | Prefer |
|--------|--------|
| Draft, lane, gank, meta, bracket, roster, series, map | Campaign, road, ambush, doctrine, convoy, season of rain |
| Analyst, esports, LAN, click | Scribe, augur, choir, bell hour |
| Strong draft, carry | Methodical preparation, shield the flame |

### 6.3 Naming other houses

- **Mix:** epithets (“the crowned wolves”), partial names, and **occasional full house name**.  
- **Budget:** roughly **1–2 other houses named** per chronicle; others implied by war, color, or emblem.  
- **No** modern league or circuit names.

### 6.4 Hyphens and punctuation

- In **player-facing lore**, avoid hyphenated compounds and em dashes where possible (LLM double hyphen risk).  
- **Geographic proper names** from the gazetteer may keep their established spelling (e.g. Sable-Rouge, Calor-Inops).

### 6.5 Relationship counts (when referenced in prose)

| Relation | Min | Max | Notes |
|----------|-----|-----|--------|
| Allies | 1 | 5 | Only 1–2 houses should have 4–5 allies |
| Rivals | 1 | 10 | Most houses 2–4; chaos houses may edge higher |
| Neutral toward confederations | — | 4–5 | “Leagues” = harbor pact, steppe compact, etc., not esports |

Maintain a **bidirectional check** in §8 before publishing.

### 6.6 Doctrine cheat sheet (myth language)

| House | Doctrine (internal) |
|-------|---------------------|
| Arcane Order | Long calendars, true names, victory by foresight |
| Arrise Corp | Convoy timing, shift bells, engineered endurance |
| Ashborn | Rise after collapse, second breath campaigns |
| Chaos Rift | Weather tactics, broken patterns |
| Crimson Veil | Veiled approach, removal without witness |
| Dark Horse | Late revelation, feigned weakness |
| Emberfall | Relentless warmth, hospitality as siege |
| Frost Reign | Cordon, silence, slow suffocation of supply |
| Godsent | Believed timing, relief when hope thins |
| Invictus | Unbroken line, honour in retreat |
| Kingsguard | Outward shield, throne untouched first |
| Mortal Oath | One promise per campaign |
| Nemesis | Proportional answer to hubris |
| Northwind | Redirect march, strike when maps lie |
| Obsidian Core | Mirror halls, crush in the narrow heart |
| Phantom Division | False camps, reports from tomorrow |
| Vanguard | Wedge first, hold until hymn ends |
| Warpath | Declared road, drum march, no feint |

---

## 7. Three great wars (shared timeline)

Use across houses at **three intensities**:

- **Subtle:** blocked roads, decade of snow, no battle name.  
- **Normal:** named war, unnamed factions.  
- **Direct:** named battle, emblem, or house.

| War | Region | Canon role |
|-----|--------|------------|
| **Siege of the Glass Ford** | Lacrimosa crossing | Frost Reign hardens into rule; Kingsguard holds the ford; Emberfall burns a convoy line. |
| **Northern Blockade Decade** | Dents de Fer passes north | Crimson Veil stalled toward Glacière; Northwind smuggles; Arcane Order charts detours. |
| **Battle of the Winged Standard** | Campus Mortuus / east plain | Warpath broken; **Godsent** relief (direct); Invictus withdraws unbroken; Nemesis records a debt. |

**Distribution target (18 houses):** ~6 subtle, ~6 normal, ~6 direct references.

### Example lines (tone only)

- **Subtle (Crimson Veil):** “They neared the northern markets, but shelter edicts and road closures held them below the snow line for ten winters.”  
- **Direct (Frost Reign):** “After the Glass Ford, Cryopolis stopped pretending mercy was a policy.”  
- **Direct (Warpath):** “When the rhino banner wavered, a black winged standard entered the dust and the road belonged to them again.”

---

## 8. Relationship matrix (draft v0.1)

**Legend:** A = ally, R = rival, N = neutral stance toward that house (not enmity). Confederations (Harbor Concord, Steppe Compact, Iron Circuit, Lacrimosa League, Lethe Synod) are **neutral targets** in prose, not rows here.

Update this table when lore ships. Empty cells = “hint later.”

|  | arc | arr | ash | cha | cri | dar | emb | fro | god | inv | kin | mor | nem | nor | obs | pha | van | war |
|--|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **arcane-order** | — | N | A | R | N | N | N | R | N | N | A | R | N | A | A | N | N | N |
| **arrise-corp** | N | — | N | R | N | N | A | N | N | N | N | N | N | A | N | N | A | N |
| **ashborn** | A | N | — | N | N | N | R | N | N | A | N | N | N | N | N | N | N | A |
| **chaos-rift** | R | R | N | — | N | A | N | R | N | N | N | N | A | N | R | N | R | R |
| **crimson-veil** | N | N | N | N | — | N | N | N | N | N | N | N | A | A | R | R | N | N |
| **dark-horse** | N | N | N | A | N | — | N | N | N | R | N | N | N | N | N | N | N | N |
| **emberfall** | N | A | R | N | N | N | — | R | A | N | N | N | N | N | N | N | N | A |
| **frost-reign** | R | N | N | R | N | N | R | — | N | A | R | N | N | R | A | N | N | N |
| **godsent** | N | N | N | N | N | N | A | N | — | N | A | A | R | N | N | N | A | A |
| **invictus** | N | N | A | N | N | R | N | A | N | — | A | N | N | N | N | N | A | N |
| **kingsguard** | A | N | N | N | N | N | N | R | A | A | — | A | N | N | N | N | A | N |
| **mortal-oath** | R | N | N | N | N | N | N | N | A | N | A | — | R | N | N | N | N | N |
| **nemesis** | N | N | N | A | A | N | N | N | R | N | N | R | — | N | N | N | R | N |
| **northwind** | A | A | N | N | A | N | N | R | N | N | N | N | N | — | N | A | N | N |
| **obsidian-core** | A | N | N | R | R | N | N | A | N | N | N | N | N | N | — | N | N | R |
| **phantom-division** | N | N | N | N | R | N | N | N | N | N | N | N | N | A | N | — | N | N |
| **vanguard** | N | A | N | R | N | N | N | N | A | A | A | N | R | N | N | N | — | A |
| **warpath** | N | N | A | R | N | N | A | N | A | N | N | N | N | N | R | N | A | — |

**Rival origin seeds (for fracture paragraphs):**

- Arcane Order ↔ Mortal Oath (ink vs oath).  
- Arrise Corp ↔ Chaos Rift (schedule vs seam).  
- Ashborn ↔ Emberfall (ash after ruin vs ember test).  
- Crimson Veil ↔ Phantom Division (dye silence vs false patrol).  
- Frost Reign ↔ Emberfall (ice sovereignty vs fire refusal).  
- Godsent ↔ Nemesis (mercy vs measure).  
- Warpath ↔ Obsidian Core (open road vs mirrored choke).

**Future arc (not in v1 text):** five year war involving **four** houses; document trigger when ready in §12.

---

## 9. Taglines (canonical v1)

Seeded via `leagueFranchiseLore.part1.js` / `part2.js`. Reverted from v2/v3 refresh passes.

| Slug | Tagline |
|------|---------|
| `arcane-order` | Knowledge is the deadliest spell. |
| `arrise-corp` | Built to scale. Built to win. |
| `ashborn` | From embers, empires. |
| `chaos-rift` | Order breaks here. |
| `crimson-veil` | Seen too late. Gone too soon. |
| `dark-horse` | Odds are suggestions. |
| `emberfall` | Heat that never cools. |
| `frost-reign` | Cold reads. Colder finishes. |
| `godsent` | Faith in the click. |
| `invictus` | Unbowed. Unbroken. |
| `kingsguard` | The crown defends itself. |
| `mortal-oath` | Sworn in blood. Paid in trophies. |
| `nemesis` | Your problem returns. |
| `northwind` | Carried from the edge of the map. |
| `obsidian-core` | Pressure forged. Pressure applied. |
| `phantom-division` | Ghosts in the war log. |
| `vanguard` | First in. Last standing. |
| `warpath` | No detours. Only war. |

---

## 10. Implementation notes (engineering)

| Piece | Location | Note |
|-------|----------|------|
| Lore seed | `server/scripts/seed-league-team-lore.js` | `FRANCHISE_COPY`; `--apply --force` to overwrite DB |
| Public UI | `dota/src/components/league/LeagueFranchiseHero.jsx` | Today caps at **3** paragraphs; extend so **Read more** shows full chronicle before 7–8 block rollout |
| DB | `league_teams.lore`, `tagline` | `history` field exists for future structured allies |

---

## 11. Confederations (generic “leagues” in prose)

Use varied names; do not tie to real organisations.

- **Concord of Nine Harbors** (Thalassa / Lacrimosa mouths)  
- **Steppe Compact** (Agros / Silence plains)  
- **Iron Circuit** (Dents de Fer mining charters)  
- **Lethe Synod** (lake temples, memory law)  
- **Cryopolis Diet** (northern city alliance)

Houses should **refuse or delay** membership in **4–5** such bodies across the setting over time; each chronicle mentions **one or two** at most.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-03-22 | v0.1 bible: BP Caduti gazetteer, Grand Fracturing, mystery vault, war timeline, matrix draft, tagline refresh, writing rules. |
| 2026-03-22 | v0.2: Full chronicles for all 18 houses; UI shows all lore paragraphs on expand; hooks = first sentence of each chronicle. |
| 2026-03-22 | v0.2.1: Chronicles consolidated to 5–6 longer paragraphs each (hook opens paragraph one). |
| 2026-03-22 | v0.2.2: Tagline refresh (14 houses); Crimson Veil, Frost Reign, Invictus, Vanguard unchanged. |
| 2026-03-22 | v0.2.3: Taglines tied to franchise names (14 houses). |
| 2026-03-22 | v0.2.4: Taglines reverted to canonical v1 (all 18 houses). |

---

## 13. Next steps (when approved)

1. Tone check: draft **one** full chronicle (e.g. `warpath` or `crimson-veil`).  
2. Fix lore UI paragraph cap.  
3. Batch remaining seventeen; run matrix bidirectional review.  
4. Seed dev DB; player read-through for connection hunting.
