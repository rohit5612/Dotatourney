import { useMemo, useState } from "react";
import { blastTenTeamRulebookOverview } from "../../constants/tournament.js";
import {
  buildTournamentFullName,
  seasonSlugFromLabel,
  slugifySeasonLabel,
  TOURNAMENT_BRAND,
} from "../../utils/tournamentNaming.js";
import { formatLabelForTemplate, summarizeEngineConfig } from "../../utils/engineTemplateSummary.js";
import { seasonBadgeShort } from "../../utils/seasonPayload.js";

const DRAFT_TABS = [
  { id: "identity", label: "Identity" },
  { id: "format", label: "Format" },
  { id: "details", label: "Details" },
  { id: "content", label: "Content" },
  { id: "admin", label: "Admin" },
];

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
  return [];
}

function placementLabel(index) {
  const placement = index + 1;
  const suffix = placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th";
  return `${placement}${suffix} place`;
}

export function TournamentDraftModal({
  open,
  onClose,
  setup,
  setSetup,
  isSaving,
  onSave,
  isPublished = false,
  exportData,
  importData,
  tournamentId,
  engineTemplates = [],
  onOpenEngine,
  onApplyTemplate,
  seasonCardUploadBusy,
  onSeasonCardImage,
  onRemoveSeasonCardImage,
  googleSheetId,
  googleSheetTabName,
  setGoogleSheetId,
  setGoogleSheetTabName,
  persistGoogleSheetPrefsToStorage,
  onSyncGoogleSheet,
  googleSheetSyncPending = false,
}) {
  const [activeTab, setActiveTab] = useState("identity");

  const seasonLabel = setup.seasonLabel ?? "";
  const fullName = buildTournamentFullName(seasonLabel);
  const publicSlug = seasonSlugFromLabel(seasonLabel);
  const shortSlug = slugifySeasonLabel(seasonLabel);

  const prizeBreakdown = normalizePrizePoolBreakdown(setup.prizePoolBreakdown);
  const teamCount = Number(setup.teamCount) || 1;
  const prizeEligibleCount = Math.min(teamCount, Math.max(1, prizeBreakdown.length || 1));

  const selectedTemplate = useMemo(
    () => engineTemplates.find((template) => template.id === setup.engineTemplateId) || null,
    [engineTemplates, setup.engineTemplateId],
  );

  const appliedSummary = summarizeEngineConfig(setup.engineConfig);
  const previewBadge = seasonBadgeShort({
    name: fullName,
    number: null,
    tournamentCardBadge: setup.seasonCardBadge,
  });

  if (!open) return null;

  function setPrizeBreakdownCount(nextCount) {
    const count = Math.max(1, Math.min(teamCount, Number(nextCount) || 1));
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

  return (
    <div className="setup-modal" role="presentation">
      <button type="button" className="setup-modal__backdrop" aria-label="Close dialog" onClick={onClose} />
      <div className="setup-modal__panel setup-modal__panel--draft" role="dialog" aria-modal="true" aria-labelledby="setup-draft-title">
        <header className="setup-modal__head setup-draft-modal__head">
          <div>
            <h2 id="setup-draft-title" className="setup-modal__title">
              Tournament draft
            </h2>
            <p className="setup-modal__lead">Configure identity, assign a format template, then save as draft until approval.</p>
          </div>
          <button type="button" className="setup-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="setup-draft-modal__tabs" role="tablist" aria-label="Draft sections">
          {DRAFT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`setup-draft-modal__tab${activeTab === tab.id ? " setup-draft-modal__tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="setup-draft-modal__body">
          {activeTab === "identity" ? (
            <section className="setup-draft-section">
              <div className="setup-draft-section__intro">
                <h3 className="setup-draft-section__title">Season identity</h3>
                <p className="setup-draft-section__copy">
                  Every tournament is branded as <strong>{TOURNAMENT_BRAND}</strong>. Enter the season or event name — that short label appears on season cards; the full name appears on the season detail page.
                </p>
              </div>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Season / event name</span>
                <input
                  className="setup-draft-field__input setup-draft-field__input--large"
                  value={seasonLabel}
                  onChange={(event) => setSetup((prev) => ({ ...prev, seasonLabel: event.target.value }))}
                  placeholder="Season 1, Major, Invitational…"
                />
              </label>
              <div className="setup-draft-preview">
                <div className="setup-draft-preview__row">
                  <span className="setup-draft-preview__key">Season card title</span>
                  <strong className="setup-draft-preview__value">{seasonLabel.trim() || "—"}</strong>
                </div>
                <div className="setup-draft-preview__row">
                  <span className="setup-draft-preview__key">Full public name</span>
                  <strong className="setup-draft-preview__value">{fullName}</strong>
                </div>
                <div className="setup-draft-preview__row">
                  <span className="setup-draft-preview__key">Auto slug</span>
                  <code className="setup-draft-preview__code">{publicSlug}</code>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "format" ? (
            <section className="setup-draft-section">
              <div className="setup-draft-section__intro">
                <h3 className="setup-draft-section__title">Bracket format</h3>
                <p className="setup-draft-section__copy">
                  Pick a saved template from the format engine. Team count, stages, and series rules come from the template — edit templates separately in Format engine.
                </p>
              </div>
              <div className="setup-draft-format">
                <label className="setup-draft-field">
                  <span className="setup-draft-field__label">Format template</span>
                  <select
                    className="setup-draft-field__input"
                    value={setup.engineTemplateId || ""}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      if (!nextId) {
                        setSetup((prev) => ({ ...prev, engineTemplateId: "" }));
                        return;
                      }
                      void onApplyTemplate?.(nextId);
                    }}
                  >
                    <option value="">Select a template…</option>
                    {engineTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {formatLabelForTemplate(template)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-outline btn-sm" onClick={onOpenEngine}>
                  Open format engine
                </button>
              </div>
              {selectedTemplate || appliedSummary ? (
                <div className="setup-draft-format-card">
                  <p className="setup-draft-format-card__title">{selectedTemplate?.label || "Applied configuration"}</p>
                  {selectedTemplate?.description ? (
                    <p className="setup-draft-format-card__desc">{selectedTemplate.description}</p>
                  ) : null}
                  <p className="setup-draft-format-card__summary">{appliedSummary || "No stages configured yet."}</p>
                  {setup.engineTemplateId ? (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => void onApplyTemplate?.(setup.engineTemplateId)}>
                      Re-apply template
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="setup-draft-empty">No format assigned. Create templates in Format engine, then select one here.</p>
              )}
            </section>
          ) : null}

          {activeTab === "details" ? (
            <section className="setup-draft-section setup-draft-section--grid">
              <label className="setup-draft-field setup-draft-field--wide">
                <span className="setup-draft-field__label">Public overview</span>
                <textarea
                  className="setup-draft-field__textarea"
                  value={setup.description || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short summary for the home page and tournament hub"
                />
              </label>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Prize pool</span>
                <input
                  className="setup-draft-field__input"
                  value={setup.prizePool || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, prizePool: event.target.value }))}
                  placeholder="₹ amount or TBA"
                />
              </label>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Registration cap (players)</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  className="setup-draft-field__input"
                  value={setup.registrationCap ?? ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, registrationCap: event.target.value }))}
                  placeholder="e.g. 80 solo slots"
                />
              </label>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Entry fee label</span>
                <input
                  className="setup-draft-field__input"
                  value={setup.entryFee || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, entryFee: event.target.value }))}
                  placeholder="Shown on registration"
                />
              </label>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Start date</span>
                <input
                  type="date"
                  className="setup-draft-field__input"
                  value={setup.startDate || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, startDate: event.target.value }))}
                />
              </label>
              <label className="setup-draft-field">
                <span className="setup-draft-field__label">Finish date</span>
                <input
                  type="date"
                  className="setup-draft-field__input"
                  value={setup.endDate || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, endDate: event.target.value }))}
                />
              </label>
              <label className="setup-draft-field setup-draft-field--wide">
                <span className="setup-draft-field__label">Discord invite</span>
                <input
                  className="setup-draft-field__input"
                  value={setup.discordUrl || ""}
                  onChange={(event) => setSetup((prev) => ({ ...prev, discordUrl: event.target.value }))}
                  placeholder="https://discord.gg/…"
                />
              </label>
              <div className="setup-draft-field setup-draft-field--wide">
                <div className="setup-draft-field__row">
                  <span className="setup-draft-field__label">Prize distribution</span>
                  <label className="setup-draft-field__inline">
                    Paid placements
                    <select
                      className="setup-draft-field__input setup-draft-field__input--inline"
                      value={prizeEligibleCount}
                      onChange={(event) => setPrizeBreakdownCount(event.target.value)}
                    >
                      {Array.from({ length: Math.max(1, teamCount) }, (_, index) => (
                        <option key={index + 1} value={index + 1}>
                          Top {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="setup-draft-prize-grid">
                  {Array.from({ length: prizeEligibleCount }, (_, index) => {
                    const row = prizeBreakdown[index] || { placement: index + 1, label: placementLabel(index), amount: "" };
                    return (
                      <div key={index} className="setup-draft-prize-row">
                        <input
                          className="setup-draft-field__input"
                          value={row.label || placementLabel(index)}
                          onChange={(event) => updatePrizeBreakdown(index, { label: event.target.value })}
                          placeholder={placementLabel(index)}
                        />
                        <input
                          className="setup-draft-field__input"
                          value={row.amount || ""}
                          onChange={(event) => updatePrizeBreakdown(index, { amount: event.target.value })}
                          placeholder="Amount"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="setup-draft-callout setup-draft-field--wide">
                <strong>Payments</strong>
                <p>Registration fees and Cashfree checkout are configured in the Cards tab.</p>
              </div>
            </section>
          ) : null}

          {activeTab === "content" ? (
            <section className="setup-draft-section">
              <div className="setup-draft-section__intro setup-draft-section__intro--row">
                <div>
                  <h3 className="setup-draft-section__title">Rule book</h3>
                  <p className="setup-draft-section__copy">Plain text or basic HTML — displayed on the public tournament hub.</p>
                </div>
                {setup.format === "blast" && teamCount === 10 ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setSetup((prev) => ({ ...prev, rulebook: blastTenTeamRulebookOverview.trim() }))}
                  >
                    Insert BLAST (10 teams)
                  </button>
                ) : null}
              </div>
              <textarea
                className="setup-draft-field__textarea setup-draft-field__textarea--tall"
                value={setup.rulebook || ""}
                onChange={(event) => setSetup((prev) => ({ ...prev, rulebook: event.target.value }))}
                placeholder="Tournament rules and policies"
              />

              <div className="setup-draft-season-card">
                <div className="setup-draft-season-card__head">
                  <div>
                    <h3 className="setup-draft-section__title">Season card</h3>
                    <p className="setup-draft-section__copy">Badge label and background for the archive card on /seasons.</p>
                  </div>
                  <div className="setup-draft-season-card__actions">
                    <label className="btn btn-outline btn-sm cursor-pointer">
                      {seasonCardUploadBusy ? "Processing…" : setup.seasonCardBg ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={seasonCardUploadBusy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void onSeasonCardImage?.(file);
                        }}
                      />
                    </label>
                    {setup.seasonCardBg ? (
                      <button type="button" className="btn btn-outline btn-sm" disabled={seasonCardUploadBusy} onClick={onRemoveSeasonCardImage}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
                <label className="setup-draft-field setup-draft-season-card__badge-field">
                  <span className="setup-draft-field__label">Card badge</span>
                  <input
                    type="text"
                    className="setup-draft-field__input"
                    value={setup.seasonCardBadge || ""}
                    maxLength={16}
                    placeholder="Auto from season name (e.g. S1, BPC2)"
                    onChange={(event) =>
                      setSetup((prev) => ({ ...prev, seasonCardBadge: event.target.value.slice(0, 16) }))
                    }
                  />
                </label>
                <p className="setup-draft-section__copy setup-draft-season-card__badge-hint">
                  Up to 4 characters shown on the card. Leave blank to derive from the season name.
                </p>
                <div
                  className="setup-draft-season-card__preview"
                  style={
                    setup.seasonCardBg
                      ? {
                          backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.15)), url("${setup.seasonCardBg}")`,
                        }
                      : undefined
                  }
                >
                  <div className="setup-draft-season-card__preview-head">
                    <span className="setup-draft-season-card__badge" aria-hidden="true">
                      {previewBadge}
                    </span>
                    <div>
                      <p className="setup-draft-season-card__eyebrow">Season card preview</p>
                      <p className="setup-draft-season-card__title">{seasonLabel.trim() || "Season name"}</p>
                    </div>
                  </div>
                  {!setup.seasonCardBg ? <p className="setup-draft-season-card__hint">Upload artwork above.</p> : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "admin" ? (
            <section className="setup-draft-section">
              {tournamentId ? (
                <div className="setup-draft-callout">
                  Tournament ID <code className="setup-draft-preview__code">{tournamentId}</code>
                </div>
              ) : null}
              <div className="setup-draft-callout">
                <strong>Google Sheets</strong>
                <p>
                  CRM sync — writes registration rows to <code>C5:L…</code> on the worksheet tab below. Settings are saved per
                  tournament (spreadsheet link + tab name).
                </p>
                <div className="setup-draft-admin-grid">
                  <label className="setup-draft-field">
                    <span className="setup-draft-field__label">Spreadsheet link or ID</span>
                    <input
                      type="text"
                      className="setup-draft-field__input"
                      placeholder="https://docs.google.com/spreadsheets/d/… or spreadsheet ID"
                      value={googleSheetId}
                      onChange={(event) => setGoogleSheetId(event.target.value)}
                      onBlur={persistGoogleSheetPrefsToStorage}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!tournamentId}
                    />
                  </label>
                  <label className="setup-draft-field">
                    <span className="setup-draft-field__label">Worksheet tab name</span>
                    <input
                      type="text"
                      className="setup-draft-field__input"
                      placeholder="Exact tab name (leave empty for first tab)"
                      value={googleSheetTabName}
                      onChange={(event) => setGoogleSheetTabName(event.target.value)}
                      onBlur={persistGoogleSheetPrefsToStorage}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!tournamentId}
                    />
                  </label>
                </div>
                <div className="setup-draft-admin-actions mt-3">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={onSyncGoogleSheet}
                    disabled={!tournamentId || googleSheetSyncPending || !googleSheetId.trim()}
                  >
                    {googleSheetSyncPending ? "Syncing…" : "Sync registrations to sheet"}
                  </button>
                </div>
              </div>
              <div className="setup-draft-admin-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={exportData}>
                  Export JSON
                </button>
                <label className="btn btn-outline btn-sm cursor-pointer">
                  Import JSON
                  <input type="file" accept="application/json" className="hidden" onChange={importData} />
                </label>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="setup-draft-modal__footer">
          {isPublished ? (
            <p className="setup-draft-modal__footer-note">
              Changes apply to the public site immediately — no need to unpublish.
            </p>
          ) : null}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={isSaving || !seasonLabel.trim()}>
            {isSaving ? "Saving…" : isPublished ? "Save to site" : "Save draft"}
          </button>
        </footer>
      </div>
    </div>
  );
}
