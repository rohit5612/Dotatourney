import { useEffect, useMemo, useState } from "react";
import { buildDefaultSeriesRules } from "../constants/tournament";
import { AdminGlassPanel } from "../admin/components/AdminGlassPanel.jsx";
import { compressCoverImage } from "../utils/compressCoverImage.js";
import { api } from "../lib/api.js";
import { parseSeasonLabelFromName, TOURNAMENT_BRAND } from "../utils/tournamentNaming.js";
import { EngineWizardModal } from "../admin/setup/EngineWizardModal.jsx";
import { RegistrationControlsModal } from "../admin/setup/RegistrationControlsModal.jsx";
import { SetupTournamentCard } from "../admin/setup/SetupTournamentCard.jsx";
import { TournamentDraftModal } from "../admin/setup/TournamentDraftModal.jsx";
import {
  categorizeTournaments,
  tournamentCardTitle,
  tournamentCounts,
  tournamentMetaLine,
  tournamentStatusClass,
  tournamentStatusLabel,
} from "../admin/setup/setupUtils.js";
import {
  buildCrmSheetSyncConfirmMessage,
  getGoogleSheetPrefs,
  parseSpreadsheetId,
  setGoogleSheetPrefs,
} from "../utils/googleSheetPrefs.js";
import { isRegistrationCrmEligible } from "../utils/registrationCrmEligibility.js";
import "../styles/setup-page.css";

