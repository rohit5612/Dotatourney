/**
 * Landing page "Core Team" roster (static v1).
 *
 * Rules:
 * - Ship 8–10 members (CORE_TEAM_MIN … CORE_TEAM_MAX).
 * - avatarUrl: direct image URL (Steam CDN or file under /public/images/core-team/).
 * - gamerTag, realName: required. role: optional label (Organizer, Admin, Caster, etc.).
 */

export const CORE_TEAM_MIN = 8;
export const CORE_TEAM_MAX = 10;

export const CORE_TEAM_SECTION = {
  eyebrow: "Behind the circuit",
  title: "Core Team",
  subtitle: "The people running BPC League.",
};

/** @typedef {{ id: string; gamerTag: string; realName: string; role?: string; avatarUrl: string }} CoreTeamMember */

/** @type {CoreTeamMember[]} */
export const CORE_TEAM_MEMBERS = [
  {
    id: "core-1",
    gamerTag: "AddicTzZ",
    realName: "Rohit Negi",
    role: "Chief Technical Officer",
    avatarUrl: "https://avatars.fastly.steamstatic.com/452fe4e6dc20cca18b813015c09905163af9eada_full.jpg",
  },
  {
    id: "core-2",
    gamerTag: "RagnaR",
    realName: "Mayank Saini",
    role: "Director of Strategy & Art",
    avatarUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/1091500/d3ca470b90fe64e5203af68b5238e99665b05e2f.gif",
  },
  {
    id: "core-3",
    gamerTag: "Rengoku -M-",
    realName: "Anirudh Gupta",
    role: "Chief Operating Officer",
    avatarUrl: "https://avatars.fastly.steamstatic.com/0d66c1967d928672d2b7f8ff01d706393120ec2c_full.jpg",
  },
  {
    id: "core-4",
    gamerTag: "Mind_Flay3r",
    realName: "Mohit Rathore",
    role: "Marketing Director",
    avatarUrl: "https://avatars.fastly.steamstatic.com/076800a63f9a5e17d4f40d6fc87db25450434a64_full.jpg",
  },
  {
    id: "core-5",
    gamerTag: "L!NU$. 4 ^ JpR",
    realName: "Sunil Naval",
    role: "Senior Designer",
    avatarUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/620/9b150c165611e0f04ac9edb860656d7e67d56fbe.gif",
  },
  {
    id: "core-6",
    gamerTag: "alferno...",
    realName: "Krishan K. Yadav",
    role: "Strategy Execution Manager",
    avatarUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/2055050/c59f1f3beafa934af92b51dcd0521298600239fb.gif",
  },
  {
    id: "core-7",
    gamerTag: "4Pos5",
    realName: "Siddharth Goyal",
    role: "Strategy Analyst",
    avatarUrl: "https://avatars.fastly.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
  },
  {
    id: "core-8",
    gamerTag: "JaamVant",
    realName: "Ashray Jayant",
    role: "Risk Manager",
    avatarUrl: "https://shared.fastly.steamstatic.com/community_assets/images/items/546560/35f54268b2e255954d79ebbb6ef5321b0abc0e4c.gif",
  },
  {
    id: "core-9",
    gamerTag: "Agent Chandi",
    realName: "Kush Rawat",
    role: "Supply Manager",
    avatarUrl: "https://avatars.fastly.steamstatic.com/626772a6e57101a76dac9fd9d6bd8789ad66da9a_full.jpg",
  },

];

function isValidMember(row) {
  if (!row || typeof row !== "object") return false;
  const gamerTag = String(row.gamerTag ?? "").trim();
  const realName = String(row.realName ?? "").trim();
  const avatarUrl = String(row.avatarUrl ?? "").trim();
  const id = String(row.id ?? "").trim();
  return Boolean(id && gamerTag && realName && avatarUrl);
}

let rosterWarned = false;

/**
 * @returns {CoreTeamMember[]}
 */
export function getCoreTeamForDisplay() {
  const list = CORE_TEAM_MEMBERS.filter(isValidMember);

  if (import.meta.env?.DEV && !rosterWarned) {
    rosterWarned = true;
    if (list.length < CORE_TEAM_MIN) {
      console.warn(
        `[coreTeam] ${list.length} valid member(s); need at least ${CORE_TEAM_MIN} to show the Core Team section.`,
      );
    }
    if (CORE_TEAM_MEMBERS.length > CORE_TEAM_MAX) {
      console.warn(`[coreTeam] Config has ${CORE_TEAM_MEMBERS.length} entries; only the first ${CORE_TEAM_MAX} are shown.`);
    }
  }

  if (list.length < CORE_TEAM_MIN) return [];
  return list.slice(0, CORE_TEAM_MAX);
}
