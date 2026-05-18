import { useCallback, useMemo, useRef, useState } from "react";
import { MatchCard } from "./MatchCard.jsx";
import {
  blastQualifierFeederEdges,
  blastQualifierMatchesFeedPlayoffs,
  blastStageRoundColumnCount,
  bracketColumnTitle,
  buildBlastQualifierDisplayColumns,
  compareRoundKeys,
  describeBlastMatchFlow,
  isBlastPlayInCrossMatch,
  matchRoundKey,
  orderLastChanceMatchesForCrossover,
  parseRoundKey,
  playoffUsesPlayInWinners,
  stageRoundStructure,
} from "./bracketLayout.js";
import { useBracketConnectors } from "./useBracketConnectors.js";

function roundColumnSpacingClass(columnIndex) {
  if (columnIndex === 0) return "gap-4 py-0";
  if (columnIndex === 1) return "gap-14 py-12";
  if (columnIndex === 2) return "gap-20 py-16";
  return "gap-28 py-24";
}

/** One row in the elimination canvas (anchor wiring for SVG connectors). */
function MatchCardRow({ match, editable, scores, setScores, submitResult, updateMatch, blastBracketDepths, blastVariant, registerAnchor }) {
  return (
    <div ref={(el) => registerAnchor(match.id, el)} className="relative w-full shrink-0">
      <MatchCard
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
    </div>
  );
}

/**
 * @typedef {object} Props
 * @property {object[]} matches
 * @property {boolean} [editable]
 * @property {Record<string, object>} [scores]
 * @property {function} [setScores]
 * @property {function} [submitResult]
 * @property {function} [updateMatch]
 * @property {object[]} [playoffFeedMatches] — optional blast main QF rows to detect PI→playoff feed
 * @property {"ten"|"twelve"|"tiered_generic"|null} [blastVariant] — inferred BLAST naming path for hover copy
 */

