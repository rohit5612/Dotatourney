import { buildYoutubeEmbedSrc } from "../utils/youtubeEmbed.js";
import "../styles/landing-livestream.css";

export function TournamentLiveStreamEmbed({ videoId, className = "", variant = "default" }) {
  const src = buildYoutubeEmbedSrc(videoId);
  if (!src) return null;

  const bare = variant === "bare";
  const rootClass = ["landing-livestream", bare ? "landing-livestream--bare" : "", className]
    .filter(Boolean)
    .join(" ");
  const frameClass = bare ? "landing-livestream__frame" : "landing-livestream__frame landing-panel";

  return (
    <div className={rootClass}>
      {!bare ? <p className="landing-livestream__label">Live stream</p> : null}
      <div className={frameClass}>
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
