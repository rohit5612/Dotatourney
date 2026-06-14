import { useEffect, useMemo, useState } from "react";
import { TournamentLiveStreamEmbed } from "./TournamentLiveStreamEmbed.jsx";
import { LandingArchiveEmbeds } from "./landing/LandingArchiveEmbeds.jsx";
import { LandingTournamentStatus } from "./LandingTournamentStatus.jsx";
import { getTournamentDayPhase } from "../utils/tournamentStatus.js";
import { parseYoutubeVideoId } from "../utils/youtubeEmbed.js";

export function TournamentStatusSlot({
  placement = "home",
  variant = "default",
  startDate,
  endDate,
  liveYoutubeUrl,
  archiveEmbeds = [],
  navigate,
  fallbackStart,
  showYoutubeEmbeds = true,
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
  const showLiveEmbed = showYoutubeEmbeds && phase === "live" && Boolean(videoId);

  const validArchiveEmbeds = useMemo(
    () =>
      (Array.isArray(archiveEmbeds) ? archiveEmbeds : []).filter((embed) =>
        parseYoutubeVideoId(embed?.youtubeUrl),
      ),
    [archiveEmbeds],
  );

  const statusProps = {
    startDate,
    endDate,
    fallbackStart,
    navigate,
  };

  const embedVariant = variant;
  const liveStreamClass =
    placement === "tournament" ? "landing-livestream--hero" : "landing-livestream--below-countdown";

  if (showLiveEmbed) {
    return (
      <TournamentLiveStreamEmbed videoId={videoId} variant={embedVariant} className={liveStreamClass} />
    );
  }

  if (placement === "tournament") {
    return <LandingTournamentStatus {...statusProps} />;
  }

  return (
    <>
      <LandingTournamentStatus {...statusProps} />
      {showYoutubeEmbeds && validArchiveEmbeds.length ? (
        <LandingArchiveEmbeds
          embeds={validArchiveEmbeds}
          variant={embedVariant}
          className="landing-livestream--below-countdown"
        />
      ) : null}
    </>
  );
}