export function EliminationBracketCanvas({
  matches = [],
  editable = false,
  scores = {},
  setScores,
  submitResult,
  updateMatch,
  playoffFeedMatches = null,
  blastVariant = null,
}) {
  const rootRef = useRef(null);
  const anchorsRef = useRef(/** @type {Record<string, HTMLElement | null>} */ ({}));
  const bumpRaf = useRef(0);
  const [anchorTick, setAnchorTick] = useState(0);

  const registerAnchor = useCallback((id, el) => {
    const key = String(id);
    if (el) anchorsRef.current[key] = el;
    else delete anchorsRef.current[key];
    cancelAnimationFrame(bumpRaf.current);
    bumpRaf.current = requestAnimationFrame(() => setAnchorTick((x) => x + 1));
  }, []);

  const blastBracketDepths = useMemo(
    () => ({
      lc: blastStageRoundColumnCount(matches, "blast-lastchance"),
      pi: blastStageRoundColumnCount(matches, "blast-playin"),
    }),
    [matches],
  );

  const { sortedRoundsPairs, columnStructure, tieredQualifierPlayins } = useMemo(() => {
    const rounds = {};
    for (const match of matches) {
      const key = matchRoundKey(match);
      if (!rounds[key]) rounds[key] = [];
      rounds[key].push(match);
    }
    const baselinePairs = Object.entries(rounds)
      .sort(([a], [b]) => compareRoundKeys(a, b))
      .map(([key, list]) => [
        key,
        [...list].sort((a, b) => (a.matchIndex ?? 0) - (b.matchIndex ?? 0)),
      ]);

    const { pairs: builtPairs, tieredComposite, lastLcKey } = buildBlastQualifierDisplayColumns(matches, baselinePairs);

    const crossMatches = tieredComposite
      ? (builtPairs.find(([k]) => k === "blast-qualifiers-playin:0")?.[1] || []).filter(isBlastPlayInCrossMatch)
      : [];

    const pairs = builtPairs.map(([k, list]) => {
      if (tieredComposite && lastLcKey && k === lastLcKey && crossMatches.length) {
        return [k, orderLastChanceMatchesForCrossover(list, crossMatches)];
      }
      return [k, list];
    });

    const baseStruct = stageRoundStructure(matches);
    const struct = tieredComposite ? { ...baseStruct, "blast-qualifiers-playin": [0] } : baseStruct;
    return { sortedRoundsPairs: pairs, columnStructure: struct, tieredQualifierPlayins: tieredComposite };
  }, [matches]);

  const playInMatches = useMemo(() => matches.filter((m) => m.stageKey === "blast-playin"), [matches]);

  const qualifiersToPlayoffs = useMemo(
    () => blastQualifierMatchesFeedPlayoffs(playInMatches, playoffFeedMatches || []),
    [playInMatches, playoffFeedMatches],
  );

  const showOutboundColumn = useMemo(() => {
    const row = playoffFeedMatches || [];
    if (!row.length || !qualifiersToPlayoffs.length) return false;
    return row.some((m) => playoffUsesPlayInWinners(m));
  }, [playoffFeedMatches, qualifiersToPlayoffs.length]);

  const internalEdges = useMemo(
    () => blastQualifierFeederEdges(sortedRoundsPairs, matches),
    [sortedRoundsPairs, matches],
  );

  const outboundEdges = useMemo(() => {
    if (!showOutboundColumn) return [];
    return qualifiersToPlayoffs.map((m) => ({ fromId: m.id, toId: `stub-pi-${m.id}` }));
  }, [showOutboundColumn, qualifiersToPlayoffs]);

  const allEdges = useMemo(() => [...internalEdges, ...outboundEdges], [internalEdges, outboundEdges]);

  const paths = useBracketConnectors(rootRef, allEdges, anchorsRef, anchorTick);

  const baseColumns = sortedRoundsPairs.length + (showOutboundColumn ? 1 : 0);
  const outboundSpacingClass = roundColumnSpacingClass(Math.max(0, baseColumns - 1));

  return (
    <div className="relative w-max min-w-0 max-w-none">
      <div ref={rootRef} className="relative w-max">
        <div className="relative z-[2] flex items-stretch gap-14 xl:gap-[4.5rem]">
          {sortedRoundsPairs.map(([key, roundMatches], ci) => {
            const { stageKey, roundIndex } = parseRoundKey(key);
            const header = bracketColumnTitle(stageKey, roundIndex, columnStructure);
            const spacing = roundColumnSpacingClass(ci);
            const compositePlayin =
              tieredQualifierPlayins && stageKey === "blast-qualifiers-playin";
            const midPackBand =
              compositePlayin
                ? roundMatches.filter((m) => m.stageKey === "blast-playin" && !isBlastPlayInCrossMatch(m))
                : roundMatches;
            const crossoverBand =
              compositePlayin ? roundMatches.filter(isBlastPlayInCrossMatch) : [];

            const rowsCommon = {
              editable,
              scores,
              setScores,
              submitResult,
              updateMatch,
              blastBracketDepths,
              blastVariant,
              registerAnchor,
            };

            return (
              <div key={key} className="flex min-h-0 w-[18rem] shrink-0 flex-col">
                <div className="mb-3 rounded-md border border-border bg-muted/30 px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                  {compositePlayin ? (
                    <div className="space-y-2 normal-case tracking-normal">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                          {blastVariant === "twelve" ? "Middle Play-In knockout" : "Middle Play-In"}
                        </div>
                        <div className="text-[10px] text-muted-foreground/90">
                          {blastVariant === "twelve"
                            ? "Group #3 & #4 finishers · paired A3↔B4, B3↔A4 — two survivors move on"
                            : "Mid-pack knockout feeding crossover rows"}
                        </div>
                      </div>
                      <div className="border-t border-border/70 pt-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                          {blastVariant === "twelve" ? "Cross Play-In (#2 × LC)" : "Crossover"}
                        </div>
                        <div className="text-[10px] text-muted-foreground/90">
                          {blastVariant === "twelve"
                            ? "Each group #2 plays a Last chance finalist — crossover winners hit quarterfinals"
                            : "Crossover survivors feed the playoff bracket"}
                        </div>
                      </div>
                    </div>
                  ) : (
                    header || "Round"
                  )}
                </div>
                <div
                  className={`flex min-h-[120px] flex-1 flex-col ${compositePlayin ? "justify-between gap-6" : "justify-around"} ${spacing}`}
                >
                  {compositePlayin ? (
                    <>
                      <div className="flex flex-1 flex-col justify-around gap-4">
                        {midPackBand.map((match) => (
                          <MatchCardRow key={match.id} match={match} {...rowsCommon} />
                        ))}
                      </div>
                      {crossoverBand.length ? (
                        <div
                          className="shrink-0 border-t border-dashed border-border/80 pt-2 text-center text-[10px] text-muted-foreground"
                          aria-hidden
                        >
                          Crossover
                        </div>
                      ) : null}
                      <div className="flex flex-1 flex-col justify-around gap-4">
                        {crossoverBand.map((match) => (
                          <MatchCardRow key={match.id} match={match} {...rowsCommon} />
                        ))}
                      </div>
                    </>
                  ) : (
                    roundMatches.map((match) => (
                      <MatchCardRow key={match.id} match={match} {...rowsCommon} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          {showOutboundColumn ? (
            <div className="flex min-h-0 w-[18rem] shrink-0 flex-col">
              <div className="mb-3 rounded-md border border-border bg-muted/30 px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                To playoffs
              </div>
              <div className={`flex min-h-[120px] flex-1 flex-col justify-around ${outboundSpacingClass}`}>
                {qualifiersToPlayoffs.map((m) => {
                  const tok = String(m.meta?.winToken ?? "");
                  const midPath =
                    !isBlastPlayInCrossMatch(m) &&
                    (tok.startsWith("PIR") || tok.startsWith("MID_R") || tok.startsWith("PIN_R") || tok.startsWith("MP") || tok.startsWith("PI"));
                  const detail =
                    blastVariant === "twelve"
                      ? midPath
                        ? "Middle Play-In survivor → QF (cross-fed)"
                        : "Cross Play-In survivor (#2×LC) → QF"
                      : midPath
                        ? "Play-In finalist"
                        : "Crossover finalist";
                  return (
                    <div
                      key={`stub-pi-${m.id}`}
                      ref={(el) => registerAnchor(`stub-pi-${m.id}`, el)}
                      className="relative shrink-0 rounded-lg border border-dashed border-border/80 bg-background/60 px-3 py-6 text-sm text-muted-foreground shadow-sm backdrop-blur-[1px]"
                      title={describeBlastMatchFlow(m, blastVariant) || undefined}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/90">Advances</div>
                      <div className="mt-1 truncate" title={m.meta?.winToken}>
                        {detail} · R{(m.roundIndex ?? 0) + 1} · M{Number(m.matchIndex ?? 0) + 1}
                      </div>
                      {m.meta?.winToken ? (
                        <div className="mt-1 font-mono text-[10px] tracking-tight text-muted-foreground">{m.meta.winToken}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <svg
          className="pointer-events-none absolute inset-0 z-[1] overflow-visible"
          width="100%"
          height="100%"
          aria-hidden
        >
          {paths.map(({ d }, idx) => (
            <path key={idx} d={d} fill="none" className="stroke-foreground/45" strokeWidth={2} />
          ))}
        </svg>
      </div>
    </div>
  );
}
