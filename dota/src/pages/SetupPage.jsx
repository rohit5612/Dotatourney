import { useState } from "react";
import { buildDefaultSeriesRules, blastTenTeamRulebookOverview, formatDetails, seriesOptions, seriesRuleTemplates } from "../constants/tournament";

const formatTeamGuidance = {
  se: { min: 2, recommended: "4, 8, 16, 32", odd: "Odd counts use byes to avoid fake teams." },
  dse: { min: 4, recommended: "4, 8, 16", odd: "Odd counts use upper-bracket byes, then feed real losers into lower bracket." },
  rr: { min: 3, recommended: "4-10", odd: "Odd counts create round byes." },
  gsl: { min: 4, recommended: "8 or 16", odd: "Odd counts split into uneven groups." },
  swiss: { min: 4, recommended: "8, 16, 32", odd: "Odd counts create round byes." },
  hybrid: { min: 4, recommended: "8 or 16", odd: "Odd counts split into uneven groups before playoffs." },
  blast: {
    min: 10,
    recommended: "10–20",
    odd: "Minimum 10 teams. Two BO1 groups, then Last Chance → 8-slot Play-In → playoffs (group winners skip to semis).",
  },
};

/** Mirrors server `getBlastPhaseSizes` / `blastSideBracketSizes` for UI hints only. */
function blastSideBracketSizesUi(n) {
  if (n < 10) return { playin: 0, lc: 0 };
  const remainder = n - 2;
  const lcEntrants = Math.max(4, n - 8);
  const playin = remainder - lcEntrants;
  return { playin, lc: lcEntrants };
}

