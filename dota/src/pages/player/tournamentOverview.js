import {
  canJoinSubstitutePool,
  formatEntryFee,
  formatPrizePool,
  formatRegistrationSlots,
  isTournamentInSeasonWindow,
} from "./tournamentDisplay.js";

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function getTournamentState(tournament, account) {
  const status = (tournament.registrationStatus || "").toLowerCase();
  const substituteAvailable = canJoinSubstitutePool(tournament, account);

  if (status === "approved") {
    return { key: "registered", label: "Registered", tone: "success" };
  }
  if (status === "pending") {
    return { key: "pending", label: "Awaiting approval", tone: "warm" };
  }
  if (status === "rejected" && substituteAvailable) {
    return { key: "substitute", label: "Substitute pool open", tone: "secondary" };
  }
  if (status === "rejected") {
    return { key: "rejected", label: "Not approved", tone: "danger" };
  }
  if (status) {
    return { key: "in-progress", label: status, tone: "warm" };
  }
  if (tournament.registrationsOpen && account?.eligibleForRegistration) {
    return { key: "open", label: "Registrations open", tone: "open" };
  }
  if (tournament.registrationsOpen) {
    return { key: "locked", label: "Open — linkage required", tone: "locked" };
  }
  if (substituteAvailable || tournament.substitutePoolOpen) {
    return { key: "substitute", label: "Substitute pool open", tone: "secondary" };
  }
  if (isTournamentInSeasonWindow(tournament)) {
    return { key: "active", label: "Season in progress", tone: "muted" };
  }
  return { key: "closed", label: "Registration closed", tone: "muted" };
}

export { formatDate, formatEntryFee, formatPrizePool, formatRegistrationSlots };
