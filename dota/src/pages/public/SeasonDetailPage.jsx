import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { TournamentWinnersBlock } from "../../components/honors/TournamentWinnersBlock.jsx";

export function SeasonDetailPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPublicSeason(slug)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [slug]);

  const season = data?.season;
  const honors = data?.tournament?.honors;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/seasons" className="text-sm text-primary hover:underline">
        ← All seasons
      </Link>
      {error ? <p className="mt-6 text-destructive">{error}</p> : null}
      {season ? (
        <>
          <h1 className="mt-4 font-serif text-3xl">{season.name || slug}</h1>
          <p className="mt-2 text-muted-foreground capitalize">{season.status} · {season.themeKey || "classic"}</p>
          {data.trophyEngraving?.teamName ? (
            <div className="mt-6 rounded-lg border border-primary/30 bg-card p-5">
              <h2 className="font-serif text-lg text-primary">Champions</h2>
              <p className="mt-2 font-semibold">{data.trophyEngraving.teamName}</p>
              {data.trophyEngraving.players?.length ? (
                <p className="mt-1 text-sm text-muted-foreground">{data.trophyEngraving.players.join(", ")}</p>
              ) : null}
              {data.trophyEngraving.mvp ? (
                <p className="mt-2 text-sm">MVP: {data.trophyEngraving.mvp}</p>
              ) : null}
            </div>
          ) : null}
          {honors ? (
            <div className="mt-8">
              <TournamentWinnersBlock honors={honors} />
            </div>
          ) : null}
          {data.participations?.length ? (
            <div className="mt-8">
              <h2 className="font-serif text-xl">Participants</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {data.participations.slice(0, 24).map((p, i) => (
                  <li key={`${p.bpcId}-${i}`} className="flex justify-between border-b border-border py-2">
                    <span>{p.displayName} {p.teamName ? `· ${p.teamName}` : ""}</span>
                    {p.placement != null ? <span className="text-muted-foreground">#{p.placement}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        !error && <p className="mt-6 text-muted-foreground">Loading season…</p>
      )}
    </section>
  );
}
