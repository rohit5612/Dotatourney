/** Custom admin upload wins over card JSON portrait, then Steam. */
export function resolveAccountAvatarUrl(account) {
  if (!account) return "";
  return String(account.avatarUrl || account.steamAvatarUrl || "").trim();
}

export function resolveCardPortraitUrl(manifest) {
  if (!manifest) return "";

  const payload = manifest.cardPayload || {};
  const customAvatar = String(manifest.customAvatarUrl || "").trim();
  const payloadAvatar = String(payload.avatarUrl || "").trim();
  const accountAvatar = String(manifest.avatarUrl || manifest.steamAvatar || "").trim();

  if (customAvatar) return customAvatar;
  if (payloadAvatar) return payloadAvatar;
  return accountAvatar;
}
