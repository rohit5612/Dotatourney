import { memo, useEffect, useMemo, useState } from "react";
import {
  isTeamLogoCached,
  markTeamLogoCached,
  markTeamLogoFailed,
  normalizeTeamLogoUrl,
  preloadTeamLogo,
} from "../utils/teamLogoCache.js";

/**
 * Team logo with shared preload cache — stable src, no flash on tab/phase changes.
 */
export const TeamLogoImg = memo(function TeamLogoImg({
  src,
  alt = "",
  className = "",
  loading = "lazy",
  fetchPriority,
  width = 52,
  height = 52,
  onError,
}) {
  const url = useMemo(() => normalizeTeamLogoUrl(src), [src]);
  const cachedOnMount = Boolean(url && isTeamLogoCached(url));
  const [ready, setReady] = useState(cachedOnMount);

  useEffect(() => {
    if (!url) {
      setReady(false);
      return;
    }
    if (isTeamLogoCached(url)) {
      setReady(true);
      return;
    }
    let active = true;
    preloadTeamLogo(url).then((ok) => {
      if (active) setReady(ok);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (!url) return null;

  const classNames = ["team-logo-img", ready ? "team-logo-img--ready" : "", className].filter(Boolean).join(" ");

  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      className={classNames}
      loading={cachedOnMount || ready ? "eager" : loading}
      decoding="async"
      fetchPriority={fetchPriority}
      onLoad={() => {
        markTeamLogoCached(url);
        setReady(true);
      }}
      onError={() => {
        markTeamLogoFailed(url);
        setReady(false);
        onError?.();
      }}
    />
  );
});
