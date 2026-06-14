import { updatePlayerAccount } from "../services/playerAccountRepository.js";

const DEMO_EMAIL_RE = /^demo\.access0?([1-9])@bpcl\.test$/i;

const DEMO_ROLE_SETS = [
  ["Carry"],
  ["Mid"],
  ["Offlane"],
  ["Soft support"],
  ["Hard support"],
];

export function isDemoAccessAccount(accountOrEmail) {
  const email =
    typeof accountOrEmail === "string" ? accountOrEmail : accountOrEmail?.email;
  return DEMO_EMAIL_RE.test(String(email || "").trim().toLowerCase());
}

export function demoAccessSlot(accountOrEmail) {
  const email =
    typeof accountOrEmail === "string" ? accountOrEmail : accountOrEmail?.email;
  const match = String(email || "")
    .trim()
    .toLowerCase()
    .match(DEMO_EMAIL_RE);
  return match ? Number(match[1]) : null;
}

function demoProfileDefaults(account, slot) {
  const n = slot;
  const roles = Array.isArray(account.preferred_roles) ? account.preferred_roles : [];
  return {
    steamPersona: account.steam_persona || `DemoSteam_${n}`,
    steamProfile:
      account.steam_profile || `https://steamcommunity.com/id/demo-access-${String(n).padStart(2, "0")}`,
    steamAvatarUrl: account.steam_avatar_url || "",
    discordUsername: account.discord_username || `demo_discord_${n}`,
    mmr: account.mmr ?? 4200 + (n - 1) * 150,
    preferredRoles: roles.length ? roles : DEMO_ROLE_SETS[(n - 1) % DEMO_ROLE_SETS.length],
    location: account.location || "Demo City, IN",
    phoneNumber: account.phone_number || `+91 98765${String(43200 + n).slice(-5)}`,
  };
}

/** API-facing overrides — linkage bypass + prefilled profile for demo logins. */
export function demoAccessDisplayOverrides(account) {
  const slot = demoAccessSlot(account);
  if (!slot) return null;
  const defaults = demoProfileDefaults(account, slot);
  return {
    ...defaults,
    emailVerified: true,
    steamLinked: true,
    discordLinked: true,
    eligibleForRegistration: true,
    isDemoAccess: true,
  };
}

export function buildDemoAccessPatch(account) {
  if (!isDemoAccessAccount(account)) return null;
  const slot = demoAccessSlot(account);
  if (!slot) return null;

  const patch = {};
  if (!account.email_verified_at) {
    patch.emailVerifiedAt = new Date().toISOString();
  }
  if (!account.steam_id) {
    patch.steamId = `7656119899${String(slot).padStart(7, "0")}`;
    patch.steamPersona = account.steam_persona || `DemoSteam_${slot}`;
    patch.steamProfile =
      account.steam_profile ||
      `https://steamcommunity.com/id/demo-access-${String(slot).padStart(2, "0")}`;
  }
  if (!account.discord_id) {
    patch.discordId = `9000000000${String(10000 + slot)}`;
    patch.discordUsername = account.discord_username || `demo_discord_${slot}`;
  }
  if (account.mmr == null) {
    patch.mmr = 4200 + (slot - 1) * 150;
  }
  const roles = Array.isArray(account.preferred_roles) ? account.preferred_roles : [];
  if (!roles.length) {
    patch.preferredRoles = DEMO_ROLE_SETS[(slot - 1) % DEMO_ROLE_SETS.length];
  }
  if (!account.location) {
    patch.location = "Demo City, IN";
  }
  if (!account.phone_number) {
    patch.phoneNumber = `+91 98765${String(43200 + slot).slice(-5)}`;
  }
  if (!account.profile_completed_at) {
    patch.profileCompletedAt = new Date().toISOString();
  }

  return Object.keys(patch).length ? patch : null;
}

export async function ensureDemoAccessAccountReady(account) {
  if (!isDemoAccessAccount(account)) return account;
  const patch = buildDemoAccessPatch(account);
  if (!patch) return account;
  const updated = await updatePlayerAccount(account.id, patch);
  return updated || account;
}
