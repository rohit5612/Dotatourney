/**
 * Tournament display + substitute eligibility for the player dashboard.
 */

export function isTournamentInSeasonWindow(tournament) {
  if (!tournament?.startDate || !tournament?.endDate) return false;
  const now = Date.now();
  const start = new Date(tournament.startDate).getTime();
  const end = new Date(tournament.endDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now <= end;
}

/** @returns {boolean|null} null = cap not configured */
export function isRegistrationLimitFilled(tournament) {
  if (tournament?.substitutePoolOpen) return true;
  const limit = tournament?.registrationLimit;
  const count = tournament?.registrationCount ?? 0;
  if (limit == null || limit <= 0) {
    return tournament?.registrationsOpen === false ? true : null;
  }
  return count >= limit;
}

/**
 * Substitute pool: roster cap reached and main registration closed.
 */
export function canJoinSubstitutePool(tournament, account) {
  if (!account?.eligibleForRegistration) return false;
  if (tournament?.substitutePoolOpen) return true;
  const limitFilled = isRegistrationLimitFilled(tournament);
  return limitFilled === true && tournament?.registrationsOpen !== true;
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
