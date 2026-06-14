import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { api } from "../../lib/api";
import { formatAnnouncementPostedAt, parseAnnouncementEntries } from "../../lib/announcementEntries.js";

const PAGE_SIZE = 8;

const CATEGORY_FILTERS = [
  { id: "", label: "All updates" },
  { id: "general", label: "General" },
  { id: "registration", label: "Registration" },
  { id: "match_day", label: "Match day" },
];

const CATEGORY_LABELS = {
  general: "General",
  registration: "Registration",
  match_day: "Match day",
};

function categoryLabel(value) {
  return CATEGORY_LABELS[value] || "Update";
}

function referenceNumberForItems(items) {
  const chronology = [...items].sort((a, b) => {
    const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
    const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  const map = new Map();
  chronology.forEach((item, index) => map.set(item.id, index + 1));
  return map;
}

function cardHeadline(item) {
  const title = String(item.title || "").trim();
  if (title) return title;
  const body = String(item.body || "").trim();
  if (!body) return "Announcement";
  const firstLine = body.split("\n").find((line) => line.trim()) || body;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69).trim()}…` : firstLine;
}

function cardBodyText(item, headline) {
  const body = String(item.body || "").trim();
  if (!body) return "";

  const explicitTitle = String(item.title || "").trim();
  if (explicitTitle) return body;

  const lines = body.split("\n");
  const firstLine = lines.find((line) => line.trim()) || body;
  const derivedHeadline = firstLine.length > 72 ? `${firstLine.slice(0, 69).trim()}…` : firstLine;
  if (derivedHeadline !== headline) return body;

  const firstLineIndex = lines.findIndex((line) => line.trim());
  return lines
    .slice(firstLineIndex + 1)
    .join("\n")
    .trim();
}

export function AnnouncementsPublicPage() {
  const { event } = usePublicTournament();
  const discordUrl = event?.tournament?.discord_url || "https://discord.gg/sV2PhYc6A3";
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(0);
  }, [category]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api
      .getPublicAnnouncements({
        category: category || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((payload) => {
        if (!active) return;
        setItems(payload?.announcements || []);
        setTotal(Number(payload?.total) || 0);
      })
      .catch(async (err) => {
        if (!active) return;
        try {
          const tournament = event?.tournament || (await api.getPublicTournamentFresh())?.tournament;
          const list = parseAnnouncementEntries(tournament?.announcements).filter((entry) => entry.body.trim());
          const mapped = list.map((entry, index) => ({
            id: String(index),
            title: "",
            body: entry.body,
            postedAt: entry.postedAt,
            category: "general",
            pinned: false,
            tournamentName: tournament?.name || SITE_BRAND_SHORT,
          }));
          const filtered = category ? mapped.filter((item) => item.category === category) : mapped;
          const referenceById = referenceNumberForItems(filtered);
          const pageSlice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((item) => ({
            ...item,
            referenceNumber: referenceById.get(item.id) ?? null,
          }));
          setItems(pageSlice);
          setTotal(filtered.length);
        } catch {
          setError(err.message);
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category, page, event?.tournament]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);

  const referenceNumberById = useMemo(() => referenceNumberForItems(items), [items]);

  return (
    <div className="news-page-layout">
      <section className="news-page__hero-band" aria-labelledby="news-page-title">
        <div className="news-page__hero-band-overlay" aria-hidden="true" />
        <div className="news-page__hero-inner">
          <p className="news-page__eyebrow">{SITE_BRAND_SHORT}</p>
          <h1 id="news-page-title" className="news-page__hero-title">
            News &amp; announcements
          </h1>
          <p className="news-page__hero-lead">
            Official tournament updates — schedule changes, registration windows, match-day notices, and league news from
            the active season.
          </p>
          <div className="news-page__hero-meta">
            <span className="news-page__stat">{loading ? "Loading…" : `${total} update${total === 1 ? "" : "s"}`}</span>
            <Link to="/tournament" className="news-page__stat">
              Tournament hub →
            </Link>
          </div>
        </div>
      </section>

      <div className="news-page">
        <div className="news-glass news-page__filter-bar">
        <p className="news-page__filter-label" id="news-filter-label">
          Filter by category
        </p>
        <nav className="news-page__filters" aria-labelledby="news-filter-label">
          {CATEGORY_FILTERS.map((filter) => (
            <button
              key={filter.id || "all"}
              type="button"
              className={`news-page__filter${category === filter.id ? " news-page__filter--active" : ""}`}
              aria-pressed={category === filter.id}
              onClick={() => setCategory(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </nav>
        </div>

        <section className="news-glass news-glass--strong news-page__feed" aria-live="polite">
        <div className="news-page__feed-accent" aria-hidden="true" />

        {error ? <p className="news-page__error">{error}</p> : null}

        {loading ? (
          <div className="news-page__loading" aria-busy="true" aria-label="Loading announcements">
            <div className="news-page__skeleton" />
            <div className="news-page__skeleton" />
            <div className="news-page__skeleton" />
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="news-page__empty">
            <span className="news-page__empty-title">No announcements in this category yet.</span>
            Check back after admins publish updates, or join Discord for live comms.
          </div>
        ) : null}

        {!loading && items.length > 0 ? (
          <ul className="news-page__list">
            {items.map((item) => {
              const headline = cardHeadline(item);
              const bodyText = cardBodyText(item, headline);

              return (
                <li
                  key={item.id}
                  className={`news-glass news-page__card${item.pinned ? " news-page__card--pinned" : ""}`}
                >
                  <header className="news-page__card-header">
                    <div className="news-page__card-meta">
                      <div className="news-page__card-meta-start">
                        <span className="news-page__card-ref">
                          Announcement #{item.referenceNumber ?? referenceNumberById.get(item.id) ?? "—"}
                        </span>
                        {item.postedAt ? (
                          <time className="news-page__card-date" dateTime={item.postedAt}>
                            {formatAnnouncementPostedAt(item.postedAt)}
                          </time>
                        ) : null}
                      </div>
                      <div className="news-page__card-badges">
                        {item.pinned ? (
                          <span className="news-page__badge news-page__badge--pinned">Pinned</span>
                        ) : null}
                        {item.category ? (
                          <span className="news-page__badge news-page__badge--category">
                            {categoryLabel(item.category)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <h2 className="news-page__card-title">{headline}</h2>
                  </header>
                  {bodyText ? (
                    <div className="news-page__card-body-wrap">
                      <p className="news-page__card-body">{bodyText}</p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && pageCount > 1 ? (
          <div className="news-page__pagination">
            <button
              type="button"
              className="news-page__pager-btn"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <p className="news-page__pager-meta">
              Page <strong>{safePage + 1}</strong> of <strong>{pageCount}</strong>
            </p>
            <button
              type="button"
              className="news-page__pager-btn"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
        </section>

        <footer className="news-glass news-page__footer-cta">
          For real-time pairings and admin messages,{" "}
          <a href={discordUrl} target="_blank" rel="noreferrer">
            join our Discord server
          </a>
          . Full tournament details live on the{" "}
          <Link to="/tournament">tournament page</Link>.
        </footer>
      </div>
    </div>
  );
}
