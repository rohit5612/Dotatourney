import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";

export function SeasonsHubPage() {
  const [seasons, setSeasons] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPublicSeasons()
      .then((data) => setSeasons(data.seasons || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="font-serif text-3xl">Seasons</h1>
      <p className="mt-2 text-muted-foreground">BPC League history across competitive seasons.</p>
      {error ? <p className="mt-6 text-destructive">{error}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {seasons.length === 0 && !error ? (
          <p className="text-muted-foreground">Season archive coming soon.</p>
        ) : null}
        {seasons.map((season) => (
          <Link
            key={season.id}
            to={`/seasons/${season.slug}`}
            className="rounded-lg border border-border bg-card p-5 transition hover:border-accent/50"
          >
            <span className="text-xs uppercase tracking-wider text-accent">{season.status}</span>
            <h2 className="mt-2 font-serif text-xl">{season.name || `Season ${season.number}`}</h2>
            {season.themeKey ? (
              <p className="mt-1 text-sm text-muted-foreground capitalize">{season.themeKey} theme</p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
