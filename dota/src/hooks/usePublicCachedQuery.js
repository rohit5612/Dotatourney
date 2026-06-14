import { useEffect, useState } from "react";
import { peekCache } from "../lib/requestCache.js";

/**
 * Fetch public API data with session/memory cache — instant paint when cached.
 *
 * @template T
 * @param {string} cacheKey
 * @param {() => Promise<T>} fetcher
 */
export function usePublicCachedQuery(cacheKey, fetcher) {
  const [data, setData] = useState(() => peekCache(cacheKey));
  const [loading, setLoading] = useState(() => peekCache(cacheKey) === undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const cached = peekCache(cacheKey);
    setData(cached);
    setLoading(cached === undefined);
    setError("");

    fetcher()
      .then((value) => {
        if (!active) return;
        setData(value);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Request failed");
        setData(undefined);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // fetcher is stable per cacheKey (api methods close over params via key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { data, loading, error };
}
