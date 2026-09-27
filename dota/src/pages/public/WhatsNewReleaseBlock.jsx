import { formatReleaseDate } from "../../utils/websiteVersionSchema.js";
import { WhatsNewSeason2Content } from "./WhatsNewSeason2Content.jsx";
import { WhatsNewSeason3Content } from "./WhatsNewSeason3Content.jsx";

function releaseTitle(entry) {
  if (entry?.seasonLabel) return entry.seasonLabel;
  return entry?.version ? `Release ${entry.version}` : "Release";
}

function VersionChangelogText({ entry }) {
  return (
    <div className="whats-new-page__changelog-text">
      <p className="whats-new-page__changelog-summary">{entry.summary}</p>
      {entry.notes ? <p className="whats-new-page__changelog-notes">{entry.notes}</p> : null}
    </div>
  );
}

function VersionRichContent({ version }) {
  if (version === "2.0.0") {
    return <WhatsNewSeason2Content />;
  }
  if (version === "3.0.0") {
    return <WhatsNewSeason3Content />;
  }
  return null;
}

export function WhatsNewReleaseBlock({ entry, highlighted = false }) {
  const version = entry.version;
  const title = releaseTitle(entry);
  const hasRichContent = version === "2.0.0" || version === "3.0.0";

  return (
    <article
      id={`whats-new-v-${version.replace(/\./g, "-")}`}
      className={`whats-new-page__release${highlighted ? " whats-new-page__release--highlight" : ""}`}
      data-version={version}
    >
      <header className="whats-new-page__release-head">
        <div className="whats-new-page__release-meta">
          <span className="whats-new-page__version-badge">v{version}</span>
          {entry.releasedAt ? (
            <time className="whats-new-page__release-date" dateTime={entry.releasedAt}>
              {formatReleaseDate(entry.releasedAt)}
            </time>
          ) : null}
        </div>
        <h2 className="whats-new-page__release-title">{title}</h2>
        {entry.summary && !hasRichContent ? (
          <p className="whats-new-page__release-lead">{entry.summary}</p>
        ) : null}
      </header>
      <div className="whats-new-page__release-body">
        {hasRichContent ? <VersionRichContent version={version} /> : <VersionChangelogText entry={entry} />}
      </div>
    </article>
  );
}
