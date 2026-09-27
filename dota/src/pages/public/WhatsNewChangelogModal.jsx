import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import {
  PUBLIC_CHANGELOG_PAGE_SIZE,
  buildPublicChangelogLines,
  isMajorReleaseVersion,
} from "../../utils/websiteVersionSchema.js";

function ChangelogLineList({ lines }) {
  if (!lines.length) {
    return <p className="whats-new-changelog-modal__empty">No changelog entries yet.</p>;
  }
  return (
    <ul className="whats-new-page__changelog-lines">
      {lines.map((line) => {
        const isMajor = isMajorReleaseVersion(line.version);
        return (
          <li
            key={line.version}
            className={`whats-new-page__changelog-line${isMajor ? " whats-new-page__changelog-line--major" : ""}`}
          >
            <span
              className={`whats-new-page__changelog-version${isMajor ? " whats-new-page__changelog-version--major" : ""}`}
            >
              v{line.version}
            </span>
            <span
              className={`whats-new-page__changelog-text${isMajor ? " whats-new-page__changelog-text--major" : ""}`}
            >
              {line.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function WhatsNewChangelogModal({ open, onClose, versionHistory, versionChangeLog }) {
  useBodyScrollLock(open);
  const [page, setPage] = useState(1);

  const allLines = useMemo(
    () => buildPublicChangelogLines(versionHistory, versionChangeLog, null),
    [versionHistory, versionChangeLog],
  );

  const totalPages = Math.max(1, Math.ceil(allLines.length / PUBLIC_CHANGELOG_PAGE_SIZE));

  useEffect(() => {
    if (!open) return;
    setPage(1);
  }, [open]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const pageLines = useMemo(() => {
    const start = (page - 1) * PUBLIC_CHANGELOG_PAGE_SIZE;
    return allLines.slice(start, start + PUBLIC_CHANGELOG_PAGE_SIZE);
  }, [allLines, page]);

  if (!open) return null;

  return createPortal(
    <div className="whats-new-changelog-modal" role="presentation">
      <button type="button" className="whats-new-changelog-modal__backdrop" aria-label="Close changelog" onClick={onClose} />
      <div
        className="whats-new-changelog-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-changelog-modal-title"
      >
        <header className="whats-new-changelog-modal__head">
          <div>
            <p className="whats-new-changelog-modal__kicker">Site versions</p>
            <h2 id="whats-new-changelog-modal-title" className="whats-new-changelog-modal__title">Version changelog</h2>
            <p className="whats-new-changelog-modal__lead">
              All releases newest first — majors, features (y), and fixes (z). Up to {PUBLIC_CHANGELOG_PAGE_SIZE} entries
              per page.
            </p>
          </div>
          <button type="button" className="whats-new-changelog-modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="whats-new-changelog-modal__body">
          <ChangelogLineList lines={pageLines} />
        </div>

        <footer className="whats-new-changelog-modal__foot">
          <p className="whats-new-changelog-modal__page-meta">
            {allLines.length === 0
              ? "0 entries"
              : `Page ${page} of ${totalPages} · ${allLines.length} total`}
          </p>
          <div className="whats-new-changelog-modal__pager">
            <button
              type="button"
              className="whats-new-changelog-modal__pager-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="whats-new-changelog-modal__pager-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
