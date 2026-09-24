import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { useSiteContent } from "../../hooks/useSiteContent.js";
import { compareSemverDesc } from "../../utils/websiteVersionSchema.js";
import { WhatsNewReleaseBlock } from "./WhatsNewReleaseBlock.jsx";

const FILTER_ALL = "all";
const INITIAL_VISIBLE_VH = 150;

const FALLBACK_ENTRIES = [
  {
    id: "vh-season-3",
    version: "3.0.0",
    seasonLabel: "Season 3",
    summary: "League team lores, new public player profiles with stats, and ongoing Season 3 improvements.",
  },
  {
    id: "vh-season-2",
    version: "2.0.0",
    seasonLabel: "Season 2",
    summary: "Hostinger deployment — season card system, player accounts, online checkout.",
  },
  {
    id: "vh-season-1",
    version: "1.0.0",
    seasonLabel: "Season 1",
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

export function WhatsNewPage() {
  const { versionHistory } = useSiteContent();
  const [searchParams, setSearchParams] = useSearchParams();
  const entries = useMemo(() => {
    const rows = versionHistory?.entries?.length ? versionHistory.entries : FALLBACK_ENTRIES;
    return [...rows].sort((a, b) => compareSemverDesc(a.version, b.version));
  }, [versionHistory]);

  const paramVersion = searchParams.get("v")?.trim() || "";
  const [filter, setFilter] = useState(() => {
    const fromUrl = paramVersion || versionFromHash();
    if (fromUrl && entries.some((e) => e.version === fromUrl)) return fromUrl;
    return FILTER_ALL;
  });

  const [visibleBudgetVh, setVisibleBudgetVh] = useState(INITIAL_VISIBLE_VH);

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
    if (!fromUrl) return;
    if (entries.some((e) => e.version === fromUrl)) {
      setFilter(fromUrl);
    }
  }, [paramVersion, entries]);

  const filteredEntries = useMemo(() => {
    if (filter === FILTER_ALL) return entries;
    return entries.filter((e) => e.version === filter);
  }, [entries, filter]);

  const visibleEntries = useMemo(() => {
    if (filter !== FILTER_ALL) return filteredEntries;
    let usedVh = 0;
    const picked = [];
    for (const entry of filteredEntries) {
      picked.push(entry);
      const estimatedVh = entry.version === "2.0.0" ? 120 : entry.version === "3.0.0" ? 24 : 18;
      usedVh += estimatedVh;
      if (usedVh >= visibleBudgetVh) break;
    }
    return picked.length ? picked : filteredEntries.slice(0, 1);
  }, [filteredEntries, filter, visibleBudgetVh]);

  const hasMore =
    filter === FILTER_ALL && visibleEntries.length < filteredEntries.length;

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
            Browse every {SITE_BRAND_SHORT} website release — filter by version or scroll the full changelog.
          </p>
        </div>
      </section>

      <div className="community-page whats-new-page__body">
        <div className="whats-new-page__shell">
          <div className="whats-new-page__toolbar">
            <label className="whats-new-page__filter">
              <span className="whats-new-page__filter-label">Version</span>
              <select
                className="whats-new-page__filter-select"
                value={filter}
                onChange={handleFilterChange}
                aria-label="Filter by website version"
              >
                <option value={FILTER_ALL}>All versions</option>
                {entries.map((entry) => (
                  <option key={entry.id || entry.version} value={entry.version}>
                    v{entry.version}
                    {entry.seasonLabel ? ` — ${entry.seasonLabel}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="whats-new-page__filter-hint">
              {filter === FILTER_ALL
                ? `Showing ${visibleEntries.length} of ${entries.length} releases`
                : `Showing release v${filter}`}
            </p>
          </div>

          <div className="whats-new-page__releases" aria-label="Release history">
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
        </div>
      </div>
    </div>
  );
}
