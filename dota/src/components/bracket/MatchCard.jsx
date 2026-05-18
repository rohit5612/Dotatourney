import { useState } from "react";
import {
  blastTokenRoundClause,
  describeBlastGroupSeedPlaceholder,
  describeBlastMatchFlow,
} from "./bracketLayout.js";
import { datetimeLocalToIso, toDatetimeLocalValue } from "../../utils/datetime.js";

/** 1-based round index from bracket win-token prefixes → Quarterfinals / Semifinals / Finals when applicable */
function bracketTokenRoundLabel(roundStr) {
  const r = Number(roundStr);
  if (!Number.isFinite(r) || r < 1) return `round ${roundStr}`;
  if (r === 1) return "Quarterfinals";
  if (r === 2) return "Semifinals";
  if (r === 3) return "Finals";
  return `Round ${r}`;
}

export function describeBracketToken(value, blastBracketDepths, blastVariant = null) {
  const text = String(value || "").trim();
  if (!text) return "";

  const lcDepth = Number(blastBracketDepths?.lc) > 0 ? Number(blastBracketDepths.lc) : 0;
  const piDepth = Number(blastBracketDepths?.pi) > 0 ? Number(blastBracketDepths.pi) : 0;

  const upperMatch = text.match(/^U(\d+)M(\d+)([WL])$/);
  if (upperMatch) {
    return `${upperMatch[3] === "W" ? "Winner" : "Loser"} of Upper bracket ${bracketTokenRoundLabel(upperMatch[1])}, match ${upperMatch[2]}.`;
  }

  const lowerMatch = text.match(/^L(\d+)M(\d+)([WL])$/);
  if (lowerMatch) {
    return `${lowerMatch[3] === "W" ? "Winner" : "Loser"} of Lower bracket ${bracketTokenRoundLabel(lowerMatch[1])}, match ${lowerMatch[2]}.`;
  }

  const roundMatch = text.match(/^R(\d+)M(\d+)([WL])$/);
  if (roundMatch) {
    return `${roundMatch[3] === "W" ? "Winner" : "Loser"} of ${bracketTokenRoundLabel(roundMatch[1])}, match ${roundMatch[2]}.`;
  }

  const blastReadable = text.match(/^(LCR|PIR|QFR|SFR)(\d+)M(\d+)([WL])$/);
  if (blastReadable) {
    const role = blastReadable[4] === "W" ? "Winner" : "Loser";
    const kind = blastReadable[1];
    const round = blastReadable[2];
    const matchNum = blastReadable[3];
    const rn = Number(round);
    const labels = {
      LCR: "Last chance",
      PIR: "Play-In",
      QFR: "Quarterfinal",
      SFR: "Semifinal",
    };

    if (blastVariant === "twelve") {
      if (kind === "LCR") {
        return `${role} of Last chance (#5/#6 band), round ${round}, match ${matchNum} — finalist meets a Group #2 in crossover.`;
      }
      if (kind === "PIR" && rn === 1) {
        return `${role} of Middle Play-In (#3/#4 knockout · A3↔B4, B3↔A4), round ${round}, match ${matchNum} — finalist feeds quarterfinal cross-seeding.`;
      }
      if (kind === "PIR" && rn >= 2) {
        return `${role} of Cross Play-In (#2 vs LC finalist), round ${round}, match ${matchNum} — advances to championship quarterfinal.`;
      }
      if (kind === "QFR") {
        return `${role} of Championship quarterfinal, match ${matchNum} — winner faces Group BO1 champion in semifinal.`;
      }
      if (kind === "SFR") {
        return `${role} of Semifinal, match ${matchNum} — winner plays BLAST final.`;
      }
    }

    if (blastVariant === "ten") {
      if (kind === "LCR") {
        return `${role} of Last chance (#4/#5 band), round ${round}, match ${matchNum} — finalist joins 4-team Play-In with both #3 seeds.`;
      }
      if (kind === "PIR") {
        return `${role} of Play-In (Group #3 + LC mix), round ${round}, match ${matchNum} — finalist faces paired Group #2 in quarterfinal.`;
      }
      if (kind === "QFR") {
        return `${role} of Championship quarterfinal, match ${matchNum} — winner challenges Group champion in semifinal.`;
      }
      if (kind === "SFR") {
        return `${role} of Semifinal, match ${matchNum} — punches BLAST final ticket.`;
      }
    }

    return `${role} of ${labels[kind] ?? kind}, round ${round}, match ${matchNum} — next bracket slot.`;
  }

  const blastReadableLegacy = text.match(/^(LCH_R|PIN_R|MID_R|CRS_R|MAIN_R)(\d+)M(\d+)([WL])$/);
  if (blastReadableLegacy) {
    const role = blastReadableLegacy[4] === "W" ? "Winner" : "Loser";
    const kind = blastReadableLegacy[1];
    const round = blastReadableLegacy[2];
    const matchNum = blastReadableLegacy[3];
    const labels = {
      LCH_R: "Last chance",
      PIN_R: "Play-In",
      MID_R: "Middle Play-In knockout",
      CRS_R: "Play-In crossover",
      MAIN_R: "Main playoffs",
    };
    return `${role} of ${labels[kind] ?? kind}, round ${round}, match ${matchNum} — next bracket slot.`;
  }

  const blastElim = text.match(/^(PI|LC|MP|XP|BPO)(\d+)M(\d+)([WL])$/);
  if (blastElim) {
    const role = blastElim[4] === "W" ? "Winner" : "Loser";
    const tag = blastElim[1];
    const wiRound = blastElim[2];
    const matchNum = blastElim[3];
    if (tag === "LC") {
      const depth = lcDepth || Number(wiRound) || 1;
      const clause = blastTokenRoundClause("lc", wiRound, depth);
      return `${role} of ${clause}, match ${matchNum} — feeds the next slot on the Last chance / Play-In path.`;
    }
    if (tag === "PI" || tag === "MP" || tag === "XP") {
      const depth = piDepth || Number(wiRound) || 1;
      const clause = blastTokenRoundClause("pi", wiRound, depth);
      const path =
        tag === "MP"
          ? "middle Play-In knockout (merged middle band)"
          : tag === "XP"
            ? "cross Play-In (group entrant vs Last chance finalist)"
            : "Play-In path";
      return `${role} of ${clause}, match ${matchNum} — feeds the next slot on the ${path}.`;
    }
    return `${role} of BLAST main playoffs, ${bracketTokenRoundLabel(wiRound)}, match ${matchNum} — feeds the next main-bracket slot.`;
  }

  const gslSlot = text.match(/^G([A-Z])(\d)$/);
  if (gslSlot) return `Group ${gslSlot[1]} seed #${gslSlot[2]} after group matches.`;

  const leagueSlot = text.match(/^League #(\d+)$/);
  if (leagueSlot) return `League standings seed #${leagueSlot[1]} after round robin matches.`;

  const swissSlot = text.match(/^Swiss #(\d+)$/);
  if (swissSlot) return `Swiss standings seed #${swissSlot[1]} after Swiss rounds.`;

  const groupSlotBlast = text.match(/^Group ([A-Z]) #(\d+)$/);
  if (groupSlotBlast) {
    const blurb =
      blastVariant === "twelve" || blastVariant === "ten"
        ? describeBlastGroupSeedPlaceholder(text, blastVariant)
        : null;
    if (blurb) return blurb;
    return `Group ${groupSlotBlast[1]} seed #${groupSlotBlast[2]} after group-stage standings.`;
  }

  const bpi = text.match(/^BPI(\d+)$/);
  if (bpi)
    return `Play-In entrant #${bpi[1]}. After every group BO1 resolves, the remainder pool (outside direct main-path seeds) ranks by wins and Neustadtl; the strongest remaining slices become BPI1… in order into the Play-In bracket.`;
  const blc = text.match(/^BLC(\d+)$/);
  if (blc)
    return `Last chance entrant #${blc[1]}. After groups, the next-worst remainder slices become BLC1…; they contest the Last chance mini-bracket before the fixed number of advancers join the Play-In field.`;

  const blr = text.match(/^BLR([1-4])$/);
  if (blr) {
    const i = blr[1];
    if (i === "1" || i === "2")
      return `Overall #${i} after merging both BO1 groups (wins, Neustadtl, tie-breakers). Semifinal seed — enters the title bracket once quarterfinals finish (11+ tiered BLAST).`;
    return `Overall #${i} after merging both groups — crossover slot vs a Last chance finalist for a title quarterfinal berth (11+ tiered BLAST).`;
  }
  const mid = text.match(/^MID(\d+)$/);
  if (mid)
    return `Middle standings band entrant #${mid[1]} from merged rankings (between the semifinal seeds, crossover seeds, and the Last chance band). Knockout survivor feeds title quarterfinals (11+ tiered BLAST).`;

  const namedSlots = {
    UBW: "Upper bracket winner.",
    UBL: "Upper bracket final loser.",
    LBW: "Lower bracket winner.",
    HUF: "Hybrid upper final winner.",
    HLF: "Hybrid lower final winner.",
    CHAMPION: "Tournament champion slot.",
  };
  if (namedSlots[text]) return namedSlots[text];

  if (/^[A-Z0-9_]+$/.test(text))
    return "Bracket placeholder: resolves when earlier matches finish, or when groups finish (BLAST). Hover team names for slot details.";
  return "";
}

function splitMetaScore(meta) {
  const raw = meta?.score;
  if (!raw || typeof raw !== "string") return null;
  const parts = raw.split("-").map((p) => p.trim());
  if (parts.length < 2 || parts.some((p) => p === "")) return null;
  return { a: parts[0], b: parts[1] };
}

function baseSideScore(match, split, side) {
  if (side === 1) {
    if (match.meta?.team1Score != null && match.meta.team1Score !== "") return String(match.meta.team1Score);
    return split?.a ?? "";
  }
  if (match.meta?.team2Score != null && match.meta.team2Score !== "") return String(match.meta.team2Score);
  return split?.b ?? "";
}

function scoreLineValue(scoreDraft, key, base, isEditing) {
  if (!isEditing) return base;
  if (scoreDraft && Object.prototype.hasOwnProperty.call(scoreDraft, key)) return String(scoreDraft[key] ?? "");
  return base;
}

export function TeamLine({ name, winner, editable, score, onScoreChange, onWin, blastBracketDepths, blastVariant }) {
  const tokenHelp = describeBracketToken(name, blastBracketDepths, blastVariant);
  return (
    <div
      className={`mt-1 flex items-center gap-2 rounded-md border px-2 py-1 text-sm ${winner ? "border-primary bg-primary/10 text-primary" : "border-border bg-background"}`}
      title={tokenHelp || undefined}
    >
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {tokenHelp ? (
        <span
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-border text-[10px] text-muted-foreground"
          title={`${name}: ${tokenHelp}`}
          aria-label={`${name}: ${tokenHelp}`}
        >
          ?
        </span>
      ) : null}
      {editable ? (
        <>
          <input
            className="w-12 rounded border border-input bg-card px-1 py-0.5 text-center text-xs"
            type="number"
            min="0"
            value={score}
            onChange={(event) => onScoreChange?.(event.target.value)}
          />
          <button type="button" className="btn btn-outline btn-xs" onClick={onWin}>
            Win
          </button>
        </>
      ) : (
        <span
          className={`ml-auto min-w-5 shrink-0 text-right text-sm tabular-nums ${
            winner ? "font-semibold text-primary" : "text-muted-foreground"
          }`}
        >
          {score === "" || score == null ? "—" : score}
        </span>
      )}
    </div>
  );
}

export function MatchCard({
  match,
  editable,
  scoreDraft,
  setScoreDraft,
  clearMatchDraft,
  submitResult,
  updateMatch,
  blastBracketDepths,
  blastVariant = null,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const split = splitMetaScore(match.meta);
  const base1 = baseSideScore(match, split, 1);
  const base2 = baseSideScore(match, split, 2);
  const editing = Boolean(editable && isEditing);
  const team1Score = scoreLineValue(scoreDraft, "team1Score", base1, editing);
  const team2Score = scoreLineValue(scoreDraft, "team2Score", base2, editing);
  const slotValue = match.slotAt ? toDatetimeLocalValue(match.slotAt) : "";
  const seriesLabel = String(match.meta?.seriesType || "").toUpperCase();
  const requiredWins = Math.max(1, Math.ceil((Number(seriesLabel.replace("BO", "")) || 1) / 2));
  const matchFlowTip = blastVariant === "ten" || blastVariant === "twelve" ? describeBlastMatchFlow(match, blastVariant) : "";
  const leftScore = team1Score === "" ? null : Number(team1Score);
  const rightScore = team2Score === "" ? null : Number(team2Score);
  const scoreComplete =
    Number.isFinite(leftScore) &&
    Number.isFinite(rightScore) &&
    leftScore !== rightScore &&
    (leftScore >= requiredWins || rightScore >= requiredWins);
  const scoreWinner = scoreComplete ? (leftScore > rightScore ? match.team1 : match.team2) : "";

  const teamLinesReadOnly = !editable || !isEditing;
  const lockedBodyClass = editable && !isEditing ? "opacity-60" : "";

  function scorePayload(winner) {
    const left = team1Score === "" ? null : Number(team1Score);
    const right = team2Score === "" ? null : Number(team2Score);
    return {
      winner,
      team1Score: Number.isFinite(left) ? left : null,
      team2Score: Number.isFinite(right) ? right : null,
      score: left !== null && right !== null ? `${left}-${right}` : "",
    };
  }

  async function saveScore() {
    if (scoreComplete) {
      if (!submitResult) return;
    } else if (!updateMatch) {
      return;
    }
    setSaving(true);
    try {
      if (scoreComplete) {
        await submitResult(match.id, scorePayload(scoreWinner));
      } else {
        await updateMatch(match.id, {
          team1Score: Number.isFinite(leftScore) ? leftScore : null,
          team2Score: Number.isFinite(rightScore) ? rightScore : null,
          score: Number.isFinite(leftScore) && Number.isFinite(rightScore) ? `${leftScore}-${rightScore}` : "",
          status: match.status || "upcoming",
        });
      }
      setIsEditing(false);
      clearMatchDraft?.(match.id);
    } finally {
      setSaving(false);
    }
  }

  async function recordWin(pick) {
    if (!submitResult) return;
    setSaving(true);
    try {
      await submitResult(match.id, scorePayload(pick));
      setIsEditing(false);
      clearMatchDraft?.(match.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`relative rounded-lg border border-border bg-card p-3 shadow-sm ${
        editable && !isEditing ? "border-border/80" : ""
      }`}
      title={matchFlowTip || undefined}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Match {match.matchIndex + 1}</span>
        <span className="flex flex-wrap items-center justify-end gap-2">
          {seriesLabel ? <span className="rounded border border-border px-1.5 py-0.5">{seriesLabel}</span> : null}
          {match.meta?.winToken ? (
            <span
              className="cursor-help rounded border border-border px-1.5 py-0.5"
              title={
                describeBracketToken(match.meta.winToken, blastBracketDepths, blastVariant) ||
                `${match.meta.winToken}: winner of this match feeds into the next bracket slot.`
              }
            >
              {match.meta.winToken}
            </span>
          ) : null}
          <span className="capitalize">{match.status || "upcoming"}</span>
          {editable && !isEditing ? (
            <button type="button" className="btn btn-outline btn-xs" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          ) : null}
        </span>
      </div>
      <div className={lockedBodyClass}>
        <TeamLine
          name={match.team1}
          winner={match.winner === match.team1}
          editable={!teamLinesReadOnly}
          score={teamLinesReadOnly ? base1 : team1Score}
          onScoreChange={(value) => setScoreDraft?.({ team1Score: value })}
          onWin={() => void recordWin(match.team1)}
          blastBracketDepths={blastBracketDepths}
          blastVariant={blastVariant}
        />
        <TeamLine
          name={match.team2}
          winner={match.winner === match.team2}
          editable={!teamLinesReadOnly}
          score={teamLinesReadOnly ? base2 : team2Score}
          onScoreChange={(value) => setScoreDraft?.({ team2Score: value })}
          onWin={() => void recordWin(match.team2)}
          blastBracketDepths={blastBracketDepths}
          blastVariant={blastVariant}
        />
      </div>
      {match.winner ? <div className="mt-2 text-xs text-secondary">Winner: {match.winner}</div> : null}

      {editable && isEditing ? (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-input bg-background p-1 text-xs"
              value={slotValue}
              disabled={saving}
              onChange={(event) =>
                updateMatch?.(match.id, { slotAt: event.target.value ? datetimeLocalToIso(event.target.value) : null })
              }
            />
            <select
              className="rounded-md border border-input bg-background p-1 text-xs"
              value={match.status || "upcoming"}
              disabled={saving}
              onChange={(event) => updateMatch?.(match.id, { status: event.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="finished">Finished</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background p-2 text-xs">
            <span className="text-muted-foreground">
              {scoreComplete
                ? `${scoreWinner} has completed ${seriesLabel || "the series"}. Saving will advance the bracket.`
                : `Enter first to ${requiredWins} wins, then save score.`}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveScore()} disabled={saving}>
              {saving ? "Saving…" : "Save score"}
            </button>
          </div>
        </div>
      ) : null}
      {editable && !isEditing ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {match.slotAt ? <span>Slot: {new Date(match.slotAt).toLocaleString()}</span> : <span className="italic">No slot time set</span>}{" "}
          <span className="capitalize">· {match.status || "upcoming"}</span>
        </div>
      ) : null}
    </div>
  );
}
