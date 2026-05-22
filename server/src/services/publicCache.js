import { createMemoryCache } from "../utils/memoryCache.js";

const cache = createMemoryCache({ defaultTtlMs: 8_000, maxEntries: 24 });

export function getCachedPublicPayload(key) {
  return cache.get(key);
}

export function setCachedPublicPayload(key, payload, ttlMs) {
  cache.set(key, payload, ttlMs);
}

export function invalidatePublicCache() {
  cache.clear();
}
