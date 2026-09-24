/**
 * Seed franchise lore (and short taglines) for league_teams.
 *
 * Usage (from server/):
 *   node scripts/seed-league-team-lore.js --check
 *   node scripts/seed-league-team-lore.js --apply
 *   node scripts/seed-league-team-lore.js --apply --force
 */
import dotenv from "dotenv";
import { pool } from "../src/db/pool.js";

dotenv.config();

/** @type {Record<string, { tagline: string, lore: string }>} */
const FRANCHISE_COPY = {
  "arcane-order": {
    tagline: "Knowledge is the deadliest spell.",
    lore:
      "The Arcane Order began in candlelit scriptoria above the Rhône, where exiled scholars copied star-charts and oath-bound ledgers for patrons who feared open war more than whispered hexes. They were never a church—only a fraternity that believed history could be rewritten if you learned the true names of things: rivers, dynasties, constellations, and the old syllables that made auditors blink. Kings hired them to predict harvests; rebels hired them to predict betrayals. Initiates still whisper the same vow in three dead languages: read before you rule.\n\nWhen the franchise took the name, it carried that pedigree into the league: calm voices, long memories, plans that look boring until the last act. Fans joke that their analysts see tomorrow's headline today; veterans say the Order treats every season like a codex still being transcribed. Old initiates leave one superstition in every prep room: a chalkboard of forbidden patterns—twin crescents, orbiting sigils—that reminds rookies mastery is not flair, only patience with power.",
  },
  "arrise-corp": {
    tagline: "Built to scale. Built to win.",
    lore:
      "Arrise Corp is younger than its myth. The story told in Osaka boardrooms is that a shipping heiress funded a \"rising house\" after the 1997 floods, promising that disciplined crews could rebuild faster than disaster could repeat. Dockworkers, accountants, and night-shift planners formed a club that won local leagues with punctual rotations and brutal punctuality, not flash. The Corp's first trophy sat beside ledgers; their first chant was a time-clock stamp.\n\nThe name crossed oceans as a franchise that treats rosters like crews: clear roles, rehearsed handoffs, no romance for chaos. Rivals mock the corporate gloss until a season ends and the Corp is still standing, unbroken on paper. League folklore claims their analysts repeat one proverb before every draft—\"the sun does not argue with the tide\"—and that when Arrise truly commits, you feel it like a harbor lifting: slow, engineered, and impossible to stop once the chains come off.",
  },
  "ashborn": {
    tagline: "From embers, empires.",
    lore:
      "Ashborn comes from the Soot Gospel of the Carpathian foothills, where villagers swore that every great fire leaves a child of cinders who walks out when the bells crack. Not a demon—a second chance shaped like a person, eyes bright with what was almost lost. Ashborn societies kept ember-jars on hearths; mothers told sons that glory is not born clean, it is born when the roof falls and you still choose to stand.\n\nThe franchise wears that myth without apology: rosters rebuilt after collapses, captains who speak softly after public defeats, wins that look like resurrections. Commentators call them comeback merchants; historians call them faithful to an older rule—that heat remembers who endured it. One whisper follows them in BPCL tunnels: when Ashborn's luck turns late in a series, old fans touch their chests like they're feeling for a heartbeat that once stopped, and returned.",
  },
  "chaos-rift": {
    tagline: "Order breaks here.",
    lore:
      "Geologists in Iceland named a fissure Chaos Rift after instruments failed for a week and compasses spun like drunk needles. Local sagas already had a version: a seam where the world-midwife dropped her scissors and fate learned to improvise. Pilgrims went there not to pray but to listen—some returned artists, some returned mad, all returned changed. The modern club adopted the name when a Reykjavík five won a winter tournament playing three different styles in three games and laughing about it in the same breath.\n\nChaos Rift the franchise keeps that covenant with unpredictability: drafts that feel like weather, momentum that obeys no forecast. Purists hate them; neutrals buy tickets. League archivists note their seasons by the matches that should not have worked—then did. Players repeat one line from the saga before chaotic drafts: \"The rift does not hate you; it simply does not know your plan.\"",
  },
  "crimson-veil": {
    tagline: "Seen too late. Gone too soon.",
    lore:
      "In Shiraz alley markets, the Crimson Veil was a guild of silk-dyers who doubled as message-carriers for poets and fugitive princes—red cloth meant \"delivered,\" black meant \"vanished.\" They never killed for sport; they removed problems so quietly that courts argued whether the problem had ever existed. Their oath forbade fame; their reward was anonymity and excellent tea. European travelers wrote home about \"the faction that leaves only color behind.\"\n\nThe franchise inherited the aesthetic: patience, misdirection, punishment that arrives when attention has already looked elsewhere. They are not flashy in biography—only in the moment the veil lifts. Opponents describe playing them like trying to catch incense: you grasp heat, not source. A BPCL documentarian swore their boot room smells of saffron and ozone; whether true or myth, it fits a team that wins the silence between heartbeats.",
  },
  "dark-horse": {
    tagline: "Odds are suggestions.",
    lore:
      "On the Yorkshire moors, a Dark Horse was never luck—it was omen. A coal-black stallion seen at dusk meant the old families were about to upset the new money, or the hung jury would free the innocent, or the last son would come home from war. Bookies borrowed the phrase; the villages kept the older meaning: the creature appears when the story needs a twist written in hoofbeats. A pub league took the name in 2008 after a bartender's five upset three sponsored clubs on a flooded pitch.\n\nDark Horse the franchise keeps that folk spirit: rosters built from overlooked names, belief treated as equipment. Analysts slot them low; brackets learn better. Their supporters sing a drinking song about \"the fourth son, the fifth map, the horse at the hedge.\" League history remembers them as the club that makes caution look arrogant—because in their mythology, the dark horse does not chase glory; glory catches up when the favorites blink.",
  },
  "emberfall": {
    tagline: "Heat that never cools.",
    lore:
      "Emberfall is named for the Night of Falling Coals, a Philippine legend where ancestors sent burning seeds to villages that had forgotten hospitality—each ember a test, not a curse. Good hosts caught them in banana leaves and cooked for strangers; cruel hosts woke to fields of glass. The story survived colonization because grandmothers are stubborn. A Manila university team adopted Emberfall after winning a charity cup during a volcanic ash alert, playing with masks on and hearts loud.\n\nThe franchise channels that heat: tempo as generosity, aggression as protection of the weak on the server. They arrive intense, almost ceremonial, as if every match owes the community an answer. Fans describe their wins like meteor showers—brief, terrifying, beautiful. One league superstition says never taunt Emberfall after they lose Game 1; the embers are already in the air, and the second night always burns hotter.",
  },
  "frost-reign": {
    tagline: "Cold reads. Colder finishes.",
    lore:
      "Frost Reign traces to the White Tsar tales of the Rus north, where winter was not weather but a seated sovereign who judged travelers by how they shared firewood. Offer nothing, freeze; offer truth, pass. Cossack storytellers merged the figure with Baba Yaga's patience—throne of birch, crown of rime, voice like a lake cracking. A St. Petersburg club used Frost Reign when they won an indoor league playing slow, immaculate sets that ended in sudden suffocating closes.\n\nThe franchise plays into that legend: control, choke, inevitability. They do not shout; the map gets quieter until it is theirs. Rivals say facing them feels like walking into a cathedral of ice—beautiful, hostile, final. Old fans murmur about a \"winter minister\" on their staff who never shows face on camera. Whether metaphor or myth, it captures a team that treats mercy as a resource it rarely spends.",
  },
  "godsent": {
    tagline: "Faith in the click.",
    lore:
      "Godsent began as a Lagos street choir that funded football kits with hymn marathons—name taken from elders who said talent was \"sent, not seized.\" When their midfielder broke an ankle and a substitute scored twice, the neighborhood sang the same words for weeks: God sent the boy. The phrase stuck through esports pivots, visa heartbreaks, and one miracle LAN where lag cleared for exactly thirty seconds in a grand final.\n\nThe franchise keeps faith as infrastructure: trust drills, shared meals, rituals that look corny until a bracket turns. Skeptics call it luck theology; players call it alignment. League cameras love their celebrations because they look like relief, not arrogance—as if winning were answered prayer, not owned property. Their captain once said, \"We do not play for omens; we play so when the omen comes, we are worthy.\" New recruits hear that sentence on day one and are expected to remember it.",
  },
  "invictus": {
    tagline: "Unbowed. Unbroken.",
    lore:
      "Invictus carries a Roman epithet older than esports: the Ninth's unofficial motto after a winter mutiny failed and the legion still marched home under its eagles. Historians argue details; the myth endures—an army that loses battles but not itself. A São Paulo gym club chose Invictus after three relegations in four years and a fourth-season promotion played with ten men for forty minutes. They won anyway; the name became law.\n\nThe franchise embodies stubborn continuity: same core values through roster storms, same refusal to bow in speech or style. They are not always champions, but they are rarely broken. Opponents who celebrate early learn the legion joke—Invictus remembers. Supporters repeat two Latin words in the stands—unbreakable by shame—not as marketing, but as how they survive droughts and still fill seats.",
  },
  "kingsguard": {
    tagline: "The crown defends itself.",
    lore:
      "Kingsguard lore comes from Ethiopian chronicles of the Kebur Zabanga—palace regiments who swore to die facing outward while the emperor deliberated inward. Their honor was direction: danger must meet steel before it meets throne. Folk songs praise the guard who held a bridge with a broken spear; historians note the bridge was real, the spear maybe not. A diaspora team in London took Kingsguard as tribute and won two community cups playing protect-the-carry basketball translated to pixels.\n\nThe franchise treats the back line like royalty: layered duty, sacrificial clarity, wins that look like fortresses. They may not dazzle first—they endure until dazzle is irrelevant. League pundits compare their best series to coronations: slow, formal, irreversible. Veterans whisper one line before tight series: shield the light—not a hero's name, only the idea that someone must stand in front of the flame.",
  },
  "mortal-oath": {
    tagline: "Sworn in blood. Paid in trophies.",
    lore:
      "Mortal Oath references the Greek horkos—the binding curse on liars who swear by the river Styx. Warriors pledged one truthful act worth more than life; break it, and legend says the earth forgets your name. A Sparta-themed historical reenactment club spawned a gaming wing after members tired of fake battles and wanted real stakes. They chose Mortal Oath because \"mortal\" meant finite time, and finite time meant no wasted maps.\n\nThe franchise plays like people who mean words: high commitment, visible emotion, stories that hurt when they lose. Fans call them melodramatic; poets call them honest. BPCL archives their rivalries like tragedies—promises made on stage, paid in full or punished in public. Their ritual before matches is simple: each player states one thing they will not abandon that day. No gods invoked—only the old fear that oaths outlive the swearer.",
  },
  "nemesis": {
    tagline: "Your problem returns.",
    lore:
      "Nemesis is the Greek spirit of proportional retribution—not cartoon villainy, but the force that restores balance when mortals boast too loudly. Temples kept small altars to her beside courts; athletes whispered her name before rematches. A Berlin club adopted Nemesis after a roster split and reunion that won the very event that expelled them. The story fit: what you exile returns dressed as consequence.\n\nThe franchise studies grudges like curriculum: habits, comfort, hubris. They appear in elimination matches with answers that feel personal because they are. Whether hero or villain depends on your bracket pain. League fans describe Nemesis as \"the notification you ignored until it was due.\" Coaches say every rematch with them feels like standing on temple scales—hubris weighed, then answered. One player quipped that they don't chase revenge; revenge keeps their calendar.",
  },
  "northwind": {
    tagline: "Carried from the edge of the map.",
    lore:
      "Northwind comes from Sámi stories of Biegggalggá, the wind-man who tests hunters by pushing them off-course—cruel only to the proud, gentle to those who admit they are lost. Coastal crews painted arrows on oars \"with the north wind's permission.\" A Tromsø youth league team named Northwind after winning a storm-delayed final played with one hand on the comms, one ear to the world outside, as if listening for guidance.\n\nThe franchise is chartered like that storm front: mobile, patient, sudden when the gust arrives. Scouts say their paths bend maps; opponents say open lanes close without explanation. They entered BPCL lore before their first official trophy—pure potential shaped like weather. Supporters bring wind chimes to watch parties; superstition says they ring when Northwind's roster finally \"hears the direction.\" Whether myth or meme, it matches a brand built on redirection, not raw force.",
  },
  "obsidian-core": {
    tagline: "Pressure forged. Pressure applied.",
    lore:
      "Obsidian Core draws from Mexica tradition—tezcatl mirrors of volcanic glass said to show truth to rulers and steal lies from ambassadors. Priests fractured obsidian carefully; a bad cut meant bad prophecy. A Mexico City collective used Obsidian Core when they won a grassroots circuit playing tight, interior rotations that felt claustrophobic, like rooms shrinking. The name praised pressure that reveals character.\n\nThe franchise treats the map's center like sacred stone: dense coordination, calm in choke points, wins that feel mined rather than gifted. Season 1 casters said playing them was like standing in a mirrored hall—every move reflected back with interest. Staff swear by \"black glass hours\"—late-night VOD reviews so sharp they cut ego and leave only truth on the table. No sorcery required; only reflection.",
  },
  "phantom-division": {
    tagline: "Ghosts in the war log.",
    lore:
      "Phantom Division inherits a whisper from the Malay Regiment's night drills—units that moved without lanterns, leaving cut ropes and no footprints, enemies arguing whether the patrol had been real. British war diaries called them \"the division that reports from tomorrow.\" A Singaporean student squad took the name after winning through constant splits and feints that made opponents chase ghosts while objectives fell elsewhere.\n\nThe franchise operationalizes misdirection: pressure that is not presence, wins logged in the silence after failed chases. Casters coined \"phantom win\" for their habit of taking the war when the kill feed lies. They are spec-ops myth translated to sport—discipline wearing illusion. Veterans say their comms sound quiet because the real shout already happened two rotations ago. Young fans nickname them \"the empty helmet\"—present everywhere on the map, nowhere you can pin down.",
  },
  "vanguard": {
    tagline: "First in. Last standing.",
    lore:
      "Vanguard echoes the Varangian forward wedge—Norse guards who stepped first into breaches for Byzantine emperors, paid double because the job was death with style. Sagas praise the vanguard who held a gate alone long enough for hymns to finish; historians note pay records, not miracles. A Warsaw club chose Vanguard after a tournament where their opener died nine times and still created space for a rookie carry to become legend.\n\nThe franchise honors initiation: fearless entry, structured courage, trust that someone must go first so others can write the ending. They are loud in identity, disciplined in execution. Supporters travel to away games when they want bravery that looks professional, not reckless. The squad repeats two words before every road match—first light, last hand—military enough for myth, vague enough for any meta. League history remembers them as the tip that makes blunt drafts feel like spears.",
  },
  "warpath": {
    tagline: "No detours. Only war.",
    lore:
      "Warpath refers to the Plains ceremonial road—not mindless rage, but a chosen route where a nation commits honor, resources, and song before violence begins. Elders taught that a warpath walked without prayer becomes shame; walked with purpose, it becomes memory. A Oklahoma college club mispronounced the tradition once, then learned it, renamed, and won a regional bracket playing straight-line aggression with pre-match silence.\n\nThe franchise keeps that seriousness: early pressure, loud identity, series that feel like campaigns rather than puzzles. They do not flirt with complexity; they announce arrival and dare you to stand in the way. Opponents respect the honesty—Warpath will not trick you, they will meet you on the road. League fans joke that their drafts have drumbeats. The joke lands because watching them feels like hearing hooves from far off, getting closer, not stopping.",
  },
};

