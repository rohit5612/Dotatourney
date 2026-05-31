import { SITE_BRAND_LINE } from "../constants/siteMeta.js";

export function honorsSeasonTitle(tournament) {
  const name = String(tournament?.name || "").trim();
  return name || SITE_BRAND_LINE;
}

export function honorBadgeClass(kind) {
  switch (kind) {
    case "champion":
      return "honor-badge honor-badge--champion";
    case "runner_up":
      return "honor-badge honor-badge--runner-up";
    case "in_final":
    case "in_semifinals":
    case "in_quarterfinals":
    case "in_play_in":
    case "in_last_chance":
      return "honor-badge honor-badge--live";
    case "semifinalist":
      return "honor-badge honor-badge--semifinalist";
    case "quarterfinalist":
      return "honor-badge honor-badge--quarterfinalist";
    default:
      return "honor-badge";
  }
}

export function winnerCardVariant(placement) {
  if (placement === 1) return "champion";
  if (placement === 2) return "runner-up";
  if (placement === 3) return "third";
  return "finalist";
}

export function normalizeHonorsAdmin(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { displayPodiumCount: 2, mvp: null, customCards: [] };
  }

  const displayPodiumCount = Math.max(1, Math.min(12, Number(value.displayPodiumCount) || 2));
  const mvpRaw = value.mvp && typeof value.mvp === "object" ? value.mvp : null;
  const mvp = mvpRaw
    ? {
        prize: String(mvpRaw.prize || "").trim(),
        teamName: String(mvpRaw.teamName || "").trim(),
        playerId: String(mvpRaw.playerId || "").trim(),
        playerName: String(mvpRaw.playerName || "").trim(),
        notes: String(mvpRaw.notes || "").trim(),
      }
    : null;

  const cards = Array.isArray(value.customCards) ? value.customCards : [];
  return {
    displayPodiumCount,
    mvp: mvp?.teamName || mvp?.playerName || mvp?.playerId || mvp?.prize ? mvp : null,
    customCards: cards.map((card, index) => ({
      id: String(card?.id || `card-${index}`),
      title: String(card?.title || "").trim(),
      prize: String(card?.prize || "").trim(),
      winnerLabel: String(card?.winnerLabel || "").trim(),
      teamName: String(card?.teamName || "").trim(),
      playerName: String(card?.playerName || "").trim(),
      notes: String(card?.notes || "").trim(),
      sortOrder: Number.isFinite(Number(card?.sortOrder)) ? Number(card.sortOrder) : index,
    })),
  };
}

export function honorsToApiPayload(honors) {
  const normalized = normalizeHonorsAdmin(honors);
  return {
    displayPodiumCount: normalized.displayPodiumCount,
    mvp: normalized.mvp,
    customCards: normalized.customCards
      .filter((card) => card.title || card.prize || card.winnerLabel || card.teamName || card.playerName)
      .map((card, index) => ({ ...card, sortOrder: index })),
  };
}

export function hasPublicHonorsContent(honors) {
  if (!honors) return false;
  if (honors.podiumTeams?.length) return true;
  if (honors.mvp?.teamName || honors.mvp?.playerName) return true;
  if (honors.customCards?.length) return true;
  if (honors.champion?.teamName) return true;
  return false;
}

export function resolveMvpPlayer(teams, mvp) {
  if (!mvp) return null;
  const team = (teams || []).find((entry) => String(entry.name || "") === mvp.teamName);
  if (!team?.players?.length) {
    return mvp.playerName
      ? { name: mvp.playerName, displayName: mvp.playerName, teamName: mvp.teamName }
      : null;
  }
  const byId = mvp.playerId ? team.players.find((player) => String(player.id) === mvp.playerId) : null;
  const byName = mvp.playerName
    ? team.players.find((player) => {
        const label = String(player.displayName || player.display_name || player.name || "").trim();
        return label === mvp.playerName;
      })
    : null;
  return byId || byName || null;
}

export function podiumTeamNames(honors) {
  return new Set((honors?.podiumTeams || []).map((entry) => entry.teamName).filter(Boolean));
}
