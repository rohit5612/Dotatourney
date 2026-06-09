import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import { BpclCard } from "../../components/cards/BpclCard.jsx";
import { TeamLogoImg } from "../../components/TeamLogoImg.jsx";

export function MatchPublicPage() {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getPublicMatch(matchId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [matchId]);

  const match = data?.match;
  const streamUrl = data?.scheduleSlot?.stream_url || data?.scheduleSlot?.streamUrl;

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Link to="/schedule" className="text-sm text-primary hover:underline">
        ← Schedule
      </Link>
      {error ? <p className="mt-6 text-destructive">{error}</p> : null}
      {match ? (
        <>
          <h1 className="mt-4 font-serif text-3xl">
            {match.team1} vs {match.team2}
          </h1>
          <p className="mt-2 text-muted-foreground">{match.round || match.stageKey}</p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <TeamLogoImg teamName={match.team1} logoUrl={data?.team1Logo} size="lg" />
            <span className="text-muted-foreground">vs</span>
            <TeamLogoImg teamName={match.team2} logoUrl={data?.team2Logo} size="lg" />
          </div>
          {streamUrl ? (
            <div className="mt-8 aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
              <iframe
                title="Match stream"
                src={streamUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                className="h-full w-full"
                allowFullScreen
              />
            </div>
          ) : null}
          {data?.rosterCards?.length ? (
            <div className="mt-10">
              <h2 className="font-serif text-xl">Roster cards</h2>
              <div className="mt-4 flex flex-wrap gap-4">
                {data.rosterCards.map((card) => (
                  <BpclCard key={card.bpcId} manifest={card} size="sm" />
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        !error && <p className="mt-6 text-muted-foreground">Loading match…</p>
      )}
    </section>
  );
}
