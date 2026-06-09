import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { BpclCardMini } from "../../components/cards/BpclCard.jsx";

export function CommunityPage() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      api
        .getPublicCommunity({ q: query || undefined, limit: 48 })
        .then((data) => setPlayers(data.players || []))
        .catch((err) => setError(err.message));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-serif text-3xl">Community</h1>
      <p className="mt-2 text-muted-foreground">Search players by name or BPC ID.</p>
      <input
        type="search"
        placeholder="Search players…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-6 w-full max-w-md rounded-md border border-input bg-background px-3 py-2"
      />
      {error ? <p className="mt-4 text-destructive">{error}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {players.map((player) => (
          <Link key={player.slug} to={`/player/${player.slug}`} className="block transition hover:opacity-90">
            <BpclCardMini manifest={player.card || { tier: "default", displayName: player.displayName, bpcId: player.bpcId, steamAvatar: player.avatarUrl }} />
          </Link>
        ))}
      </div>
      {players.length === 0 && !error ? (
        <p className="mt-8 text-muted-foreground">No players found.</p>
      ) : null}
    </section>
  );
}