async function main() {
  const apply = process.argv.includes("--apply");
  const force = process.argv.includes("--force");

  const { rows } = await pool.query(`SELECT id, slug, name, lore, tagline FROM league_teams ORDER BY name`);
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const copy = FRANCHISE_COPY[row.slug];
    if (!copy) {
      console.warn(`No copy for slug: ${row.slug} (${row.name})`);
      continue;
    }

    const hasLore = String(row.lore || "").trim().length > 0;
    const hasTagline = String(row.tagline || "").trim().length > 0;
    if (!force && hasLore && hasTagline) {
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`[check] ${row.name}: would set tagline + lore`);
      continue;
    }

    await pool.query(
      `UPDATE league_teams SET
        tagline = CASE WHEN $2::boolean OR trim(tagline) = '' THEN $3 ELSE tagline END,
        lore = CASE WHEN $2::boolean OR trim(lore) = '' THEN $4 ELSE lore END,
        updated_at = NOW()
       WHERE id = $1`,
      [row.id, force, copy.tagline, copy.lore],
    );
    updated += 1;
    console.log(`Updated ${row.name}`);
  }

  if (apply) {
    console.log(`Done. updated=${updated}, skipped=${skipped}`);
  } else {
    console.log(`Check complete. ${rows.length} teams, ${Object.keys(FRANCHISE_COPY).length} entries in seed file.`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
