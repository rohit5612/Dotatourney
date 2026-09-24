import { useEffect, useState } from "react";
import { peekCache, peekStaleCache } from "../lib/requestCache.js";

function readCachedData(cacheKey) {
  return peekCache(cacheKey) ?? peekStaleCache(cacheKey);
}

/**
 * Fetch public API data with session/memory cache — instant paint when cached.
 * Keeps the last good payload when refresh fails (stale-while-error).
 *
 * @template T
 * @param {string} cacheKey
 * @param {() => Promise<T>} fetcher
 */
export function usePublicCachedQuery(cacheKey, fetcher) {
  const [data, setData] = useState(() => readCachedData(cacheKey));
  const [loading, setLoading] = useState(() => readCachedData(cacheKey) === undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const cached = readCachedData(cacheKey);
    setData(cached);
    setLoading(cached === undefined);
    setError("");

    fetcher()
      .then((value) => {
        if (!active) return;
        if (value !== undefined && value !== null) {
          setData(value);
          setError("");
          return;
        }
        setData((prev) => prev ?? cached);
      })
      .catch((err) => {
        if (!active) return;
        const fallback = readCachedData(cacheKey);
        if (fallback !== undefined) {
          setData(fallback);
          setError("");
          return;
        }
        setData((prev) => {
          if (prev !== undefined && prev !== null) {
            setError("");
            return prev;
          }
          setError(err.message || "Request failed");
          return prev;
        });
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
