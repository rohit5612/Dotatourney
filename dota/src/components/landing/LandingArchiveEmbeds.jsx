import { useMemo, useState } from "react";
import { buildYoutubeEmbedSrc, parseYoutubeVideoId } from "../../utils/youtubeEmbed.js";
import "../../styles/landing-livestream.css";

export function LandingArchiveEmbeds({ embeds, className = "", variant = "default" }) {
  const items = useMemo(
    () =>
      (Array.isArray(embeds) ? embeds : [])
        .map((embed) => ({
          ...embed,
          videoId: parseYoutubeVideoId(embed.youtubeUrl),
        }))
        .filter((embed) => embed.videoId),
    [embeds],
  );

  const [activeId, setActiveId] = useState(() => items[0]?.id || "");

  const active = items.find((item) => item.id === activeId) || items[0];
  const src = active ? buildYoutubeEmbedSrc(active.videoId, { autoplay: false, mute: false }) : null;

  if (!items.length || !src) return null;

  const bare = variant === "bare";
  const rootClass = ["landing-livestream landing-archive-embeds", bare ? "landing-livestream--bare" : "", className]
    .filter(Boolean)
    .join(" ");
  const frameClass = bare ? "landing-livestream__frame" : "landing-livestream__frame landing-v2-glass";

  return (
    <div className={rootClass}>
      {!bare ? <p className="landing-livestream__label">Tournament archive</p> : null}
      {items.length > 1 ? (
        <div className="landing-archive-embeds__tabs" role="tablist" aria-label="Archive videos">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === active?.id}
              className={`landing-archive-embeds__tab${item.id === active?.id ? " landing-archive-embeds__tab--active" : ""}`}
              onClick={() => setActiveId(item.id)}
            >
              {item.label || "Highlight"}
            </button>
          ))}
        </div>
      ) : null}
      <div className={frameClass}>
        <iframe
          className="landing-livestream__iframe"
          src={src}
          title={active?.label || "BPC League archive video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
