/**
 * Extracts a YouTube video ID from common watch / live / embed URLs for iframe embeds.
 * @returns {string | null}
 */
export function parseYoutubeVideoId(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;

  try {
    const href = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id && /^[\w-]{6,}$/i.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host.endsWith(".youtube.com")) {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery && /^[\w-]{6,}$/i.test(fromQuery)) return fromQuery;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1] && /^[\w-]{6,}$/i.test(parts[liveIdx + 1])) {
        return parts[liveIdx + 1];
      }
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1] && /^[\w-]{6,}$/i.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1];
      }
      const shortIdx = parts.indexOf("shorts");
      if (shortIdx >= 0 && parts[shortIdx + 1] && /^[\w-]{6,}$/i.test(parts[shortIdx + 1])) {
        return parts[shortIdx + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function buildYoutubeEmbedSrc(videoId) {
  const id = String(videoId || "").trim();
  if (!id) return null;
  const params = new URLSearchParams({
    rel: "0",
    autoplay: "1",
    mute: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}
