import { useMemo } from "react";
import { MatchCard } from "./bracket/MatchCard.jsx";
import {
  bracketColumnTitle,
  compareRoundKeys,
  matchRoundKey,
  parseRoundKey,
  stageRoundStructure,
} from "./bracket/bracketLayout.js";

export function BracketDiagram({ matches = [], editable = false, scores = {}, setScores, submitResult, updateMatch }) {
  const columnStructure = useMemo(() => stageRoundStructure(matches), [matches]);
  const rounds = matches.reduce((acc, match) => {
    const key = matchRoundKey(match);
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {});
  const sortedRounds = Object.entries(rounds).sort(([a], [b]) => compareRoundKeys(a, b));

  if (!matches.length) {
    return (
      <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
        No matches generated yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background p-4">
      <div className="flex min-w-max gap-6 xl:min-w-0">
        {sortedRounds.map(([key, roundMatches]) => {
          const { stageKey, roundIndex } = parseRoundKey(key);
          const header = bracketColumnTitle(stageKey, roundIndex, columnStructure);

          return (
            <div key={key} className="flex w-72 flex-col gap-4 xl:flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{header}</div>
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
