import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { SITE_BRAND_SHORT } from "../../constants/siteMeta.js";
import { usePublicTournament } from "../../context/PublicTournamentContext.jsx";
import { api } from "../../lib/api";
import { CommunityDirectoryCard } from "./CommunityDirectoryCard.jsx";
import "../../components/cards/CardTierStyles.css";
import "../../styles/card-tier-effects.css";
import "../../styles/card-tier-effects-holo.css";

const PAGE_SIZE = 16;

export function CommunityPage() {
  const { event } = usePublicTournament();
  const discordUrl = event?.tournament?.discord_url || "https://discord.gg/sV2PhYc6A3";
  const registrationsOpen = event?.tournament?.registrations_open === true;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [players, setPlayers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    api
      .getPublicCommunity({
        search: debouncedQuery || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((data) => {
        if (!active) return;
        setPlayers(data.players || []);
        setTotal(Number(data.total) || 0);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Could not load community directory.");
        setPlayers([]);
        setTotal(0);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedQuery, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const showingFrom = total === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const showingTo = Math.min(total, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="community-page-layout">
      <section className="community-page__hero-band" aria-labelledby="community-page-title">
        <div className="community-page__hero-overlay" aria-hidden="true" />
        <div className="community-page__hero-inner">
          <p className="community-page__eyebrow">{SITE_BRAND_SHORT}</p>
          <h1 id="community-page-title" className="community-page__hero-title">
            Community
          </h1>
          <p className="community-page__hero-lead">
            Verified BPC League players — collectible cards, public profiles, and league history.
          </p>
          <div className="community-page__hero-meta">
            <span className="community-page__stat">
              {loading ? "Loading…" : `${total} player${total === 1 ? "" : "s"}`}
            </span>
            {registrationsOpen ? (
              <Link to="/register" className="community-page__stat">
                Register for the season →
              </Link>
            ) : (
              <Link to="/seasons" className="community-page__stat">
                Season archive →
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="community-page">
        <section
          className="community-glass community-glass--liquid community-page__directory"
          aria-live="polite"
        >
          <header className="community-page__directory-head">
            <div className="community-page__directory-intro">
              <h2 className="community-page__directory-title">Player directory</h2>
              <p className="community-page__directory-copy">Search by name, slug, or BPC ID.</p>
            </div>
            <div className="community-page__search-wrap">
              <HiOutlineMagnifyingGlass className="community-page__search-icon" aria-hidden="true" />
              <input
                type="search"
                className="community-page__search"
                placeholder="Search players…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search players by name, slug, or BPC ID"
              />
            </div>
          </header>

          {!loading && !error && total > 0 ? (
            <p className="community-page__status-line">
              Showing {showingFrom}–{showingTo} of {total}
              {debouncedQuery ? ` · “${debouncedQuery}”` : ""}
            </p>
          ) : null}

          {error ? <p className="community-page__error">{error}</p> : null}

          {loading ? (
            <div className="community-page__loading" aria-busy="true" aria-label="Loading players">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="community-page__skeleton" />
              ))}
            </div>
          ) : null}

          {!loading && !error && players.length === 0 ? (
            <div className="community-page__empty">
              <span className="community-page__empty-title">No players found</span>
              {debouncedQuery
                ? "Try a different search term."
                : "Verified player profiles will appear here once accounts are created."}
            </div>
          ) : null}

          {!loading && players.length > 0 ? (
            <ul className="community-page__grid">
              {players.map((player) => (
                <CommunityDirectoryCard key={player.slug} player={player} />
              ))}
            </ul>
          ) : null}

          {!loading && pageCount > 1 ? (
            <div className="community-page__pagination">
              <button
                type="button"
                className="community-page__pager-btn"
                disabled={safePage <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <p className="community-page__pager-meta">
                Page <strong>{safePage + 1}</strong> of <strong>{pageCount}</strong>
              </p>
              <button
                type="button"
                className="community-page__pager-btn"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>

        <footer className="community-glass community-page__footer-cta">
          Pairings, drafts, and live comms happen in{" "}
          <a href={discordUrl} target="_blank" rel="noreferrer">
            Discord
          </a>
          . Want to compete?{" "}
          {registrationsOpen ? (
            <Link to="/register">Register for the current season</Link>
          ) : (
            <>
              Follow <Link to="/announcements">news</Link> for the next registration window
            </>
          )}
          .
        </footer>
      </div>
    </div>
  );
}
