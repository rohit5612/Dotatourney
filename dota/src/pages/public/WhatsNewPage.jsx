import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import {
  compareSemverDesc,
  formatWebsiteVersion,
  isMajorReleaseVersion,
  majorReleaseEntries,
  normalizeWebsiteVersion,
} from "../../utils/websiteVersionSchema.js";
import { WhatsNewChangelogModal } from "./WhatsNewChangelogModal.jsx";
import { WhatsNewReleaseBlock } from "./WhatsNewReleaseBlock.jsx";

const FILTER_ALL = "all";
const INITIAL_VISIBLE_VH = 150;

const FALLBACK_MAJOR_ENTRIES = [
  {
    id: "vh-season-3",
    version: "3.0.0",
    seasonLabel: "Season 3",
    releasedAt: "2026-09-25",
    summary: "League team lores, new public player profiles with stats, and ongoing Season 3 improvements.",
  },
  {
    id: "vh-season-2",
    version: "2.0.0",
    seasonLabel: "Season 2",
    releasedAt: "2026-06-15",
    summary: "Hostinger deployment — season card system, player accounts, and dashboard checkout.",
  },
  {
    id: "vh-season-1",
    version: "1.0.0",
    seasonLabel: "Season 1",
    releasedAt: "2026-04-24",
    summary: "First website on Render — static site, manual registration flow.",
  },
];

function versionFromHash() {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return "";
  const decoded = decodeURIComponent(raw);
  if (decoded.startsWith("v-")) {
    return decoded.slice(2).replace(/-/g, ".");
  }
  if (/^\d+\.\d+\.\d+$/.test(decoded)) return decoded;
  return "";
}

function majorFilterLabel(entry) {
  const parts = entry.version.split(".");
  const x = parts[0] || entry.version;
  if (entry.seasonLabel) return `${entry.seasonLabel} (v${x}.0.0)`;
  return `Version ${x}`;
}

function resolveMajorFilter(paramVersion, entries) {
  const fromUrl = paramVersion || versionFromHash();
  if (fromUrl && entries.some((e) => e.version === fromUrl)) return fromUrl;
  return entries[0]?.version || FILTER_ALL;
}

