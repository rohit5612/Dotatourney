import { buildYoutubeEmbedSrc } from "../utils/youtubeEmbed.js";
import "../styles/landing-livestream.css";

export function TournamentLiveStreamEmbed({ videoId, className = "" }) {
  const src = buildYoutubeEmbedSrc(videoId);
  if (!src) return null;

  const rootClass = ["landing-livestream", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      <p className="landing-livestream__label">Live stream</p>
      <div className="landing-livestream__frame landing-panel">
        <iframe
          className="landing-livestream__iframe"
          src={src}
          title="BPC League live stream"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
