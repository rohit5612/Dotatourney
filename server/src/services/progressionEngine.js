const TEAM_TOKEN_REGEX = /^[A-Z0-9_]+$/;

export function applyProgression(matches, changedMatch) {
  if (!changedMatch?.winner || !changedMatch.meta?.winToken) {
    return matches;
  }

  const loser = changedMatch.winner === changedMatch.team1 ? changedMatch.team2 : changedMatch.team1;
  const winnerToken = changedMatch.meta.winToken;
  const loserToken = winnerToken.replace(/W$/, "L");

  return matches.map((match) => {
    const next = { ...match };

    if (TEAM_TOKEN_REGEX.test(next.team1) && next.team1 === winnerToken) {
      next.team1 = changedMatch.winner;
    }
    if (TEAM_TOKEN_REGEX.test(next.team2) && next.team2 === winnerToken) {
      next.team2 = changedMatch.winner;
    }
    if (TEAM_TOKEN_REGEX.test(next.team1) && next.team1 === loserToken) {
      next.team1 = loser;
    }
    if (TEAM_TOKEN_REGEX.test(next.team2) && next.team2 === loserToken) {
      next.team2 = loser;
    }
    return next;
  });
}