function normalizePrizePoolBreakdown(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  if (typeof value === "string") {
    return value
      .split("\n")
      .map((line, index) => line.trim() && { placement: index + 1, label: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} place`, amount: line.trim() })
      .filter(Boolean);
  }
  return [];
}

function placementLabel(index) {
  const placement = index + 1;
  const suffix = placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th";
  return `${placement}${suffix} place`;
}

function getSetupInsights(format, teamCount, isPowerOfTwo, selectedGuidance) {
  const count = Math.max(0, Number(teamCount) || 0);
  const leagueMatches = Math.max(0, Math.floor((count * (count - 1)) / 2));
  const bracketRounds = count > 1 ? Math.ceil(Math.log2(count)) : 0;
  const structureValue =
    count < selectedGuidance.min
      ? `Minimum ${selectedGuidance.min} teams required for ${formatDetails[format]?.name || "this format"}.`
      : isPowerOfTwo
        ? "Great: this count maps cleanly to standard elimination rounds."
        : selectedGuidance.odd;

  const formatMap = {
    se: [
      { label: "Structure hint", value: structureValue },
      { label: "Bye handling", value: isPowerOfTwo ? "No byes needed." : "Highest seeds advance through byes before live rounds." },
      { label: "Bracket depth", value: `~${bracketRounds} rounds to crown a winner` },
    ],
    dse: [
      { label: "Structure hint", value: structureValue },
      { label: "Lower bracket", value: count >= 4 ? "Losers feed into a lower bracket, including 4-team events." : "Needs 4 teams to create lower bracket flow." },
      { label: "Bracket depth", value: `~${Math.max(2, bracketRounds + 1)} rounds across upper, lower, and final` },
    ],
    rr: [
      { label: "Structure hint", value: structureValue },
      { label: "Round robin workload", value: `${leagueMatches} league matches (single round robin)` },
      { label: "Playoff depth", value: count >= 3 ? "Top teams feed into a final playoff bracket." : "Needs 3 teams for standings." },
    ],
    gsl: [
      { label: "Structure hint", value: structureValue },
      { label: "Group workload", value: `~${Math.max(0, Math.floor(leagueMatches / 2))} group matches before playoffs` },
      { label: "Playoff depth", value: "Top group finishers move into elimination playoffs." },
    ],
    swiss: [
      { label: "Structure hint", value: structureValue },
      { label: "Swiss workload", value: `${Math.min(3, Math.max(1, count - 1))} pairing rounds before playoffs` },
      { label: "Playoff depth", value: "Top Swiss finishers move into qualification playoffs." },
    ],
    hybrid: [
      { label: "Structure hint", value: structureValue },
      { label: "Group workload", value: `~${Math.max(0, Math.floor(leagueMatches / 2))} group matches before playoffs` },
      { label: "Bracket depth", value: "Group standings feed into playoff stages." },
    ],
    blast: [
      { label: "Structure hint", value: structureValue },
      {
        label: "Group workload",
        value: (() => {
          if (count < 10) return "—";
          const a = Math.ceil(count / 2);
          const b = count - a;
          const rr = (n) => (n * Math.max(0, n - 1)) / 2;
          return `${rr(a) + rr(b)} BO1 group matches (round robins of ${a} and ${b})`;
        })(),
      },
      {
        label: "Elimination",
        value: (() => {
          if (count < 10) return "—";
          const { playin, lc } = blastSideBracketSizesUi(count);
          const parts = [];
          if (lc) parts.push(`Last Chance (${lc} entrants → 2 into Play-In)`);
          if (count === 10) {
            parts.push(`Play-In (4 teams: ${playin} from groups + 2 from Last Chance)`);
            parts.push("Playoffs: group 2nds in quarterfinals vs Play-In winners; group winners in semis; final");
          } else if (count === 12) {
            parts.push(`Play-In (8 teams: ${playin} from groups + 2 from Last Chance + byes)`);
            parts.push("Playoffs: group 1st vs other group 2nd in semis only, then final (Play-In is separate)");
          } else {
            parts.push(`Play-In (8 slots: ${playin} from groups + 2 from Last Chance + byes)`);
            parts.push("Playoffs: main QF / SF / GF (default BO3, grand final BO5 in series rules)");
          }
          return parts.join("; ");
        })(),
      },
    ],
  };

  return formatMap[format] || formatMap.dse;
}

export function SetupPage({
  setup,
  setSetup,
  selectedFormat,
  onFormatChange,
  bootstrapTournament,
  exportData,
  importData,
  state,
  tournaments = [],
  selectTournament,
  publishTournament,
  unpublishTournament,
  deleteTournament,
  startNewTournament,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const teamCount = Number(setup.teamCount) || 0;
  const isPowerOfTwo = teamCount > 0 && (teamCount & (teamCount - 1)) === 0;
  const currentSeriesTemplates = seriesRuleTemplates[setup.format] || [];
  const selectedGuidance = formatTeamGuidance[setup.format] || formatTeamGuidance.dse;
  const teamCountTooLow = teamCount < selectedGuidance.min;
  const quantityTooltip = `${formatDetails[setup.format]?.name || "Selected format"} requires minimum ${selectedGuidance.min} teams. Recommended: ${selectedGuidance.recommended}. ${selectedGuidance.odd}`;
  const setupInsights = getSetupInsights(setup.format, teamCount, isPowerOfTwo, selectedGuidance);
  const prizeBreakdown = normalizePrizePoolBreakdown(setup.prizePoolBreakdown);
  const prizeEligibleCount = Math.min(teamCount || 1, Math.max(1, prizeBreakdown.length || 1));

  function setPrizeBreakdownCount(nextCount) {
    const count = Math.max(1, Math.min(teamCount || 1, Number(nextCount) || 1));
    setSetup((prev) => {
      const current = normalizePrizePoolBreakdown(prev.prizePoolBreakdown);
      const next = Array.from({ length: count }, (_, index) => ({
        placement: index + 1,
        label: current[index]?.label || placementLabel(index),
        amount: current[index]?.amount || "",
      }));
      return { ...prev, prizePoolBreakdown: next };
    });
  }

  function updatePrizeBreakdown(index, patch) {
    setSetup((prev) => {
      const current = normalizePrizePoolBreakdown(prev.prizePoolBreakdown);
      const count = Math.max(prizeEligibleCount, index + 1);
      const next = Array.from({ length: count }, (_, itemIndex) => ({
        placement: itemIndex + 1,
        label: current[itemIndex]?.label || placementLabel(itemIndex),
        amount: current[itemIndex]?.amount || "",
      }));
      next[index] = { ...next[index], ...patch };
      return { ...prev, prizePoolBreakdown: next };
    });
  }

  function resetDraft() {
    setSetup({
      name: "BPC League — Bharat Pro Circuit League",
      slug: "bpcl",
      format: "dse",
      seriesType: "bo3",
      teamCount: 8,
      seriesRules: buildDefaultSeriesRules("dse", "bo3"),
      description: "",
      prizePool: "",
      prizePoolBreakdown: [{ placement: 1, label: "1st place", amount: "" }],
      entryFee: "",
      startDate: "",
      endDate: "",
      registrationDeadline: "",
      discordUrl: "https://discord.gg/NmC2Xqnb",
      rulebook: "",
      announcements: [],
      visibilityMode: "demo",
      bracketActive: false,
      status: "draft",
    registrationCodePrefix: "BPC",
    paymentQrImage: "",
    paymentUpiId: "",
  });
  }

  async function saveDraft() {
    setIsSaving(true);
    try {
      await bootstrapTournament();
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function editTournament(id) {
    await selectTournament?.(id);
    setIsModalOpen(true);
  }

  function confirmDelete(tournament) {
    const confirmed = window.confirm(`Delete draft tournament "${tournament.name}"? This will archive the draft and remove it from this list.`);
    if (confirmed) deleteTournament?.(tournament.id);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg tracking-wide">Tournament Setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">Create draft tournaments, edit settings, and publish exactly one tournament to the public site.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              startNewTournament?.();
              resetDraft();
              setIsModalOpen(true);
            }}
          >
            Create tournament
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-lg">Drafts and tournaments</h3>
        {(tournaments || []).map((tournament) => (
          <div key={tournament.id} className="grid gap-3 rounded-md border border-border bg-background p-3 text-sm lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tournament.name}</span>
                <span className="rounded border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">{tournament.status}</span>
                {tournament.is_published ? <span className="rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground">Published</span> : null}
              </div>
              <div className="mt-1 text-muted-foreground">
                {formatDetails[tournament.format]?.name || tournament.format} - {tournament.team_count} teams - Starts {tournament.start_date || "TBA"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => editTournament(tournament.id)}>
                Edit
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => publishTournament?.(tournament.id)}>
                Approve + publish
              </button>
              {tournament.is_published ? (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => unpublishTournament?.(tournament.id)}>
                  Unpublish
                </button>
              ) : null}
              {tournament.status === "draft" && !tournament.is_published ? (
                <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => confirmDelete(tournament)}>
                  Delete draft
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {!tournaments?.length ? <p className="text-sm text-muted-foreground">No tournament drafts yet. Create one to begin.</p> : null}
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4">
          <div className="mx-auto max-w-6xl space-y-4 rounded-lg border border-border bg-card p-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-xl">Tournament draft</h3>
                <p className="text-sm text-muted-foreground">Saving keeps the tournament as a draft until you approve and publish it.</p>
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.name}
          onChange={(event) => setSetup((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Tournament name"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.slug || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, slug: event.target.value }))}
          placeholder="Public slug"
        />
        <label className="relative block">
          <span className="sr-only">Team quantity</span>
          <input
            type="number"
            min={selectedGuidance.min}
            max={64}
            title={quantityTooltip}
            className={`w-full rounded-md border bg-background p-2 pr-9 ${
              teamCountTooLow ? "border-destructive" : "border-input"
            }`}
            value={setup.teamCount}
            onChange={(event) =>
              setSetup((prev) => ({
                ...prev,
                teamCount: Math.max(selectedGuidance.min, Math.min(64, Number(event.target.value) || selectedGuidance.min)),
              }))
            }
            placeholder="Team count"
          />
          <span
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border border-border text-xs text-muted-foreground"
            title={quantityTooltip}
            aria-label={quantityTooltip}
          >
            ?
          </span>
        </label>
        <select
          className="rounded-md border border-input bg-background p-2"
          value={setup.seriesType}
          onChange={(event) =>
            setSetup((prev) => ({
              ...prev,
              seriesType: event.target.value,
              seriesRules: Object.fromEntries(
                Object.entries(prev.seriesRules || {}).map(([ruleKey]) => [ruleKey, event.target.value]),
              ),
            }))
          }
        >
          {seriesOptions.map((series) => (
            <option key={series} value={series}>
              {series.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-input bg-background p-2"
          value={setup.format}
          onChange={(event) => {
            const nextFormat = event.target.value;
            const nextGuidance = formatTeamGuidance[nextFormat] || formatTeamGuidance.dse;
            onFormatChange(nextFormat);
            setSetup((prev) => ({
              ...prev,
              teamCount: Math.max(nextGuidance.min, Number(prev.teamCount) || nextGuidance.min),
            }));
          }}
        >
          {Object.entries(formatDetails).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() =>
            setSetup((prev) => ({
              ...prev,
              teamCount: 8,
            }))
          }
        >
          Reset to 8 teams
        </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Public overview</span>
          </div>
          <textarea
            className="min-h-28 w-full rounded-md border border-input bg-background p-2"
            value={setup.description || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Short tournament summary for the home page and tournament hub (plain text or simple HTML)"
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">HTML:</span> Optional tags{" "}
            <code className="rounded bg-background px-1">&lt;p&gt;</code>, <code className="rounded bg-background px-1">&lt;br&gt;</code>,{" "}
            <code className="rounded bg-background px-1">&lt;strong&gt;</code>/<code className="rounded bg-background px-1">&lt;b&gt;</code>,{" "}
            <code className="rounded bg-background px-1">&lt;em&gt;</code>/<code className="rounded bg-background px-1">&lt;i&gt;</code>,{" "}
            <code className="rounded bg-background px-1">&lt;u&gt;</code>, <code className="rounded bg-background px-1">&lt;a href&gt;</code>,{" "}
            <code className="rounded bg-background px-1">&lt;ul&gt;</code>/<code className="rounded bg-background px-1">&lt;ol&gt;</code>/<code className="rounded bg-background px-1">&lt;li&gt;</code>.
            Blank lines in plain text become line breaks. Other markup is stripped on the public site.
          </p>
        </div>
        <div className="md:col-span-2">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Rule book</span>
            {setup.format === "blast" && teamCount === 10 ? (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setSetup((prev) => ({ ...prev, rulebook: blastTenTeamRulebookOverview.trim() }))}
              >
                Insert BLAST (10 teams) overview
              </button>
            ) : null}
          </div>
          <textarea
            className="min-h-40 w-full rounded-md border border-input bg-background p-2"
            value={setup.rulebook || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, rulebook: event.target.value }))}
            placeholder={
              setup.format === "blast" && teamCount === 10
                ? "Optional: click “Insert BLAST (10 teams) overview” above, or paste your own rules."
                : "Rule book (plain text or basic HTML — see note below)"
            }
          />
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">HTML:</span> You can use tags like{" "}
            <code className="rounded bg-background px-1">&lt;p&gt;</code>, <code className="rounded bg-background px-1">&lt;br&gt;</code>,{" "}
            <code className="rounded bg-background px-1">&lt;strong&gt;</code>, <code className="rounded bg-background px-1">&lt;h3&gt;</code>, lists, links, simple
            tables, and <code className="rounded bg-background px-1">class</code> / <code className="rounded bg-background px-1">style</code> (e.g.{" "}
            <code className="rounded bg-background px-1">text-align: center</code>). Plain text line breaks are kept. Scripts and unsafe markup are removed when
            displayed publicly.
          </p>
        </div>
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.prizePool || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, prizePool: event.target.value }))}
          placeholder="Prize pool"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.entryFee || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, entryFee: event.target.value }))}
          placeholder="Entry fee"
        />
        <input
          className="rounded-md border border-input bg-background p-2"
          value={setup.discordUrl || ""}
          onChange={(event) => setSetup((prev) => ({ ...prev, discordUrl: event.target.value }))}
          placeholder="Discord invite URL"
        />
        <label className="text-sm text-muted-foreground">
          Start date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground"
            value={setup.startDate || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, startDate: event.target.value }))}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Finish date
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground"
            value={setup.endDate || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, endDate: event.target.value }))}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Registration finish date
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border border-input bg-background p-2 text-foreground"
            value={setup.registrationDeadline || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, registrationDeadline: event.target.value }))}
          />
        </label>
        <div className="md:col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Player registration IDs</p>
          <p className="mt-1 leading-relaxed">
            After email verification, each player receives a public ID in order:{" "}
            <span className="font-mono text-foreground">BPC-001</span>, <span className="font-mono text-foreground">BPC-002</span>,{" "}
            <span className="font-mono text-foreground">BPC-003</span>, and so on.
          </p>
        </div>
        <label className="text-sm text-muted-foreground md:col-span-2">
          Payment QR image (shown on public registration payment step)
          <input
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) {
                setSetup((prev) => ({ ...prev, paymentQrImage: "" }));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setSetup((prev) => ({ ...prev, paymentQrImage: reader.result || "" }));
              reader.readAsDataURL(file);
            }}
          />
          {setup.paymentQrImage ? (
            <img src={setup.paymentQrImage} alt="Payment QR preview" className="mt-2 h-32 w-32 rounded border border-border object-contain" />
          ) : null}
          <input
            type="text"
            className="mt-3 w-full rounded-md border border-input bg-background p-2 font-mono text-sm"
            value={setup.paymentUpiId || ""}
            onChange={(event) => setSetup((prev) => ({ ...prev, paymentUpiId: event.target.value }))}
            placeholder="UPI ID for players (e.g. merchant@paytm)"
          />
          <p className="mt-1 text-xs text-muted-foreground">Shown on the public registration payment step below the QR (optional).</p>
        </label>
            </div>

            <section className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Prize pool distribution</p>
                  <p className="text-xs text-muted-foreground">Choose how many placements are eligible, then assign each payout manually.</p>
                </div>
                <label className="text-sm text-muted-foreground">
                  Paid placements
                  <select
                    className="ml-2 rounded-md border border-input bg-card p-2 text-foreground"
                    value={prizeEligibleCount}
                    onChange={(event) => setPrizeBreakdownCount(event.target.value)}
                  >
                    {Array.from({ length: Math.max(1, teamCount || 1) }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        Top {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: prizeEligibleCount }, (_, index) => {
                  const row = prizeBreakdown[index] || { placement: index + 1, label: placementLabel(index), amount: "" };
                  return (
                    <div key={index} className="grid gap-2 rounded-md border border-border bg-card p-3 sm:grid-cols-[1fr_1fr]">
                      <input
                        className="rounded-md border border-input bg-background p-2 text-sm"
                        value={row.label || placementLabel(index)}
                        onChange={(event) => updatePrizeBreakdown(index, { label: event.target.value })}
                        placeholder={placementLabel(index)}
                      />
                      <input
                        className="rounded-md border border-input bg-background p-2 text-sm"
                        value={row.amount || ""}
                        onChange={(event) => updatePrizeBreakdown(index, { amount: event.target.value })}
                        placeholder="Amount"
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-3">
        {setupInsights.map((insight) => (
          <div key={insight.label} className="rounded-md border border-border bg-background p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{insight.label}</div>
            <div className="mt-1 text-sm">{insight.value}</div>
          </div>
        ))}
            </div>

            <div>
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Format Library</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(formatDetails).map(([key, format]) => {
            const active = selectedFormat === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onFormatChange(key);
                }}
                className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary hover:bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-base">{format.name}</h3>
                  <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {format.tag}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{format.description}</p>
                <p className="mt-2 text-xs text-secondary">{format.guidance}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Min {formatTeamGuidance[key]?.min || 2} teams. Recommended: {formatTeamGuidance[key]?.recommended || "4, 8, 16"}.
                </p>
              </button>
            );
          })}
        </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Why format choice matters:</span> it impacts bracket fairness, upset probability,
          stream pacing, and how meaningful standings become across rounds.
        </p>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">Series setup by stage</p>
          <p className="text-xs text-muted-foreground">
            Tournament default: <span className="uppercase">{setup.seriesType}</span>
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {currentSeriesTemplates.map((rule) => (
            <label key={rule.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">{rule.label}</span>
              <select
                className="rounded-md border border-input bg-card px-2 py-1 text-sm uppercase"
                value={setup.seriesRules?.[rule.key] || rule.defaultSeries}
                onChange={(event) =>
                  setSetup((prev) => ({
                    ...prev,
                    seriesRules: {
                      ...(prev.seriesRules || {}),
                      [rule.key]: event.target.value,
                    },
                  }))
                }
              >
                {seriesOptions.map((series) => (
                  <option key={series} value={series}>
                    {series.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Operational note:</span> these series rules are stored with tournament config and are meant to drive match
          pacing, stream time planning, and stage difficulty. You can tune them before each major phase.
        </p>
            </div>

            {state?.tournament?.id ? (
        <div className="rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
          Tournament ID: <span className="font-mono text-foreground">{state.tournament.id}</span>
        </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={saveDraft} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save draft"}
        </button>
        <button type="button" className="btn btn-outline" onClick={exportData}>
          Export JSON
        </button>
        <label className="btn btn-outline cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" className="hidden" onChange={importData} />
        </label>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
