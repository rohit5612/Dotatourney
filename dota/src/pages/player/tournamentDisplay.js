/**
 * Cosmetic tournament display helpers for the player dashboard.
 * Substitute eligibility and registration caps will be driven by admin routes later.
 */

export function isTournamentInSeasonWindow(tournament) {
  if (!tournament?.startDate || !tournament?.endDate) return false;
  const now = Date.now();
  const start = new Date(tournament.startDate).getTime();
  const end = new Date(tournament.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

/** @returns {boolean|null} null = limit not configured yet (admin) */
export function isRegistrationLimitFilled(tournament) {
  const limit = tournament?.registrationLimit;
  const count = tournament?.registrationCount ?? 0;
  if (limit == null || limit <= 0) {
    // Temporary stand-in until admin sets registrationLimit on the tournament.
    return tournament?.registrationsOpen === false ? true : null;
  }
  return count >= limit;
}

/**
 * Substitute pool: active season window + roster cap reached.
 * Full rules ship with admin tournament engine.
 */
export function canJoinSubstitutePool(tournament, account) {
  if (!account?.eligibleForRegistration) return false;
  if (!isTournamentInSeasonWindow(tournament)) return false;
  const limitFilled = isRegistrationLimitFilled(tournament);
  return limitFilled === true;
}

export function formatEntryFee(tournament) {
  if (tournament?.entryFeeLabel) return tournament.entryFeeLabel;
  if (tournament?.entryFee != null) return `₹${tournament.entryFee}`;
  return "TBA";
}

export function formatPrizePool(tournament) {
  const raw = String(tournament?.prizePool || "").trim();
  return raw || "TBA";
}

export function formatRegistrationSlots(tournament) {
  const count = tournament?.registrationCount ?? 0;
  const limit = tournament?.registrationLimit;
  if (limit == null || limit <= 0) return `${count} registered`;
  return `${count} / ${limit} filled`;
}
