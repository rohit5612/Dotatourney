import { useEffect, useMemo, useState } from "react";
import { PrimaryViewTabs } from "../../components/navigation/TournamentTabs.jsx";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { PageLoadingSpinner } from "../../components/PageLoadingSpinner.jsx";
import { api } from "../../lib/api";
import { seasonDisplayLabel } from "../../utils/seasonPayload.js";
import {
  DEFAULT_ORG_ROSTER_SECTION,
  DEFAULT_SPONSORS_SECTION,
  normalizeOrgRoster,
  normalizeSponsorsConfig,
  normalizeSponsorsConfigDraft,
  prepareSponsorsConfigForSave,
  normalizeArchiveEmbeds,
} from "../../utils/seasonContentSchema.js";
import { compressCoverImage } from "../../utils/compressCoverImage.js";
import { OrgRosterEditor } from "./OrgRosterEditor.jsx";
import { SeasonAdminAccordion } from "./SeasonAdminAccordion.jsx";
import "../../styles/season-admin.css";

const SEASONS_ADMIN_TABS = [
  { id: "org", label: "Organization roster" },
  { id: "seasons", label: "Seasons & sponsors" },
];

async function compressSeasonCardImage(file) {
  return compressCoverImage(file);
}

export function SeasonsAdminPage() {
  const [activeTab, setActiveTab] = useState("org");
  const [seasons, setSeasons] = useState([]);
  const [orgRoster, setOrgRoster] = useState({ section: DEFAULT_ORG_ROSTER_SECTION, members: [] });
  const [seasonDrafts, setSeasonDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [savingRoster, setSavingRoster] = useState(false);

  function loadContent() {
    setLoading(true);
    api
      .getAdminSeasonsContent()
      .then((data) => {
        setSeasons(data.seasons || []);
        setOrgRoster(normalizeOrgRoster(data.orgRoster || {}));
        const drafts = {};
        for (const season of data.seasons || []) {
          drafts[season.id] = {
            sponsorsConfig: normalizeSponsorsConfigDraft(
              season.sponsorsConfig || { section: DEFAULT_SPONSORS_SECTION },
            ),
            archiveEmbeds: normalizeArchiveEmbeds(season.archiveEmbeds || []),
          };
        }
        setSeasonDrafts(drafts);
      })
      .catch((err) => setMessage(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadContent();
  }, []);

  const sortedSeasons = useMemo(
    () => [...seasons].sort((a, b) => (b.number ?? 0) - (a.number ?? 0)),
    [seasons],
  );

  const tabs = useMemo(
    () =>
      SEASONS_ADMIN_TABS.map((tab) => {
        if (tab.id === "org") {
          const count = orgRoster.members?.length || 0;
          return { ...tab, label: count ? `${tab.label} (${count})` : tab.label };
        }
        if (tab.id === "seasons") {
          const count = sortedSeasons.length;
          return { ...tab, label: count ? `${tab.label} (${count})` : tab.label };
        }
        return tab;
      }),
    [orgRoster.members?.length, sortedSeasons.length],
  );

  async function handleUpload(season, file) {
    if (!file) return;
    setBusyId(season.id);
    setMessage("");
    try {
      const cardBg = await compressSeasonCardImage(file);
      const { season: updated } = await api.updateAdminSeasonCardBg(season.id, cardBg);
      setSeasons((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
      setMessage(`Updated card background for ${seasonDisplayLabel(updated)}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function handleRemove(season) {
    setBusyId(season.id);
    setMessage("");
    try {
      const { season: updated } = await api.updateAdminSeasonCardBg(season.id, null);
      setSeasons((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
      setMessage(`Removed card background for ${seasonDisplayLabel(updated)}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId("");
    }
  }

  async function saveOrgRoster() {
    setSavingRoster(true);
    setMessage("");
    try {
      const { orgRoster: saved } = await api.updateAdminOrgRoster(orgRoster);
      setOrgRoster(normalizeOrgRoster(saved));
      setMessage("Organization roster saved.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSavingRoster(false);
    }
  }

  async function saveSeasonContent(season) {
    const draft = seasonDrafts[season.id];
    if (!draft) return;
    setBusyId(season.id);
    setMessage("");
    try {
      const sponsorsConfig = prepareSponsorsConfigForSave(draft.sponsorsConfig);
      const { season: updated } = await api.updateAdminSeasonContent(season.id, {
        sponsorsConfig,
        archiveEmbeds: draft.archiveEmbeds,
      });
      api.clearPublicContentCaches(updated.slug || season.slug);
      setSeasons((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
      setSeasonDrafts((prev) => ({
        ...prev,
        [season.id]: {
          sponsorsConfig: normalizeSponsorsConfigDraft(updated.sponsorsConfig || {}),
          archiveEmbeds: normalizeArchiveEmbeds(updated.archiveEmbeds || []),
        },
      }));
      setMessage(`Saved season content for ${seasonDisplayLabel(updated)}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <PageLoadingSpinner label="Loading seasons…" />;

  return (
    <div className="season-admin-page admin-page-stack">
      <AdminGlassPanel subtle className="space-y-3">
        <div>
          <h2 className="admin-section-title">Site &amp; season content</h2>
          <p className="text-sm text-muted-foreground">
            Manage the landing page org roster and per-season sponsors, card art, and archive media.
          </p>
        </div>
        <PrimaryViewTabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={tabs}
          ariaLabel="Site and season content sections"
        />
        {message ? <p className="text-sm text-secondary">{message}</p> : null}
      </AdminGlassPanel>

      {activeTab === "org" ? (
        <AdminGlassPanel>
          <div className="season-admin-page__section-head">
            <div>
              <h3 className="font-serif text-lg font-semibold">Organization roster</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Global team on the landing page — Founders, Admins, Moderators, and Casters.
              </p>
            </div>
            <button
              type="button"
              className="season-admin__save-btn"
              disabled={savingRoster}
              onClick={() => void saveOrgRoster()}
            >
              {savingRoster ? "Saving…" : "Save roster"}
            </button>
          </div>
          <div className="mt-4">
            <OrgRosterEditor value={orgRoster} onChange={setOrgRoster} disabled={savingRoster} />
          </div>
        </AdminGlassPanel>
      ) : null}

      {activeTab === "seasons" ? (
        <AdminGlassPanel>
          <div className="season-admin-page__section-head">
            <div>
              <h3 className="font-serif text-lg font-semibold">Seasons &amp; sponsors</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Published and completed seasons only — the same list players see on <strong>/seasons</strong>. Draft and
                upcoming seasons are hidden.
              </p>
            </div>
          </div>

          {!sortedSeasons.length ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No published or completed seasons yet. Publish a tournament or conclude a season to configure content here.
            </p>
          ) : (
            <div className="season-admin-page__list">
              {sortedSeasons.map((season, index) => {
                const busy = busyId === season.id;
                const draft = seasonDrafts[season.id] || {
                  sponsorsConfig: normalizeSponsorsConfigDraft({ section: DEFAULT_SPONSORS_SECTION }),
                  archiveEmbeds: [],
                };

                return (
                  <SeasonAdminAccordion
                    key={season.id}
                    season={season}
                    draft={draft}
                    busy={busy}
                    defaultExpanded={index === 0}
                    onDraftChange={(next) =>
                      setSeasonDrafts((prev) => ({
                        ...prev,
                        [season.id]: next,
                      }))
                    }
                    onUpload={(file) => void handleUpload(season, file)}
                    onRemoveCardBg={() => void handleRemove(season)}
                    onSave={() => void saveSeasonContent(season)}
                  />
                );
              })}
            </div>
          )}
        </AdminGlassPanel>
      ) : null}
    </div>
  );
}