export function SetupPage({
  setup,
  setSetup,
  bootstrapTournament,
  exportData,
  importData,
  state,
  tournaments = [],
  selectTournament,
  publishTournament,
  approveTournament,
  completeTournament,
  unpublishTournament,
  deleteTournament,
  startNewTournament,
  tournamentId = "",
  setRegistrationsAccepting,
  setMessage,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [setupTab, setSetupTab] = useState("drafts");
  const [engineModalOpen, setEngineModalOpen] = useState(false);
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [engineTemplates, setEngineTemplates] = useState([]);
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [googleSheetTabName, setGoogleSheetTabName] = useState("");
  const [googleSheetSyncPending, setGoogleSheetSyncPending] = useState(false);
  const [seasonCardUploadBusy, setSeasonCardUploadBusy] = useState(false);

  const grouped = useMemo(() => categorizeTournaments(tournaments), [tournaments]);
  const counts = useMemo(() => tournamentCounts(tournaments), [tournaments]);
  const visibleList = grouped[setupTab] || [];
  const templateById = useMemo(
    () => Object.fromEntries(engineTemplates.map((template) => [template.id, template])),
    [engineTemplates],
  );
  const selectedTournament = useMemo(
    () => (tournaments || []).find((t) => t.id === tournamentId) || state?.tournament || null,
    [tournaments, tournamentId, state?.tournament],
  );

  const SETUP_TABS = [
    { id: "drafts", label: `Drafts (${counts.drafts})` },
    { id: "active", label: `Active (${counts.active})` },
    { id: "past", label: `Past (${counts.past})` },
  ];

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await api.getEngineTemplates();
        if (active) setEngineTemplates(payload.templates || []);
      } catch {
        // Templates load when admin session is ready.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tournamentId) {
      setGoogleSheetId("");
      setGoogleSheetTabName("");
      return;
    }
    const prefs = getGoogleSheetPrefs(tournamentId);
    setGoogleSheetId(prefs.spreadsheetId);
    setGoogleSheetTabName(prefs.sheetTabName);
  }, [tournamentId]);

  function persistGoogleSheetPrefsToStorage() {
    if (!tournamentId) return;
    setGoogleSheetPrefs(tournamentId, {
      spreadsheetId: googleSheetId,
      sheetTabName: googleSheetTabName,
    });
  }

  async function syncGoogleSheetFromSetup() {
    if (!tournamentId || googleSheetSyncPending) return;
    const spreadsheetId = parseSpreadsheetId(googleSheetId);
    if (!spreadsheetId) {
      setMessage?.("Enter a spreadsheet ID or full Google Sheets link, then try again.");
      return;
    }
    const sheetTab = googleSheetTabName.trim();
    persistGoogleSheetPrefsToStorage();
    setMessage?.("");
    try {
      const { registrations = [] } = await api.getRegistrations(tournamentId);
      const rowCount = registrations.filter((r) => !r.archivedAt && isRegistrationCrmEligible(r)).length;
      const confirmed = window.confirm(buildCrmSheetSyncConfirmMessage({ rowCount, sheetTabName: sheetTab }));
      if (!confirmed) return;
      setGoogleSheetSyncPending(true);
      const payload = { spreadsheetId };
      if (sheetTab) payload.sheetName = sheetTab;
      const result = await api.syncGoogleSheetsRegistrations(tournamentId, payload);
      setMessage?.(
        `Google Sheet updated — tab “${result.sheetTitle}”, ${result.rowsWritten} row(s) written (${result.range}).`,
      );
    } catch (error) {
      setMessage?.(error.message || "Google Sheets sync failed.");
    } finally {
      setGoogleSheetSyncPending(false);
    }
  }

  function resetDraft() {
    setSetup({
      seasonLabel: "",
      name: TOURNAMENT_BRAND,
      slug: "season",
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
      discordUrl: "https://discord.gg/sV2PhYc6A3",
      rulebook: "",
      announcements: [],
      bannerAnnouncement: { body: "", postedAt: "" },
      visibilityMode: "demo",
      bracketActive: false,
      status: "draft",
      registrationCodePrefix: "BPC",
      paymentQrImage: "",
      paymentUpiId: "",
      seasonCardBg: "",
      seasonCardBadge: "",
      registrationsOpen: false,
      registrationCap: "",
      engineConfig: null,
      engineTemplateId: "",
    });
  }

  async function saveDraft() {
    if (!String(setup.seasonLabel || "").trim()) {
      setMessage?.("Enter a season or event name before saving.");
      return;
    }
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

  async function openRegistrationsFor(id) {
    await selectTournament?.(id);
    setRegistrationModalOpen(true);
  }

  async function applyEngineTemplate(templateId) {
    if (!templateId) return;
    try {
      const { template } = await api.getEngineTemplate(templateId);
      setSetup((prev) => ({
        ...prev,
        engineTemplateId: template.id,
        engineConfig: template.config,
        format: template.config.format,
        teamCount: template.config.teamCount,
        seriesType: template.config.seriesType,
        seriesRules: template.config.seriesRules,
      }));
      setMessage?.(`Applied format "${template.label}".`);
    } catch (error) {
      setMessage?.(error.message);
    }
  }

  function handleOpenRegistrationsFromModal() {
    const ok = window.confirm("Open public registrations? Players will be able to use checkout on /register.");
    if (!ok) return;
    void setRegistrationsAccepting?.(true);
    setRegistrationModalOpen(false);
  }

  function handleCloseRegistrationsFromModal() {
    const ok = window.confirm("Close public registrations? Anyone mid-checkout will not be able to finish online.");
    if (!ok) return;
    void setRegistrationsAccepting?.(false);
    setRegistrationModalOpen(false);
  }

  function confirmDelete(tournament) {
    const confirmed = window.confirm(`Delete draft "${tournamentCardTitle(tournament)}"? This archives the draft.`);
    if (confirmed) deleteTournament?.(tournament.id);
  }

  async function handleSeasonCardImage(file) {
    if (!file) return;
    setSeasonCardUploadBusy(true);
    try {
      const dataUrl = await compressCoverImage(file);
      setSetup((prev) => ({ ...prev, seasonCardBg: dataUrl }));
    } catch {
      setMessage?.("Could not process that image. Try a JPG, PNG, or WebP file.");
    } finally {
      setSeasonCardUploadBusy(false);
    }
  }

  function removeSeasonCardImage() {
    setSetup((prev) => ({ ...prev, seasonCardBg: "" }));
  }

  return (
    <div className="setup-hub admin-page-stack">
      <header className="setup-hub__header">
        <div>
          <p className="setup-hub__eyebrow">Tournaments</p>
          <h1 className="setup-hub__title">Setup</h1>
          <p className="setup-hub__lead">
            Create {TOURNAMENT_BRAND} seasons, assign a format template, publish one live event, and manage registrations per tournament.
          </p>
        </div>
        <div className="setup-hub__header-actions">
          <button type="button" className="btn btn-outline" onClick={() => setEngineModalOpen(true)}>
            Format engine
          </button>
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
      </header>

      <div className="setup-stats">
        <div className="setup-stat">
          <span className="setup-stat__label">Total</span>
          <strong className="setup-stat__value">{counts.total}</strong>
        </div>
        <div className="setup-stat setup-stat--draft">
          <span className="setup-stat__label">Drafts</span>
          <strong className="setup-stat__value">{counts.drafts}</strong>
        </div>
        <div className="setup-stat setup-stat--active">
          <span className="setup-stat__label">Active</span>
          <strong className="setup-stat__value">{counts.active}</strong>
        </div>
        <div className="setup-stat setup-stat--past">
          <span className="setup-stat__label">Past</span>
          <strong className="setup-stat__value">{counts.past}</strong>
        </div>
      </div>

      {selectedTournament ? (
        <div className="setup-selected">
          <div>
            <p className="setup-selected__name">{tournamentCardTitle(selectedTournament)}</p>
            <p className="setup-selected__meta">
              {selectedTournament.name} · {tournamentMetaLine(selectedTournament, templateById)} ·{" "}
              <span className={`setup-badge ${tournamentStatusClass(selectedTournament)}`}>
                {tournamentStatusLabel(selectedTournament)}
              </span>
            </p>
          </div>
          <div className="setup-selected__actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(true)}>
              Edit
            </button>
            {selectedTournament.status !== "concluded" ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setRegistrationModalOpen(true)}>
                Registrations
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <AdminGlassPanel className="setup-panel">
        <div className="setup-panel__tabs" role="tablist" aria-label="Tournament groups">
          {SETUP_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={setupTab === tab.id}
              className={`setup-panel__tab${setupTab === tab.id ? " setup-panel__tab--active" : ""}`}
              onClick={() => setSetupTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="setup-panel__body">
          {visibleList.length ? (
            <div className="setup-list">
              {visibleList.map((tournament) => (
                <SetupTournamentCard
                  key={tournament.id}
                  tournament={tournament}
                  displayTitle={tournamentCardTitle(tournament)}
                  metaLine={tournamentMetaLine(tournament, templateById)}
                  isSelected={tournamentId === tournament.id}
                  onSelect={selectTournament}
                  onEdit={editTournament}
                  onRegistrations={openRegistrationsFor}
                  onApprove={approveTournament}
                  onPublish={publishTournament}
                  onUnpublish={unpublishTournament}
                  onComplete={completeTournament}
                  onDelete={confirmDelete}
                />
              ))}
            </div>
          ) : (
            <div className="setup-empty">
              {setupTab === "drafts"
                ? "No drafts yet. Create a tournament to get started."
                : setupTab === "active"
                  ? "No active or approved tournaments."
                  : "No concluded tournaments yet."}
            </div>
          )}
        </div>
      </AdminGlassPanel>

      <EngineWizardModal
        open={engineModalOpen}
        onClose={() => setEngineModalOpen(false)}
        setMessage={setMessage}
        onTemplatesChanged={setEngineTemplates}
      />

      <RegistrationControlsModal
        open={registrationModalOpen && Boolean(tournamentId)}
        onClose={() => setRegistrationModalOpen(false)}
        tournamentName={selectedTournament ? tournamentCardTitle(selectedTournament) : parseSeasonLabelFromName(setup.name)}
        isPublished={Boolean(state?.tournament?.is_published)}
        registrationsOpen={Boolean(setup.registrationsOpen)}
        onOpenRegistrations={handleOpenRegistrationsFromModal}
        onCloseRegistrations={handleCloseRegistrationsFromModal}
      />

      <TournamentDraftModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        setup={setup}
        setSetup={setSetup}
        isSaving={isSaving}
        onSave={() => void saveDraft()}
        isPublished={Boolean(selectedTournament?.is_published || state?.tournament?.is_published)}
        exportData={exportData}
        importData={importData}
        tournamentId={tournamentId}
        engineTemplates={engineTemplates}
        onOpenEngine={() => setEngineModalOpen(true)}
        onApplyTemplate={applyEngineTemplate}
        seasonCardUploadBusy={seasonCardUploadBusy}
        onSeasonCardImage={handleSeasonCardImage}
        onRemoveSeasonCardImage={removeSeasonCardImage}
        googleSheetId={googleSheetId}
        googleSheetTabName={googleSheetTabName}
        setGoogleSheetId={setGoogleSheetId}
        setGoogleSheetTabName={setGoogleSheetTabName}
        persistGoogleSheetPrefsToStorage={persistGoogleSheetPrefsToStorage}
        onSyncGoogleSheet={() => void syncGoogleSheetFromSetup()}
        googleSheetSyncPending={googleSheetSyncPending}
      />
    </div>
  );
}
