import { useEffect, useMemo, useState } from "react";
import { LandingTournamentStatus } from "./LandingTournamentStatus.jsx";
import { TournamentLiveStreamEmbed } from "./TournamentLiveStreamEmbed.jsx";
import { getTournamentDayPhase } from "../utils/tournamentStatus.js";
import { parseYoutubeVideoId } from "../utils/youtubeEmbed.js";

export function TournamentStatusSlot({
  placement = "home",
  startDate,
  endDate,
  liveYoutubeUrl,
  navigate,
  fallbackStart,
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const phase = useMemo(
    () => getTournamentDayPhase(startDate, endDate, new Date(now)),
    [startDate, endDate, now],
  );

  const videoId = useMemo(() => parseYoutubeVideoId(liveYoutubeUrl), [liveYoutubeUrl]);
  const showEmbed = phase === "live" && Boolean(videoId);

  const statusProps = {
    startDate,
    endDate,
    fallbackStart,
    navigate,
  };

  if (placement === "tournament") {
    if (showEmbed) {
      return <TournamentLiveStreamEmbed videoId={videoId} className="landing-livestream--hero" />;
    }
    return <LandingTournamentStatus {...statusProps} />;
  }

  return (
    <>
      <LandingTournamentStatus {...statusProps} />
      {showEmbed ? (
        <TournamentLiveStreamEmbed videoId={videoId} className="landing-livestream--below-countdown" />
      ) : null}
    </>
  );
}
