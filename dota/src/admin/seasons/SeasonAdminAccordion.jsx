import { useId, useState } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import {
  formatSeasonStatusUpper,
  resolveSeasonCardBg,
  resolveSeasonDisplayStatus,
  seasonDisplayLabel,
} from "../../utils/seasonPayload.js";
import { SeasonSponsorsEditor } from "./SeasonSponsorsEditor.jsx";
import { SeasonArchiveEmbedsEditor } from "./SeasonArchiveEmbedsEditor.jsx";

const STATUS_BADGE_CLASS = {
  active: "season-admin__status--active",
  concluded: "season-admin__status--concluded",
  upcoming: "season-admin__status--upcoming",
};

function SubSection({ title, description, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={`season-admin__sub${open ? " season-admin__sub--open" : ""}`}>
      <button
        type="button"
        className="season-admin__sub-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="season-admin__sub-copy">
          <span className="season-admin__sub-title">{title}</span>
          {description ? <span className="season-admin__sub-desc">{description}</span> : null}
        </span>
        <HiOutlineChevronDown className="season-admin__chevron" aria-hidden />
      </button>
      {open ? (
        <div id={panelId} className="season-admin__sub-body">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function SeasonAdminAccordion({
  season,
  draft,
  busy,
  defaultExpanded = false,
  onDraftChange,
  onUpload,
  onRemoveCardBg,
  onSave,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const bodyId = useId();
  const label = seasonDisplayLabel(season);
  const summary = season.summary || {};
  const displayStatus = resolveSeasonDisplayStatus(season, summary);
  const statusLabel = formatSeasonStatusUpper(displayStatus);
  const statusClass = STATUS_BADGE_CLASS[displayStatus] || "";
  const cardBg = resolveSeasonCardBg(season.heroMedia);
  const sponsorCount = draft.sponsorsConfig?.sponsors?.length || 0;
  const embedCount = draft.archiveEmbeds?.length || 0;

  return (
    <article className={`season-admin${expanded ? " season-admin--expanded" : ""}`}>
      <button
        type="button"
        className="season-admin__trigger"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="season-admin__trigger-main">
          <span className="season-admin__slug">{season.slug}</span>
          <span className="season-admin__title">{label}</span>
        </span>
        <span className="season-admin__trigger-meta">
          <span className={`season-admin__status ${statusClass}`}>{statusLabel}</span>
          <span className="season-admin__counts">
            {sponsorCount} sponsor{sponsorCount === 1 ? "" : "s"} · {embedCount} embed{embedCount === 1 ? "" : "s"}
          </span>
          <HiOutlineChevronDown className="season-admin__chevron" aria-hidden />
        </span>
      </button>

      {expanded ? (
        <div id={bodyId} className="season-admin__body">
          <SubSection
            title="Card background"
            description="Override the /seasons hub card image for this season."
            defaultOpen
          >
            <div className="season-admin__actions">
              <label className="season-admin__file-btn">
                {busy ? "Uploading…" : cardBg ? "Replace background" : "Upload background"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    onUpload(file);
                  }}
                />
              </label>
              {cardBg ? (
                <button
                  type="button"
                  className="season-admin__ghost-btn"
                  disabled={busy}
                  onClick={() => onRemoveCardBg()}
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div
              className="season-admin__preview"
              style={
                cardBg
                  ? {
                      backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.25)), url("${cardBg}")`,
                    }
                  : undefined
              }
            >
              <div className={`season-admin__preview-inner${cardBg ? " season-admin__preview-inner--bg" : ""}`}>
                <p className="season-admin__preview-kicker">Preview</p>
                <p className="season-admin__preview-title">{label}</p>
                {!cardBg ? (
                  <p className="season-admin__preview-empty">No custom card background yet. Primary art comes from Setup.</p>
                ) : null}
              </div>
            </div>
          </SubSection>

          <SubSection
            title="Sponsors"
            description="Landing page podium and this season’s Sponsors tab (shown on the homepage while this season is published)."
          >
            <SeasonSponsorsEditor
              value={draft.sponsorsConfig}
              disabled={busy}
              onChange={(next) => onDraftChange({ ...draft, sponsorsConfig: next })}
            />
          </SubSection>

          <SubSection
            title="Archive YouTube embeds"
            description="Shown on the landing page and tournament page when off-live."
          >
            <SeasonArchiveEmbedsEditor
              value={draft.archiveEmbeds}
              disabled={busy}
              onChange={(next) => onDraftChange({ ...draft, archiveEmbeds: next })}
            />
          </SubSection>

          <div className="season-admin__footer">
            <button
              type="button"
              className="season-admin__save-btn"
              disabled={busy}
              onClick={() => onSave()}
            >
              {busy ? "Saving…" : "Save season content"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