export function WhatsNewPage() {
  const { versionHistory, versionChangeLog, websiteVersion } = useSiteContent();
  const liveVersionLabel = formatWebsiteVersion(normalizeWebsiteVersion(websiteVersion));
  const [searchParams, setSearchParams] = useSearchParams();

  const majorEntries = useMemo(() => {
    const history = versionHistory?.entries?.length ? versionHistory : { entries: FALLBACK_MAJOR_ENTRIES };
    const majors = majorReleaseEntries(history);
    const rows = majors.length ? majors : FALLBACK_MAJOR_ENTRIES;
    return [...rows].sort((a, b) => compareSemverDesc(a.version, b.version));
  }, [versionHistory]);

  const paramVersion = searchParams.get("v")?.trim() || "";
  const [filter, setFilter] = useState(() => resolveMajorFilter(paramVersion, majorEntries));

  const [visibleBudgetVh, setVisibleBudgetVh] = useState(INITIAL_VISIBLE_VH);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const userChoseAllRef = useRef(false);

  const syncFilterToUrl = useCallback(
    (next) => {
      setFilter(next);
      if (next === FILTER_ALL) {
        setSearchParams({}, { replace: true });
      } else {
        setSearchParams({ v: next }, { replace: true });
      }
    },
    [setSearchParams],
  );

  useEffect(() => {
    const fromUrl = paramVersion || versionFromHash();
    if (fromUrl && isMajorReleaseVersion(fromUrl)) {
      if (majorEntries.some((e) => e.version === fromUrl)) {
        setFilter(fromUrl);
        userChoseAllRef.current = false;
      }
      return;
    }
    if (userChoseAllRef.current) {
      setFilter(FILTER_ALL);
      return;
    }
    const latest = majorEntries[0]?.version;
    if (!latest) return;
    setFilter(latest);
    if (!paramVersion && !versionFromHash()) {
      setSearchParams({ v: latest }, { replace: true });
    }
  }, [paramVersion, majorEntries, setSearchParams]);

  const filteredEntries = useMemo(() => {
    if (filter === FILTER_ALL) return majorEntries;
    return majorEntries.filter((e) => e.version === filter);
  }, [majorEntries, filter]);

  const visibleEntries = useMemo(() => {
    if (filter !== FILTER_ALL) return filteredEntries;
    let usedVh = 0;
    const picked = [];
    for (const entry of filteredEntries) {
      picked.push(entry);
      const estimatedVh = entry.version === "2.0.0" ? 95 : entry.version === "3.0.0" ? 110 : 18;
      usedVh += estimatedVh;
      if (usedVh >= visibleBudgetVh) break;
    }
    return picked.length ? picked : filteredEntries.slice(0, 1);
  }, [filteredEntries, filter, visibleBudgetVh]);

  const hasMore = filter === FILTER_ALL && visibleEntries.length < filteredEntries.length;

  useEffect(() => {
    if (filter === FILTER_ALL) return;
    const id = `whats-new-v-${filter.replace(/\./g, "-")}`;
    const node = document.getElementById(id);
    if (node) {
      window.requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [filter, visibleEntries.length]);

  function handleFilterChange(event) {
    const next = event.target.value;
    userChoseAllRef.current = next === FILTER_ALL;
    syncFilterToUrl(next);
    if (next === FILTER_ALL) {
      setVisibleBudgetVh(INITIAL_VISIBLE_VH);
    }
  }

  function loadMore() {
    setVisibleBudgetVh((vh) => vh + INITIAL_VISIBLE_VH);
  }

  return (
    <div className="community-page-layout whats-new-page">
      <section className="community-page__hero-band whats-new-page__hero" aria-labelledby="whats-new-title">
        <div className="community-page__hero-overlay whats-new-page__hero-overlay" aria-hidden="true" />
        <div className="community-page__hero-inner whats-new-page__hero-inner">
          <p className="community-page__eyebrow">Product updates</p>
          <h1 id="whats-new-title" className="community-page__hero-title">
            What&apos;s new
          </h1>
          <p className="community-page__hero-lead">
            Major releases by season — filter below or open the changelog for patch notes.
          </p>
          <ul className="whats-new-page__hero-chips" aria-label="Release highlights">
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Season 3</span>
              <span className="whats-new-page__hero-chip-value">League, profiles, card deck</span>
            </li>
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Season 2</span>
              <span className="whats-new-page__hero-chip-value">Cards, accounts, checkout</span>
            </li>
            <li className="whats-new-page__hero-chip">
              <span className="whats-new-page__hero-chip-label">Patches</span>
              <span className="whats-new-page__hero-chip-value">Full changelog in toolbar</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="community-page whats-new-page__body">
        <div className="whats-new-page__shell">
          <div className="whats-new-page__toolbar">
            <label className="whats-new-page__filter">
              <span className="whats-new-page__filter-label">Major release</span>
              <select
                className="whats-new-page__filter-select"
                value={filter}
                onChange={handleFilterChange}
                aria-label="Filter by major website version"
              >
                <option value={FILTER_ALL}>All major releases</option>
                {majorEntries.map((entry) => (
                  <option key={entry.id || entry.version} value={entry.version}>
                    {majorFilterLabel(entry)}
                  </option>
                ))}
              </select>
            </label>
            <div className="whats-new-page__toolbar-actions">
              <p className="whats-new-page__filter-hint">
                {filter === FILTER_ALL
                  ? `Site version v${liveVersionLabel} · ${visibleEntries.length} of ${majorEntries.length} major releases`
                  : `Site version v${liveVersionLabel}`}
              </p>
              <button
                type="button"
                className="whats-new-page__changelog-link"
                onClick={() => setChangelogOpen(true)}
              >
                View changelog
              </button>
            </div>
          </div>

          <div className="whats-new-page__releases" aria-label="Major release pages">
            {visibleEntries.map((entry) => (
              <WhatsNewReleaseBlock
                key={entry.id || entry.version}
                entry={entry}
                highlighted={filter !== FILTER_ALL && entry.version === filter}
              />
            ))}
          </div>

          {hasMore ? (
            <div className="whats-new-page__load-more-wrap">
              <button type="button" className="whats-new-page__load-more" onClick={loadMore}>
                Load more releases
              </button>
            </div>
          ) : null}

          <WhatsNewChangelogModal
            open={changelogOpen}
            onClose={() => setChangelogOpen(false)}
            versionHistory={versionHistory}
            versionChangeLog={versionChangeLog}
          />
        </div>
      </div>
    </div>
  );
}
