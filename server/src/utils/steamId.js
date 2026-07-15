const STEAM_ID64_BASE = 76561197960265728n;

/** Steam account_id (steam32) from a Steam64 ID string. */
export function steam64ToSteam32(steam64) {
  const raw = String(steam64 || "").trim();
  if (!/^\d{17}$/.test(raw)) return null;
  try {
    const id = BigInt(raw);
    if (id < STEAM_ID64_BASE) return null;
    const steam32 = id - STEAM_ID64_BASE;
    if (steam32 <= 0n) return null;
    return Number(steam32);
  } catch {
    return null;
  }
}
