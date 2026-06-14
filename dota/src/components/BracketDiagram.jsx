import { useMemo } from "react";
import { EliminationBracketCanvas } from "./bracket/EliminationBracketCanvas.jsx";
import { MatchCard } from "./bracket/MatchCard.jsx";
import {
  blastStageRoundColumnCount,
  bracketColumnTitle,
  compareRoundKeys,
  inferBlastBracketVariant,
  isRoundRobinStyleStage,
  matchRoundKey,
  parseRoundKey,
  stageRoundStructure,
} from "./bracket/bracketLayout.js";

export function BracketDiagram({
  matches = [],
  editable = false,
  scores = {},
  setScores,
  submitResult,
  updateMatch,
  playoffFeedMatches = null,
  /** Full tournament matches (used so Playoffs-only tabs still infer BLAST 10 vs 12 tooltips). */
  blastSeedMatches = null,
  /** `glass` — frosted public shell on bracket & schedule pages */
  appearance = "default",
}) {
  const shellClass =
    appearance === "glass"
      ? "schedule-bracket-shell"
      : "overflow-x-auto rounded-lg border border-border bg-background p-4 pb-6";
  const columnStructure = useMemo(() => stageRoundStructure(matches), [matches]);

  const blastVariant = useMemo(
    () => inferBlastBracketVariant((blastSeedMatches?.length ? blastSeedMatches : matches) || []),
    [blastSeedMatches, matches],
  );

  const blastBracketDepths = useMemo(
    () => ({
      lc: blastStageRoundColumnCount(matches, "blast-lastchance"),
      pi: blastStageRoundColumnCount(matches, "blast-playin"),
    }),
    [matches],
  );

  const rounds = matches.reduce((acc, match) => {
    const key = matchRoundKey(match);
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
  const sortedRounds = Object.entries(rounds).sort(([a], [b]) => compareRoundKeys(a, b));

  const useRoundRobinListLayout = useMemo(
    () => matches.length > 0 && matches.every((match) => isRoundRobinStyleStage(match.stageKey)),
    [matches],
  );

  if (!matches.length) {
    return (
      <div
        className={
          appearance === "glass"
            ? "schedule-bracket-shell schedule-bracket-shell--empty"
            : "rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground"
        }
      >
        No matches generated yet.
      </div>
    );
  }

  if (!useRoundRobinListLayout) {
    return (
      <div className={shellClass}>
        <EliminationBracketCanvas
          matches={matches}
          editable={editable}
          scores={scores}
          setScores={setScores}
          submitResult={submitResult}
          updateMatch={updateMatch}
          playoffFeedMatches={playoffFeedMatches || undefined}
          blastVariant={blastVariant}
        />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="schedule-bracket-shell__columns flex min-w-max gap-6 xl:min-w-0">
        {sortedRounds.map(([key, roundMatches]) => {
          const { stageKey, roundIndex } = parseRoundKey(key);
          const header = bracketColumnTitle(stageKey, roundIndex, columnStructure);

          return (
            <div key={key} className="schedule-bracket-shell__column flex w-72 flex-col gap-4 xl:flex-1">
              <div className="schedule-bracket-shell__round-label">{header}</div>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {roundMatches
                  .sort((a, b) => a.matchIndex - b.matchIndex)
                  .map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      editable={editable}
                      scoreDraft={scores[match.id] || {}}
                      setScoreDraft={(patch) =>
                        setScores?.((prev) => ({
                          ...prev,
                          [match.id]: {
                            ...(prev[match.id] || {}),
                            ...patch,
                          },
                        }))
                      }
                      clearMatchDraft={(matchId) =>
                        setScores?.((prev) => {
                          if (!prev?.[matchId]) return prev;
                          const next = { ...prev };
                          delete next[matchId];
                          return next;
                        })
                      }
                      submitResult={submitResult}
                      updateMatch={updateMatch}
                      blastBracketDepths={blastBracketDepths}
                      blastVariant={blastVariant}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
